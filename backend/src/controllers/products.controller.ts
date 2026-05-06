import { Pool } from "pg";
import type { Request, Response } from "express";
import type { DatabaseConfig, Product } from "../types";

type ProductInput = Omit<
  Product,
  "id" | "addedtime" | "embedding" | "embedding_model" | "embedding_updated_at" | "embedding_task"
> & {
  addedtime?: string | Date | null;
};

const PRODUCT_COLUMNS = [
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
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();
    const values: unknown[] = [];

    let whereClause = "";
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      const searchConditions = SEARCH_COLUMNS.map(
        (column) => `lower(COALESCE(${column}::text, '')) LIKE $1`
      );
      whereClause = `WHERE ${searchConditions.join(" OR ")}`;
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
        search ? values.slice(0, 1) : []
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
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }

    const result = await pool.query<Product>(
      `SELECT ${PRODUCT_COLUMNS.join(", ")}
       FROM products
       WHERE id = $1`,
      [id]
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
    const input = normalizeProductInput(req.body ?? {});
    const validationError = validateRequiredProductFields(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const columns = EDITABLE_COLUMNS.filter((column) => column in input);
    const values = columns.map((column) => input[column]);
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
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
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
    values.push(id);

    const result = await pool.query<Product>(
      `UPDATE products
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
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
