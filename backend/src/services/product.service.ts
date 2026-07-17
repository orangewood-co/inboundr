import { Pool } from "pg";
import { Types } from "mongoose";

import type { DatabaseConfig, Product } from "../types";
import type { CatalogProduct } from "../catalog/catalog.types";
import { mapProductRow, withLegacyProductAliases } from "../catalog/product.mapper";
import {
  adjustmentsFromDefinitions,
  getOrCreateProductSettings,
  normalizeProductAttributes,
} from "./product-settings.service";
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
  "id::text AS id",
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
  "category",
  "tags",
  "attributes",
  "default_adjustments",
  "pricing_policy",
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
  "category",
  "tags",
  "attributes",
  "default_adjustments",
  "pricing_policy",
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
  const canonicalAliases: Record<string, string> = {
    manufacturer: "brand",
    description: "productdescription",
    name: "productdescription",
    sku: "productcode",
    unitPrice: "unitprice",
    taxCode: "hsncode",
    taxRate: "gstrate",
    url: "productlink",
    isFeatured: "is_top_seller",
    createdAt: "addedtime",
    createdBy: "addeduser",
    defaultAdjustments: "default_adjustments",
    pricingPolicy: "pricing_policy",
  };
  const source = { ...body };
  for (const [canonical, legacy] of Object.entries(canonicalAliases)) {
    if (canonical in source && !(legacy in source)) source[legacy] = source[canonical];
  }
  const input: Record<string, unknown> = {};

  for (const column of EDITABLE_PRODUCT_COLUMNS) {
    if (column in source) {
      input[column] =
        column === "is_top_seller"
          ? parseBoolean(source[column])
          : source[column] === ""
            ? null
            : source[column];
    }
  }

  return input as ProductInput;
}

export function validateRequiredProductFields(input: Partial<ProductInput>): string | null {
  if (!input.productdescription) return "Product description is required";
  if (!input.productcode) return "Product code is required";
  return null;
}

export async function createProductRecord(
  organizationId: string,
  rawInput: Record<string, unknown>
): Promise<Product> {
  const input = normalizeProductInput(rawInput);
  const settings = await getOrCreateProductSettings(new Types.ObjectId(organizationId));
  input.attributes = normalizeProductAttributes(
    rawInput.attributes ?? {},
    settings.fieldDefinitions
  ) as ProductInput["attributes"];
  if (!("default_adjustments" in input) && !("defaultAdjustments" in rawInput)) {
    input.default_adjustments = adjustmentsFromDefinitions(settings.adjustmentDefinitions) as ProductInput["default_adjustments"];
  }
  const validationError = validateRequiredProductFields(input);

  if (validationError) {
    throw new ProductServiceError(validationError, "validation");
  }

  const columns = [
    "organization_id",
    ...EDITABLE_PRODUCT_COLUMNS.filter((column) => column in input),
  ];
  const values = columns.map((column) =>
      column === "organization_id" ? organizationId : input[column as keyof ProductInput]
  );
  const placeholders = columns.map((_, index) => `$${index + 1}`);

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

export function serializeProductRecord(product: Product): CatalogProduct & Record<string, unknown> {
  return withLegacyProductAliases(mapProductRow(product));
}

export async function searchProductRecords(input: {
  organizationId: string;
  query: string;
  limit?: number;
  topSellerOnly?: boolean;
}): Promise<ProductSearchGroup> {
  const settings = await getOrCreateProductSettings(new Types.ObjectId(input.organizationId));
  const rawSynonyms = settings.search.synonyms;
  const synonyms = rawSynonyms instanceof Map
    ? Object.fromEntries(rawSynonyms.entries())
    : { ...(rawSynonyms as Record<string, string[]>) };
  const searcher = new TextProductSearcher(getDatabaseConfigFromEnv(), {
    synonyms,
    stopWords: settings.search.stopWords,
    matchThreshold: settings.search.matchThreshold,
    ambiguityGap: settings.search.ambiguityGap,
    taxLabel: settings.terminology.taxRateLabel,
    searchableAttributeKeys: settings.fieldDefinitions
      .filter((field) => field.isActive && field.searchable)
      .map((field) => field.key),
  });

  try {
    return await searcher.searchProduct(
      { name: input.query, quantity: 1 },
      input.organizationId,
      input.limit,
      { topSellerOnly: input.topSellerOnly }
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
