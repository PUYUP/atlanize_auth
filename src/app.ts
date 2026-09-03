import express, { type Express } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import healthRouter from "./routes/health.js";
import meRouter from "./routes/me.js";
import addMembersRouter from "./routes/add-members.js";
import gcsMetadataRouter from "./routes/gcs/metadata.js";
import gcsSignedUrlRouter from "./routes/gcs/signed-url.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Required when running behind Docker/Nginx/a load balancer so Express
  // reads the real client IP and protocol from X-Forwarded-* headers
  // (Better Auth's rate limiter and secure-cookie detection rely on this).
  app.set("trust proxy", 1);

  const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: trustedOrigins.length > 0 ? trustedOrigins : false,
      credentials: true,
    })
  );

  // Better Auth's handler must be mounted BEFORE express.json(). It parses
  // its own request body, and running express.json() first leaves Better
  // Auth with an already-consumed stream, so client requests hang.
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/api/me", meRouter);
  app.use("/api/members", addMembersRouter);
  app.use("/api/gcs/metadata", gcsMetadataRouter);
  app.use("/api/gcs/signed-url", gcsSignedUrlRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
