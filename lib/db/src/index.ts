import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Prevent unhandled pool errors from crashing the process.
// Log them but keep the server alive so no new auth attempts are spawned.
pool.on("error", (err) => {
  console.error("[db pool error]", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
