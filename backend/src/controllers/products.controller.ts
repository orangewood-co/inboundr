import { Pool } from "pg";
import type { Request, Response } from "express";
import type { DatabaseConfig, Product } from "../types";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  searchProductRecords,
  serializeProductRecord,
} from "../services/product.service";
import {
  adjustmentsFromDefinitions,
  getOrCreateProductSettings,
  normalizeProductAttributes,
} from "../services/product-settings.service";

type ProductInput = Omit<
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

type ImportMode = "skip" | "update";

type ProductImportResult = {
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    total: number;
  };
  errors: Array<{ row: number; error: string }>;
  skipped: Array<{ row: number; productcode: string; reason: string }>;
};

const PRODUCT_COLUMNS = [
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
  "is_top_seller",
  "category",
  "tags",
  "attributes",
  "default_adjustments",
  "pricing_policy",
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
  "category",
  "attributes",
  "tags",
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

function parseProductId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

function normalizeProductInput(body: Record<string, unknown>): ProductInput {
  const aliases: Record<string, string> = {
    manufacturer: "brand",
    description: "productdescription",
    name: "productdescription",
    sku: "productcode",
    unitPrice: "unitprice",
    taxCode: "hsncode",
    taxRate: "gstrate",
    url: "productlink",
    isFeatured: "is_top_seller",
    defaultAdjustments: "default_adjustments",
    pricingPolicy: "pricing_policy",
    createdAt: "addedtime",
    createdBy: "addeduser",
  };
  const source = { ...body };
  for (const [canonical, legacy] of Object.entries(aliases)) {
    if (canonical in source && !(legacy in source)) source[legacy] = source[canonical];
  }
  const input: Record<string, unknown> = {};

  for (const column of EDITABLE_COLUMNS) {
    if (column in source) {
      input[column] = column === "is_top_seller" ? parseBoolean(source[column]) : source[column] === "" ? null : source[column];
    }
  }

  return input as ProductInput;
}

function normalizeImportProductInput(body: Record<string, unknown>): Partial<ProductInput> {
  const input = normalizeProductInput(body) as Record<string, unknown>;

  for (const column of ["maxdiscount", "unitprice", "gstrate", "maxupsell", "calibrationcharges"] as const) {
    if (column in input && input[column] !== null) {
      const parsed = Number(input[column]);
      input[column] = Number.isFinite(parsed) ? parsed : null;
    }
  }

  if ("addedtime" in input && input.addedtime !== null) {
    const parsedDate = new Date(String(input.addedtime));
    if (Number.isNaN(parsedDate.getTime())) {
      delete input.addedtime;
    } else {
      input.addedtime = parsedDate;
    }
  }

  return input as Partial<ProductInput>;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "y", "1", "top seller", "top-seller", "topseller", "best seller", "priority product"].includes(normalized);
  }

  return false;
}

function clientErrorStatus(err: unknown): number | null {
  const statusCode = (err as { statusCode?: unknown })?.statusCode;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 ? statusCode : null;
}

function validateRequiredProductFields(input: Partial<ProductInput>): string | null {
  if (!input.productdescription) return "Product description is required";
  if (!input.productcode) return "Product code is required";
  return null;
}

const SORTABLE_COLUMNS = [
  "productcode",
  "productdescription",
  "brand",
  "unitprice",
  "gstrate",
  "addedtime",
] as const;

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
    const brand = String(req.query.brand ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const topSeller = parseBoolean(req.query.topSeller);
    const requestedSort = String(req.query.sortBy ?? "").trim();
    const sortBy = (SORTABLE_COLUMNS as readonly string[]).includes(requestedSort)
      ? requestedSort
      : null;
    const sortOrder =
      String(req.query.sortOrder ?? "").trim().toLowerCase() === "asc" ? "ASC" : "DESC";
    const orderClause = sortBy
      ? `ORDER BY ${sortBy} ${sortOrder} NULLS LAST, id DESC`
      : "ORDER BY addedtime DESC NULLS LAST, id DESC";
    const whereValues: unknown[] = [organizationId];

    let whereClause = "WHERE organization_id = $1";
    if (search) {
      whereValues.push(`%${search.toLowerCase()}%`);
      const searchParam = whereValues.length;
      const searchConditions = SEARCH_COLUMNS.map(
        (column) => `lower(COALESCE(${column}::text, '')) LIKE $${searchParam}`
      );
      whereClause += ` AND (${searchConditions.join(" OR ")})`;
    }
    if (brand) {
      whereValues.push(brand);
      whereClause += ` AND brand = $${whereValues.length}`;
    }
    if (category) {
      whereValues.push(category);
      whereClause += ` AND category = $${whereValues.length}`;
    }
    if (topSeller) {
      whereClause += " AND is_top_seller = TRUE";
    }

    const values = [...whereValues, limit, offset];
    const limitParam = values.length - 1;
    const offsetParam = values.length;

    const [productsResult, totalResult] = await Promise.all([
      pool.query<Product>(
        `SELECT ${PRODUCT_COLUMNS.join(", ")}
         FROM products
         ${whereClause}
         ${orderClause}
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        values
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM products
         ${whereClause}`,
        whereValues
      ),
    ]);

    const total = parseInt(totalResult.rows[0]?.count ?? "0", 10);
    res.json({
      products: productsResult.rows.map(serializeProductRecord),
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

export const listProductMatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const search = String(req.query.search ?? "").trim();
    const limit = parsePositiveInt(req.query.limit, 8, 20);

    if (!search) {
      res.status(400).json({ error: "Search query is required" });
      return;
    }

    const result = await searchProductRecords({
      organizationId,
      query: search,
      limit,
      topSellerOnly: parseBoolean(req.query.topSellerOnly),
    });

    res.json(result);
  } catch (err) {
    console.error("Error listing product matches:", err);
    res.status(500).json({ error: "Failed to fetch product matches" });
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

    res.json(serializeProductRecord(product));
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
    const settings = await getOrCreateProductSettings((req as OrganizationRequest).organization._id);
    input.attributes = normalizeProductAttributes(
      req.body?.attributes ?? {},
      settings.fieldDefinitions
    ) as ProductInput["attributes"];
    if (!("default_adjustments" in input) && !("defaultAdjustments" in (req.body ?? {}))) {
      input.default_adjustments = adjustmentsFromDefinitions(settings.adjustmentDefinitions) as ProductInput["default_adjustments"];
    }
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

    res.status(201).json(result.rows[0] ? serializeProductRecord(result.rows[0]) : null);
  } catch (err) {
    const clientStatus = clientErrorStatus(err);
    if (clientStatus) {
      res.status(clientStatus).json({ error: err instanceof Error ? err.message : "Invalid product input" });
      return;
    }
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
};

export const importProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();

  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();
    const settings = await getOrCreateProductSettings((req as OrganizationRequest).organization._id);
    const mode = req.body?.mode as ImportMode;
    const products = Array.isArray(req.body?.products) ? req.body.products : [];

    if (mode !== "skip" && mode !== "update") {
      res.status(400).json({ error: "Import mode must be skip or update" });
      return;
    }

    if (products.length === 0) {
      res.status(400).json({ error: "No products provided for import" });
      return;
    }

    if (products.length > 5000) {
      res.status(400).json({ error: "Import is limited to 5000 rows at a time" });
      return;
    }

    const result: ProductImportResult = {
      summary: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        total: products.length,
      },
      errors: [],
      skipped: [],
    };

    await client.query("BEGIN");

    for (const [index, rawProduct] of products.entries()) {
      const rowNumber = index + 2;
      const savepoint = `product_import_${index}`;
      await client.query(`SAVEPOINT ${savepoint}`);

      try {
        if (!rawProduct || typeof rawProduct !== "object" || Array.isArray(rawProduct)) {
          throw new Error("Row is not a valid product");
        }

        const input = normalizeImportProductInput(rawProduct as Record<string, unknown>);
        input.attributes = normalizeProductAttributes(
          (rawProduct as Record<string, unknown>).attributes ?? {},
          settings.fieldDefinitions
        ) as ProductInput["attributes"];
        const validationError = validateRequiredProductFields(input);
        if (validationError) {
          throw new Error(validationError);
        }

        const existing = await client.query<{ id: string }>(
          `SELECT id::text AS id
           FROM products
           WHERE organization_id = $1 AND productcode = $2
           LIMIT 1`,
          [organizationId, input.productcode]
        );

        if (existing.rows[0] && mode === "skip") {
          result.summary.skipped += 1;
          result.skipped.push({
            row: rowNumber,
            productcode: String(input.productcode),
            reason: "Product code already exists",
          });
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          continue;
        }

        if (existing.rows[0] && mode === "update") {
          const columns = EDITABLE_COLUMNS.filter((column) => column in input);
          const values = columns.map((column) => input[column]);
          const assignments = columns.map((column, assignmentIndex) => {
            const placeholder = `$${assignmentIndex + 1}`;
            if (column === "attributes" || column === "pricing_policy") {
              return `${column} = COALESCE(${column}, '{}'::jsonb) || ${placeholder}::jsonb`;
            }
            return `${column} = ${placeholder}`;
          });
          values.push(existing.rows[0].id, organizationId);

          await client.query(
            `UPDATE products
             SET ${assignments.join(", ")}
             WHERE id = $${values.length - 1} AND organization_id = $${values.length}`,
            values
          );
          result.summary.updated += 1;
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          continue;
        }

        if (!("default_adjustments" in input) && !("defaultAdjustments" in (rawProduct as Record<string, unknown>))) {
          input.default_adjustments = adjustmentsFromDefinitions(settings.adjustmentDefinitions) as ProductInput["default_adjustments"];
        }
        const columns = ["organization_id", ...EDITABLE_COLUMNS.filter((column) => column in input)];
        const values = columns.map((column) =>
            column === "organization_id" ? organizationId : input[column as keyof ProductInput]
        );
        const placeholders = columns.map((_, placeholderIndex) => `$${placeholderIndex + 1}`);

        await client.query(
          `INSERT INTO products (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})`,
          values
        );
        result.summary.created += 1;
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        result.summary.failed += 1;
        result.errors.push({
          row: rowNumber,
          error: err instanceof Error ? err.message : "Unable to import row",
        });
      }
    }

    await client.query("COMMIT");
    res.status(200).json(result);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Error importing products:", err);
    res.status(500).json({ error: "Failed to import products" });
  } finally {
    client.release();
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
    const settings = await getOrCreateProductSettings((req as OrganizationRequest).organization._id);
    if ("attributes" in (req.body ?? {})) {
      input.attributes = normalizeProductAttributes(req.body.attributes, settings.fieldDefinitions) as ProductInput["attributes"];
    }
    const columns = EDITABLE_COLUMNS.filter((column) => column in input);

    if (columns.length === 0) {
      res.status(400).json({ error: "No product fields provided" });
      return;
    }

    const values = columns.map((column) => input[column]);
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    values.push(id, organizationId);

    let result = await pool.query<Product>(
      `UPDATE products
       SET ${assignments.join(", ")}
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING ${PRODUCT_COLUMNS.join(", ")}`,
      values
    );

    if (!result.rows[0] && input.productcode) {
      const fallbackValues = columns.map((column) => input[column]);
      fallbackValues.push(input.productcode, organizationId);
      result = await pool.query<Product>(
        `UPDATE products
         SET ${assignments.join(", ")}
         WHERE productcode = $${fallbackValues.length - 1} AND organization_id = $${fallbackValues.length}
         RETURNING ${PRODUCT_COLUMNS.join(", ")}`,
        fallbackValues
      );
    }

    const product = result.rows[0];
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(serializeProductRecord(product));
  } catch (err) {
    const clientStatus = clientErrorStatus(err);
    if (clientStatus) {
      res.status(clientStatus).json({ error: err instanceof Error ? err.message : "Invalid product input" });
      return;
    }
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
};

export const deleteProduct = async (
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

    const result = await pool.query<{ id: string }>(
      `DELETE FROM products
       WHERE id = $1 AND organization_id = $2
       RETURNING id::text AS id`,
      [id, organizationId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
};

export const getProductFacets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organizationId = (req as OrganizationRequest).organization._id.toString();

    const [brandsResult, categoriesResult] = await Promise.all([
      pool.query<{ brand: string }>(
        `SELECT DISTINCT brand
         FROM products
         WHERE organization_id = $1 AND brand IS NOT NULL AND brand <> ''
         ORDER BY brand ASC`,
        [organizationId]
      ),
      pool.query<{ category: string }>(
        `SELECT DISTINCT category
         FROM products
         WHERE organization_id = $1 AND category IS NOT NULL AND category <> ''
         ORDER BY category ASC`,
        [organizationId]
      ),
    ]);

    res.json({
      brands: brandsResult.rows.map((row) => row.brand),
      categories: categoriesResult.rows.map((row) => row.category),
    });
  } catch (err) {
    console.error("Error fetching product facets:", err);
    res.status(500).json({ error: "Failed to fetch product facets" });
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
