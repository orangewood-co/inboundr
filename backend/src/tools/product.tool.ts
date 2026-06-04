import { tool } from "ai";
import { z } from "zod";

import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { getEmployeeAccessState } from "../services/employee-access.service";
import {
  ProductServiceError,
  createProductRecord,
  searchProductRecords,
} from "../services/product.service";

type ProductToolContext = {
  user: AuthenticatedRequest["user"];
  organization: OrganizationRequest["organization"];
  organizationMembership: OrganizationRequest["organizationMembership"];
};

const addProductSchema = z.object({
  brand: z.string().min(1).describe("Product brand or manufacturer."),
  productdescription: z.string().min(1).describe("Human-readable product description."),
  productcode: z.string().min(1).describe("Unique product code or SKU."),
  maxdiscount: z.number().optional().nullable(),
  unitprice: z.number().optional().nullable(),
  hsncode: z.string().optional().nullable(),
  gstrate: z.number().optional().nullable(),
  productlink: z.string().optional().nullable(),
  maxupsell: z.number().optional().nullable(),
  calibrationcharges: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  is_top_seller: z.boolean().optional(),
  addeduser: z.string().optional().nullable(),
});

async function ensureProductModuleAccess(context: ProductToolContext): Promise<void> {
  const access = await getEmployeeAccessState({
    organizationId: context.organization._id,
    organizationMemberId: context.organizationMembership?._id ?? null,
    role: context.organizationMembership.role,
  });

  if (!access.enabled) {
    throw new Error("Product access is disabled for this organization.");
  }

  if (access.restricted && !access.allowedModules.includes("products")) {
    throw new Error("You do not have access to the products module.");
  }
}

function ensureProductManager(context: ProductToolContext): void {
  const role = context.organizationMembership.role;
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only organization owners and admins can change products.");
  }
}

function serializeProduct(product: {
  id: number;
  brand: string | null;
  productdescription: string | null;
  productcode: string | null;
  unitprice: number | string | null;
  hsncode: string | null;
  gstrate: number | string | null;
  calibrationcharges: number | string | null;
  productlink: string | null;
  is_top_seller?: boolean | null;
}) {
  return {
    id: product.id,
    brand: product.brand,
    description: product.productdescription,
    code: product.productcode,
    price: product.unitprice == null ? null : Number(product.unitprice),
    hsnCode: product.hsncode,
    gstRate: product.gstrate == null ? null : Number(product.gstrate),
    calibrationCharges:
      product.calibrationcharges == null ? null : Number(product.calibrationcharges),
    link: product.productlink,
    isTopSeller: Boolean(product.is_top_seller),
  };
}

export function createProductTools(context: ProductToolContext) {
  return {
    searchProducts: tool({
      description:
        "Search the organization's product catalog by natural language, product code, brand, dimensions, or description.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Natural-language product query or product code."),
        limit: z.number().int().min(1).max(10).optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        await ensureProductModuleAccess(context);

        const result = await searchProductRecords({
          organizationId: context.organization._id.toString(),
          query,
          limit,
        });

        return {
          query: result.query.name,
          status: result.status,
          matches: result.matches.map((product) => ({
            id: product.id,
            brand: product.brand,
            description: product.description,
            code: product.code,
            price: product.price,
            hsnCode: product.hsnCode,
            gstRate: product.gstRate,
            calibrationCharges: product.calibrationCharges,
            link: product.link,
            isTopSeller: product.isTopSeller,
            score: product.score,
            matchReasons: product.matchReasons,
          })),
        };
      },
    }),
    addProduct: tool({
      description:
        "Add a product to the organization's catalog. Requires brand, productdescription, and productcode.",
      inputSchema: addProductSchema,
      execute: async (input) => {
        await ensureProductModuleAccess(context);
        ensureProductManager(context);

        try {
          const product = await createProductRecord(context.organization._id.toString(), {
            ...input,
            addeduser: input.addeduser ?? context.user.email ?? context.user.name ?? context.user.id,
          });

          return {
            status: "created",
            product: serializeProduct(product),
          };
        } catch (err) {
          if (err instanceof ProductServiceError && err.code === "validation") {
            return { status: "invalid", error: err.message };
          }

          throw err;
        }
      },
    }),
  };
}