import { Pool } from "pg";

import { getDatabaseConfigFromEnv } from "../utils/product-search";

async function runProductPostgresMigration() {
  const pool = new Pool(getDatabaseConfigFromEnv());
  try {
    const sql = await Bun.file(new URL("./generalize-products.sql", import.meta.url)).text();
    await pool.query(sql);
    console.log("PostgreSQL generic product migration complete");
  } finally {
    await pool.end();
  }
}

runProductPostgresMigration().catch((error) => {
  console.error("PostgreSQL generic product migration failed:", error);
  process.exit(1);
});
