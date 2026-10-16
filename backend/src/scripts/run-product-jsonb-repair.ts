import { Pool } from "pg";

import { getDatabaseConfigFromEnv } from "../db/postgres";

type LeftoverRow = {
  id: string;
  organization_id: string | null;
  default_adjustments: unknown;
};

async function runProductJsonbRepair() {
  const pool = new Pool(getDatabaseConfigFromEnv());
  try {
    const sql = await Bun.file(
      new URL("./repair-product-jsonb-columns.sql", import.meta.url)
    ).text();
    // A multi-statement simple query resolves to one result per statement.
    const results = await pool.query<LeftoverRow>(sql);
    const [updated, leftovers] = Array.isArray(results) ? results : [results, null];

    console.log(`Reset ${updated?.rowCount ?? 0} default_adjustments rows to '[]'`);

    const rows = leftovers?.rows ?? [];
    if (rows.length > 0) {
      console.warn(
        `${rows.length} product(s) still hold a non-array default_adjustments and need manual review:`
      );
      for (const row of rows) {
        console.warn(`  product ${row.id} (org ${row.organization_id}):`, row.default_adjustments);
      }
    }

    console.log("Product JSONB repair complete");
  } finally {
    await pool.end();
  }
}

runProductJsonbRepair().catch((error) => {
  console.error("Product JSONB repair failed:", error);
  process.exit(1);
});
