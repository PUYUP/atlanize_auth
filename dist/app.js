import express, {} from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import healthRouter from "./routes/health.js";
import meRouter from "./routes/me.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";
export function createApp() {
    const app = express();
    app.set("trust proxy", 1);
    const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.use(cors({
        origin: trustedOrigins.length > 0 ? trustedOrigins : false,
        credentials: true,
    }));
    app.all("/api/auth/*splat", toNodeHandler(auth));
    app.use(express.json());
    app.use("/health", healthRouter);
    app.use("/api/me", meRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map