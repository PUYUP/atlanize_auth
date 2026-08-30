import { Router } from "express";
import { pool } from "../lib/db.js";
const router = Router();
router.get("/", async (_req, res) => {
    try {
        await pool.query("SELECT 1");
        res.status(200).json({ status: "ok", uptime: process.uptime() });
    }
    catch (error) {
        console.error("Health check DB query failed", error);
        res.status(503).json({ status: "error", message: "Database unreachable" });
    }
});
export default router;
//# sourceMappingURL=health.js.map