import { Pool } from "pg";
import type { Request, Response } from "express";
import type { DatabaseConfig, Product } from "../types";
import type { OrganizationRequest } from "../middleware/auth.middleware";

type ProductInput = Omit<
  Product,
  "id" | "addedtime" | "embedding" | "embedding_model" | "embedding_updated_at" | "embedding_task"
> & {
  addedtime?: string | Date | null;
};

const PRODUCT_COLUMNS = [
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
  "addedtime",
  "addeduser",
] as const;

const EDITABLE_COLUMNS = [
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
] as const;

const SEARCH_COLUMNS = [
  "brand",
  "productdescription",
  "productcode",
  "hsncode",
  "unit",
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

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function parseProductId(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProductInput(body: Record<string, unknown>): ProductInput {
  const input: Record<string, unknown> = {};

  for (const column of EDITABLE_COLUMNS) {
    if (column in body) {
      input[column] = body[column] === "" ? null : body[column];
    }
  }

  return input as ProductInput;
}

function validateRequiredProductFields(input: Partial<ProductInput>): string | null {
  if (!input.productdescription) return "Product description is required";
  if (!input.productcode) return "Product code is required";
  if (!input.brand) return "Brand is required";
  return null;
}

export const listProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();
    const values: unknown[] = [organizationId];

    let whereClause = "WHERE organization_id = $1";
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      const searchParam = values.length;
      const searchConditions = SEARCH_COLUMNS.map(
        (column) => `lower(COALESCE(${column}::text, '')) LIKE $${searchParam}`
      );
      whereClause += ` AND (${searchConditions.join(" OR ")})`;
    }

    values.push(limit, offset);
    const limitParam = values.length - 1;
    const offsetParam = values.length;

    const [productsResult, totalResult] = await Promise.all([
      pool.query<Product>(
        `SELECT ${PRODUCT_COLUMNS.join(", ")}
         FROM products
         ${whereClause}
         ORDER BY addedtime DESC NULLS LAST, id DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        values
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM products
         ${whereClause}`,
        values.slice(0, search ? 2 : 1)
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.count ?? "0", 10);
    res.json({
      products: productsResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const id = parseProductId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }

    const result = await pool.query<Product>(
      `SELECT ${PRODUCT_COLUMNS.join(", ")}
       FROM products
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    const product = result.rows[0];
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const input = normalizeProductInput(req.body ?? {});
    const validationError = validateRequiredProductFields(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const columns = ["organization_id", ...EDITABLE_COLUMNS.filter((column) => column in input)];
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

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const id = parseProductId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }

    const input = normalizeProductInput(req.body ?? {});
    const columns = EDITABLE_COLUMNS.filter((column) => column in input);

    if (columns.length === 0) {
      res.status(400).json({ error: "No product fields provided" });
      return;
    }

    const values = columns.map((column) => input[column]);
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    values.push(id, organizationId);

    const result = await pool.query<Product>(
      `UPDATE products
       SET ${assignments.join(", ")}
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING ${PRODUCT_COLUMNS.join(", ")}`,
      values
    );

    const product = result.rows[0];
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
};

export const getProductStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();

    const result = await pool.query<{
      total_products: string;
      unique_brands: string;
      avg_unit_price: string | null;
      recently_added: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_products,
         COUNT(DISTINCT brand)::text AS unique_brands,
         ROUND(AVG(unitprice)::numeric, 2)::text AS avg_unit_price,
         COUNT(*) FILTER (WHERE addedtime > now() - interval '30 days')::text AS recently_added
       FROM products
       WHERE organization_id = $1`,
      [organizationId]
    );

    const row = result.rows[0];
    res.json({
      totalProducts: parseInt(row?.total_products ?? "0", 10),
      uniqueBrands: parseInt(row?.unique_brands ?? "0", 10),
      avgUnitPrice: row?.avg_unit_price ? parseFloat(row.avg_unit_price) : 0,
      recentlyAdded: parseInt(row?.recently_added ?? "0", 10),
    });
  } catch (err) {
    console.error("Error fetching product stats:", err);
    res.status(500).json({ error: "Failed to fetch product stats" });
  }
};
