import "dotenv/config";
import * as XLSX from "xlsx";
import { Pool } from "pg";
import { GeminiProductEmbedder } from "../src/embeddings";
import type { DatabaseConfig } from "../src/types";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLUMN_MAP: Record<string, string> = {
  Brand: "brand",
  "Max Discount %": "maxdiscount",
  "Product Description": "productdescription",
  "Product Code": "productcode",
  "Unit Price": "unitprice",
  "HSN Code": "hsncode",
  "GST Rate": "gstrate",
  "Product link": "productlink",
  "Max Upsell %": "maxupsell",
  "Calibration Charges": "calibrationcharges",
  Unit: "unit",
  "Added Time": "addedtime",
  "Added User": "addeduser",
  ID: "id",
};

const DB_COLUMNS = [
  "id",
  "brand",
  "maxdiscount",
  "productdescription",
  "productcode",
  "unitprice",
  "hsncode",
  "gstrate",
  "productlink",
  "maxupsell",
  "calibrationcharges",
  "unit",
  "addedtime",
  "addeduser",
];

function parseExcel(filePath: string): Record<string, any>[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error(`No sheets found in ${filePath}`);
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} not found in ${filePath}`);
  }
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  return rawRows.map((row) => {
    const mapped: Record<string, any> = {};
    for (const [xlsxCol, dbCol] of Object.entries(COLUMN_MAP)) {
      let value = row[xlsxCol] ?? null;

      // Parse date fields - XLSX may return serial numbers for dates
      if (dbCol === "addedtime" && value != null) {
        if (typeof value === "number") {
          const date = XLSX.SSF.parse_date_code(value);
          value = new Date(date.y, date.m - 1, date.d);
        } else if (typeof value === "string") {
          value = new Date(value);
        }
      }

      // Convert empty strings to null for numeric columns
      const numericCols = ["maxdiscount", "unitprice", "gstrate", "maxupsell", "calibrationcharges"];
      if (numericCols.includes(dbCol) && (value === "" || value === undefined)) {
        value = null;
      }

      mapped[dbCol] = value;
    }
    return mapped;
  });
}

async function seedProducts() {
  const dbConfig: DatabaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  };

  // 1. Parse Excel file
  const xlsxPath = path.join(__dirname, "products.xlsx");
  console.log(`Reading ${xlsxPath}...`);
  const products = parseExcel(xlsxPath);
  console.log(`Parsed ${products.length} products from XLSX`);

  // 2. Insert into database
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      await client.query("BEGIN");

      for (const product of batch) {
        const values = DB_COLUMNS.map((col) => product[col]);
        const placeholders = DB_COLUMNS.map((_, idx) => `$${idx + 1}`);

        await client.query(
          `INSERT INTO products (${DB_COLUMNS.join(", ")})
           VALUES (${placeholders.join(", ")})
           ON CONFLICT (id) DO NOTHING`,
          values
        );
      }

      await client.query("COMMIT");
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${products.length} products`);
    }

    console.log(`Done inserting ${inserted} products`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error inserting products:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  // 3. Generate embeddings
  console.log("\nGenerating embeddings...");
  const embedder = new GeminiProductEmbedder(
    process.env.GCP_PROJECT_ID!,
    process.env.GCP_LOCATION || "us-central1",
    dbConfig
  );

  try {
    const stats = await embedder.getEmbeddingStats();
    console.log(`Products without embeddings: ${stats.missingEmbeddings}`);

    if (stats.missingEmbeddings > 0) {
      await embedder.generateProductEmbeddings(50, "RETRIEVAL_DOCUMENT");
    }

    const finalStats = await embedder.getEmbeddingStats();
    console.log(`\nFinal stats:`);
    console.log(`  Total: ${finalStats.total}`);
    console.log(`  With embeddings: ${finalStats.withEmbeddings}`);
    console.log(`  Completion: ${finalStats.completionPercentage}%`);
  } finally {
    await embedder.close();
  }
}

seedProducts().catch(console.error);
