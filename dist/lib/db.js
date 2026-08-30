import { Pool } from "pg";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase connection string.");
}
export const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.DATABASE_SSL === "disable"
        ? false
        : { rejectUnauthorized: false },
});
pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client", err);
});
//# sourceMappingURL=db.js.map