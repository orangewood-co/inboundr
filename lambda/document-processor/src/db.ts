import { Pool } from "pg";

import { getDatabaseConfig } from "./config";
import { provisionDocumentPipelineSchema } from "./schema";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    // Lambda invocations are single-request; a tiny pool keeps total Postgres
    // connections bounded by the function's reserved concurrency.
    pool = new Pool({ ...getDatabaseConfig(), max: 2 });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

/**
 * Idempotently provisions the pipeline tables once per process (warm Lambda
 * containers reuse the resolved promise).
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = provisionDocumentPipelineSchema(getPool()).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
