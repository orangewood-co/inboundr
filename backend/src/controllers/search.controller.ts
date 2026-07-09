import { Pool } from "pg";
import type { Request, Response } from "express";
import { Customer } from "../models/customer.model";
import { RFQ, type IRFQ } from "../models/rfq.model";
import { Asset } from "../models/asset.model";
import { Invoice } from "../models/invoice.model";
import { Employee } from "../models/employee.model";
import { Project } from "../models/project.model";
import { Ticket } from "../models/ticket.model";
import { Form } from "../models/form.model";
import { ShortLink } from "../models/short-link.model";
import { DriveNode } from "../models/drive-node.model";
import {
  getCurrentProjectEmployee,
  readableProjectFilter,
} from "../services/project-access.service";
import { canRoleView, getEffectiveDriveRole } from "../services/drive-access.service";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import type { DatabaseConfig, Product } from "../types";

type SearchType =
  | "customer"
  | "product"
  | "rfq"
  | "asset"
  | "invoice"
  | "employee"
  | "project"
  | "ticket"
  | "form"
  | "link"
  | "driveFile";

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
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const rfqs = await RFQ.find({
    organizationId,
    userId,
    isRFQ: true,
    isArchived: { $ne: true },
    $or: [
      { quoteNumber: regex },
      { reason: regex },
      { "customer.name": regex },
      { "customer.company": regex },
      { "customer.email": regex },
      { "queryProducts.name": regex },
    ],
  })
    .select("customer queryProducts reason isProcessed errorMessage createdAt emailId quoteNumber")
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
      subtitle: compactSubtitle([
        rfq.quoteNumber ? `Quote ${rfq.quoteNumber}` : null,
        rfq.customer?.company,
        rfq.customer?.email,
        productNames.slice(0, 2).join(", "),
      ]),
      metadata: {
        quoteNumber: rfq.quoteNumber ?? null,
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

async function searchAssets(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const assets = await Asset.find({
    organizationId,
    $or: [
      { name: regex },
      { assetCode: regex },
      { serialNumber: regex },
      { vendorName: regex },
    ],
  })
    .select("name assetCode serialNumber vendorName lifecycleStatus condition updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return assets.map((asset) => ({
    type: "asset",
    id: asset._id.toString(),
    title: asset.name,
    subtitle: compactSubtitle([asset.assetCode, asset.serialNumber, asset.vendorName]),
    metadata: {
      assetCode: asset.assetCode,
      serialNumber: asset.serialNumber || null,
      vendorName: asset.vendorName || null,
      lifecycleStatus: asset.lifecycleStatus,
      condition: asset.condition,
    },
    url: `/assets/${asset._id.toString()}`,
  }));
}

async function searchInvoices(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const invoices = await Invoice.find({
    organizationId,
    archivedAt: null,
    $or: [
      { invoiceNumber: regex },
      { "customerSnapshot.name": regex },
      { "customerSnapshot.company": regex },
      { "customerSnapshot.email": regex },
      { poNumber: regex },
    ],
  })
    .select("invoiceNumber status customerSnapshot totals dueDate updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return invoices.map((invoice) => ({
    type: "invoice",
    id: invoice._id.toString(),
    title: `Invoice ${invoice.invoiceNumber}`,
    subtitle: compactSubtitle([
      invoice.customerSnapshot?.company || invoice.customerSnapshot?.name,
      invoice.status?.replace(/_/g, " "),
    ]),
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      customerName: invoice.customerSnapshot?.name ?? null,
      customerCompany: invoice.customerSnapshot?.company ?? null,
      grandTotal: invoice.totals?.grandTotal ?? null,
      balanceDue: invoice.totals?.balanceDue ?? null,
    },
    url: `/invoices/${invoice._id.toString()}`,
  }));
}

async function searchEmployees(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const employees = await Employee.find({
    organizationId,
    status: { $ne: "archived" },
    $or: [
      { fullName: regex },
      { email: regex },
      { phone: regex },
      { title: regex },
      { employeeCode: regex },
    ],
  })
    .select("fullName email phone title employeeCode status updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return employees.map((employee) => ({
    type: "employee",
    id: employee._id.toString(),
    title: employee.fullName,
    subtitle: compactSubtitle([employee.title, employee.email, employee.employeeCode]),
    metadata: {
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone ?? null,
      title: employee.title ?? null,
      employeeCode: employee.employeeCode ?? null,
      status: employee.status,
    },
    url: `/employees/${employee._id.toString()}`,
  }));
}

async function searchTickets(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const or: Record<string, unknown>[] = [
    { subject: regex },
    { ticketReference: regex },
    { "requester.name": regex },
    { "requester.email": regex },
  ];
  const asNumber = Number(query.replace(/^#/, "").replace(/^SR-?/i, ""));
  if (Number.isInteger(asNumber) && asNumber > 0) {
    or.push({ ticketNumber: asNumber });
  }

  const tickets = await Ticket.find({
    organizationId,
    isArchived: { $ne: true },
    channel: { $in: ["chat", "phone"] },
    $or: or,
  })
    .select("subject ticketNumber ticketReference status priority requester lastMessageAt")
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean();

  return tickets.map((ticket) => ({
    type: "ticket",
    id: ticket._id.toString(),
    title: ticket.subject || `Ticket #${ticket.ticketNumber}`,
    subtitle: compactSubtitle([
      ticket.ticketReference || `#${ticket.ticketNumber}`,
      ticket.requester?.name,
      ticket.status,
    ]),
    metadata: {
      ticketNumber: ticket.ticketNumber,
      ticketReference: ticket.ticketReference || null,
      status: ticket.status,
      priority: ticket.priority,
      requesterName: ticket.requester?.name ?? null,
      requesterEmail: ticket.requester?.email ?? null,
    },
    url: `/support/${ticket._id.toString()}`,
  }));
}

async function searchForms(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const forms = await Form.find({
    organizationId,
    status: { $ne: "archived" },
    $or: [{ title: regex }, { slug: regex }, { description: regex }],
  })
    .select("title slug description status updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return forms.map((form) => ({
    type: "form",
    id: form._id.toString(),
    title: form.title,
    subtitle: compactSubtitle([form.slug, form.status, form.description ?? undefined]),
    metadata: {
      slug: form.slug,
      status: form.status,
      description: form.description ?? null,
    },
    url: `/forms/${encodeURIComponent(form.slug)}`,
  }));
}

async function searchLinks(
  organizationId: OrganizationRequest["organization"]["_id"],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const links = await ShortLink.find({
    organizationId,
    status: { $ne: "archived" },
    $or: [{ code: regex }, { title: regex }, { destinationUrl: regex }],
  })
    .select("code title destinationUrl status viewCount updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return links.map((link) => ({
    type: "link",
    id: link._id.toString(),
    title: link.title || `/${link.code}`,
    subtitle: compactSubtitle([`/${link.code}`, link.destinationUrl]),
    metadata: {
      code: link.code,
      destinationUrl: link.destinationUrl,
      status: link.status,
      viewCount: link.viewCount,
    },
    url: `/links/${link._id.toString()}`,
  }));
}

async function searchProjects(
  orgReq: OrganizationRequest,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  const employee = await getCurrentProjectEmployee(orgReq);
  const accessFilter = readableProjectFilter(orgReq, employee);

  const projects = await Project.find({
    $and: [accessFilter, { $or: [{ title: regex }, { description: regex }] }],
  })
    .select("title description status dueDate updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return projects.map((project) => ({
    type: "project",
    id: project._id.toString(),
    title: project.title,
    subtitle: compactSubtitle([project.status, project.description ?? undefined]),
    metadata: {
      status: project.status,
      description: project.description ?? null,
      dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    },
    url: `/projects/${project._id.toString()}`,
  }));
}

async function searchDriveFiles(
  orgReq: OrganizationRequest,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const regex = new RegExp(escapeRegex(query), "i");
  // Over-fetch so permission filtering still leaves enough results.
  const candidates = await DriveNode.find({
    organizationId: orgReq.organization._id,
    status: "active",
    type: "file",
    name: regex,
  })
    .select("name contentType size parentId ownerUserId createdByUserId updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit * 5)
    .lean();

  const results: SearchResult[] = [];
  for (const node of candidates) {
    if (results.length >= limit) break;
    const role = await getEffectiveDriveRole({
      node: node as Parameters<typeof getEffectiveDriveRole>[0]["node"],
      userId: orgReq.user.id,
      organizationRole: orgReq.organizationMembership.role,
    });
    if (!canRoleView(role)) continue;

    results.push({
      type: "driveFile",
      id: node._id.toString(),
      title: node.name,
      subtitle: compactSubtitle([node.contentType, formatFileSize(node.size)]),
      metadata: {
        contentType: node.contentType ?? null,
        size: node.size ?? null,
      },
      url: "/drive",
    });
  }

  return results;
}

function formatFileSize(size: number | null | undefined): string | null {
  if (!size || size <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const authReq = req as AuthenticatedRequest;
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
          assets: [],
          invoices: [],
          employees: [],
          projects: [],
          tickets: [],
          forms: [],
          links: [],
          driveFiles: [],
        },
        total: 0,
      });
      return;
    }

    const organizationObjectId = orgReq.organization._id;
    const organizationId = organizationObjectId.toString();
    const [
      customers,
      products,
      rfqs,
      assets,
      invoices,
      employees,
      projects,
      tickets,
      forms,
      links,
      driveFiles,
    ] = await Promise.all([
      searchCustomers(organizationObjectId, query, limit),
      searchProducts(organizationId, query, limit),
      searchRFQs(organizationObjectId, authReq.user.id, query, limit),
      searchAssets(organizationObjectId, query, limit),
      searchInvoices(organizationObjectId, query, limit),
      searchEmployees(organizationObjectId, query, limit),
      searchProjects(orgReq, query, limit),
      searchTickets(organizationObjectId, query, limit),
      searchForms(organizationObjectId, query, limit),
      searchLinks(organizationObjectId, query, limit),
      searchDriveFiles(orgReq, query, limit),
    ]);

    const results = {
      customers,
      products,
      rfqs,
      assets,
      invoices,
      employees,
      projects,
      tickets,
      forms,
      links,
      driveFiles,
    };

    res.json({
      query,
      minQueryLength: MIN_QUERY_LENGTH,
      results,
      total: Object.values(results).reduce((sum, group) => sum + group.length, 0),
    });
  } catch (err) {
    console.error("Error running global search:", err);
    res.status(500).json({ error: "Failed to search" });
  }
};
