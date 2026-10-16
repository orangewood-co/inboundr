import { Pool } from "pg";

import type { DatabaseConfig } from "../types";

// Every caller in the process shares this pool, so this is the total number of
// Postgres connections the backend holds. The session-mode pooler in front of
// the database allows 20 clients; the rest is headroom for scripts and deploys.
const MAX_CONNECTIONS = 15;

let pool: Pool | null = null;

export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!database || !user || !password) {
    throw new Error("Missing required database environment variables.");
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || "5432"),
    database,
    user,
    password,
  };
}

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({ ...getDatabaseConfigFromEnv(), max: MAX_CONNECTIONS });
    // An idle client dropped by the pooler emits "error" on the pool, which
    // crashes the process when nothing is listening.
    pool.on("error", (err) => {
      console.error("Postgres pool error:", err);
    });
  }
  return pool;
}

export async function closePostgresPool(): Promise<void> {
  const current = pool;
  pool = null;
  await current?.end();
}
