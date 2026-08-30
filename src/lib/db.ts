import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase connection string."
  );
}

/**
 * Single shared connection pool used by both Better Auth (via the Kysely
 * adapter it builds internally from this Pool) and any other queries the
 * app needs to run. Keeping one Pool instance avoids exhausting Supabase's
 * connection limit with duplicate pools.
 *
 * Supabase notes:
 * - Prefer the "Session pooler" connection string (port 5432) for a
 *   long-lived container like this one. It is IPv4-safe and supports
 *   prepared statements, unlike the transaction pooler (port 6543).
 * - Only reach for the transaction pooler (port 6543) if you scale this
 *   service horizontally to many replicas and need to conserve Postgres
 *   connections; in that case set DATABASE_URL to the 6543 string.
 * - `ssl: { rejectUnauthorized: false }` accepts Supabase's certificate
 *   without validating the full chain, which is fine for most setups.
 *   For stricter validation, download Supabase's CA certificate and pass
 *   it via `ssl: { ca: fs.readFileSync("supabase-ca.pem", "utf-8") }`.
 */
export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl:
    process.env.DATABASE_SSL === "disable"
      ? false
      : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  // Errors on idle clients (e.g. the DB terminating a connection) must be
  // handled, or they crash the whole Node process.
  console.error("Unexpected error on idle PostgreSQL client", err);
});
