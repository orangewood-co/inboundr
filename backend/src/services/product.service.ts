import { Pool } from "pg";

import type { DatabaseConfig, Product } from "../types";
import {
  TextProductSearcher,
  getDatabaseConfigFromEnv,
  type ProductSearchGroup,
} from "../utils/product-search";

export type ProductInput = Omit<
  Product,
  | "id"
  | "organization_id"
  | "addedtime"
  | "embedding"
  | "embedding_model"
  | "embedding_updated_at"
  | "embedding_task"
> & {
  addedtime?: string | Date | null;
};

export const PRODUCT_COLUMNS = [
  "id",
  "organization_id",
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
  "is_top_seller",
  "addedtime",
  "addeduser",
] as const;

export const EDITABLE_PRODUCT_COLUMNS = [
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
  "is_top_seller",
  "addedtime",
  "addeduser",
] as const;

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
};

const pool = new Pool(dbConfig);

export function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return [
      "true",
      "yes",
      "y",
      "1",
      "top seller",
      "top-seller",
      "topseller",
      "best seller",
      "priority product",
    ].includes(normalized);
  }

  return false;
}

export function normalizeProductInput(body: Record<string, unknown>): ProductInput {
  const input: Record<string, unknown> = {};

  for (const column of EDITABLE_PRODUCT_COLUMNS) {
    if (column in body) {
      input[column] =
        column === "is_top_seller"
          ? parseBoolean(body[column])
          : body[column] === ""
            ? null
            : body[column];
    }
  }

  return input as ProductInput;
}

export function validateRequiredProductFields(input: Partial<ProductInput>): string | null {
  if (!input.productdescription) return "Product description is required";
  if (!input.productcode) return "Product code is required";
  if (!input.brand) return "Brand is required";
  return null;
}

export async function createProductRecord(
  organizationId: string,
  rawInput: Record<string, unknown>
): Promise<Product> {
  const input = normalizeProductInput(rawInput);
  const validationError = validateRequiredProductFields(input);

  if (validationError) {
    throw new ProductServiceError(validationError, "validation");
  }

  const columns = [
    "id",
    "organization_id",
    ...EDITABLE_PRODUCT_COLUMNS.filter((column) => column in input),
  ];
  const values = columns
    .filter((column) => column !== "id")
    .map((column) =>
      column === "organization_id" ? organizationId : input[column as keyof ProductInput]
    );
  let placeholderIndex = 0;
  const placeholders = columns.map((column) =>
    column === "id" ? "(SELECT COALESCE(MAX(id), 0) + 1 FROM products)" : `$${++placeholderIndex}`
  );

  const result = await pool.query<Product>(
    `INSERT INTO products (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING ${PRODUCT_COLUMNS.join(", ")}`,
    values
  );

  const product = result.rows[0];
  if (!product) {
    throw new ProductServiceError("Failed to create product", "unknown");
  }

  return product;
}

export async function searchProductRecords(input: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<ProductSearchGroup> {
  const searcher = new TextProductSearcher(getDatabaseConfigFromEnv());

  try {
    return await searcher.searchProduct(
      { name: input.query, quantity: 1 },
      input.organizationId,
      input.limit
    );
  } finally {
    await searcher.close();
  }
}

export class ProductServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "validation" | "unknown"
  ) {
    super(message);
  }
}
