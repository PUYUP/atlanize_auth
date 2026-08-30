# syntax=docker/dockerfile:1

################################################################################
# Base: shared image settings for every stage
################################################################################
FROM node:24-alpine AS base
WORKDIR /app
# dumb-init ensures SIGTERM from `docker stop` reaches the Node process
# directly, so the graceful shutdown logic in src/server.ts actually runs.
RUN apk add --no-cache dumb-init

################################################################################
# Deps: install full dependency tree (needed to compile TypeScript)
################################################################################
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

################################################################################
# Build: compile TypeScript -> dist/
################################################################################
FROM base AS build
COPY package.json package-lock.json tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN npm run build

################################################################################
# Prod deps: install production-only dependencies (smaller, no dev tools)
################################################################################
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

################################################################################
# Runtime: minimal final image
################################################################################
FROM base AS runtime
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
