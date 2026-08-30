import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./lib/db.js";
const port = Number(process.env.PORT ?? 3000);
const app = createApp();
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port} (${process.env.NODE_ENV ?? "development"})`);
});
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async (closeErr) => {
        if (closeErr) {
            console.error("Error while closing HTTP server", closeErr);
        }
        try {
            await pool.end();
            console.log("Database pool closed.");
        }
        catch (err) {
            console.error("Error while closing database pool", err);
        }
        finally {
            process.exit(closeErr ? 1 : 0);
        }
    });
    setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});
//# sourceMappingURL=server.js.map