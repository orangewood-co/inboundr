import { Pool } from "pg";
import type { Request, Response } from "express";
import { Customer } from "../models/customer.model";
import { RFQ, type IRFQ } from "../models/rfq.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import type { DatabaseConfig, Product } from "../types";

type SearchType = "customer" | "product" | "rfq";

type SearchResult = {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  metadata: Record<string, string | number | boolean | null>;
  url: string;
};

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

const PRODUCT_SEARCH_COLUMNS = [
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

function parseLimit(value: unknown): number {
  const parsed = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuery(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function compactSubtitle(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

async function searchCustomers(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const filter = {
    organizationId,
    isArchived: { $ne: true },
    $or: [
      { name: regex },
      { company: regex },
      { email: regex },
      { contactNumber: regex },
      { address: regex },
      { notes: regex },
    ],
  };

  const customers = await Customer.find(filter)
    .select("name company email contactNumber updatedAt")
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return customers.map((customer) => ({
    type: "customer",
    id: customer._id.toString(),
    title: customer.company || customer.name,
    subtitle: compactSubtitle([customer.name, customer.email, customer.contactNumber]),
    metadata: {
      name: customer.name,
      company: customer.company,
      email: customer.email,
      contactNumber: customer.contactNumber ?? null,
    },
    url: `/customers?search=${encodeURIComponent(customer.company || customer.email || customer.name)}`,
  }));
}

async function searchProducts(
  organizationId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const values: unknown[] = [organizationId, `%${query.toLowerCase()}%`, query.toLowerCase(), limit];
  const conditions = PRODUCT_SEARCH_COLUMNS.map(
    (column) => `lower(COALESCE(${column}::text, '')) LIKE $2`
  );

  const result = await pool.query<
    Pick<
      Product,
      "id" | "brand" | "productdescription" | "productcode" | "unitprice" | "hsncode" | "gstrate"
    >
  >(
    `SELECT id, brand, productdescription, productcode, unitprice, hsncode, gstrate
     FROM products
     WHERE organization_id = $1 AND (${conditions.join(" OR ")})
     ORDER BY
       CASE
         WHEN lower(COALESCE(productcode::text, '')) = $3 THEN 0
         WHEN lower(COALESCE(productcode::text, '')) LIKE $2 THEN 1
         ELSE 2
       END,
       addedtime DESC NULLS LAST,
       id DESC
     LIMIT $4`,
    values
  );

  return result.rows.map((product) => ({
    type: "product",
    id: String(product.id),
    title: product.productdescription || product.productcode || "Catalog product",
    subtitle: compactSubtitle([product.brand, product.productcode, product.hsncode]),
    metadata: {
      brand: product.brand,
      productCode: product.productcode,
      unitPrice: product.unitprice == null ? null : Number(product.unitprice),
      hsnCode: product.hsncode,
      gstRate: product.gstrate == null ? null : Number(product.gstrate),
    },
    url: `/products?search=${encodeURIComponent(product.productcode || product.productdescription || "")}`,
  }));
}

async function searchRFQs(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const rfqs = await RFQ.find({
    organizationId,
    isRFQ: true,
    isArchived: { $ne: true },
    $or: [
      { reason: regex },
      { "customer.name": regex },
      { "customer.company": regex },
      { "customer.email": regex },
      { "queryProducts.name": regex },
    ],
  })
    .select("customer queryProducts reason isProcessed errorMessage createdAt emailId")
    .populate({
      path: "emailId",
      select: "subject from date snippet status",
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rfqs.map((rfq) => {
    const email = rfq.emailId as unknown as {
      subject?: string;
      from?: string;
      date?: Date;
      status?: string;
    } | null;
    const productNames = rfq.queryProducts?.map((product) => product.name).filter(Boolean) ?? [];

    return {
      type: "rfq",
      id: rfq._id.toString(),
      title: email?.subject || rfq.customer?.company || "RFQ",
      subtitle: compactSubtitle([rfq.customer?.company, rfq.customer?.email, productNames.slice(0, 2).join(", ")]),
      metadata: {
        customerCompany: rfq.customer?.company ?? null,
        customerEmail: rfq.customer?.email ?? null,
        productCount: productNames.length,
        isProcessed: rfq.isProcessed,
        hasError: Boolean(rfq.errorMessage),
        emailFrom: email?.from ?? null,
        emailStatus: email?.status ?? null,
      },
      url: `/rfq?rfq=${rfq._id.toString()}`,
    };
  });
}

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const query = normalizeQuery(req.query.q);
    const limit = parseLimit(req.query.limit);

    if (query.length < MIN_QUERY_LENGTH) {
      res.json({
        query,
        minQueryLength: MIN_QUERY_LENGTH,
        results: {
          customers: [],
          products: [],
          rfqs: [],
        },
        total: 0,
      });
      return;
    }

    const organizationObjectId = orgReq.organization._id;
    const organizationId = organizationObjectId.toString();
    const [customers, products, rfqs] = await Promise.all([
      searchCustomers(organizationObjectId, query, limit),
      searchProducts(organizationId, query, limit),
      searchRFQs(organizationObjectId, query, limit),
    ]);

    res.json({
      query,
      minQueryLength: MIN_QUERY_LENGTH,
      results: {
        customers,
        products,
        rfqs,
      },
      total: customers.length + products.length + rfqs.length,
    });
  } catch (err) {
    console.error("Error running global search:", err);
    res.status(500).json({ error: "Failed to search" });
  }
};
