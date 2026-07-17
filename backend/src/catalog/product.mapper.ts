import type { Product } from "../types";
import type {
  CatalogAdjustment,
  CatalogAttributeValue,
  CatalogPricingPolicy,
  CatalogProduct,
} from "./catalog.types";

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordValue(value: unknown): Record<string, CatalogAttributeValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, CatalogAttributeValue>) }
    : {};
}

function adjustments(value: unknown, calibrationCharges: unknown): CatalogAdjustment[] {
  if (Array.isArray(value) && value.length > 0) return value as CatalogAdjustment[];
  const legacy = numberOrNull(calibrationCharges);
  return legacy != null && legacy > 0
    ? [{
        id: "legacy.calibration",
        code: "calibration",
        label: "Calibration",
        type: "fixed",
        value: legacy,
        taxable: false,
      }]
    : [];
}

function pricingPolicy(row: Product): CatalogPricingPolicy {
  return {
    maxDiscountPercent:
      numberOrNull(row.pricing_policy?.maxDiscountPercent) ?? numberOrNull(row.maxdiscount),
    maxMarkupPercent:
      numberOrNull(row.pricing_policy?.maxMarkupPercent) ?? numberOrNull(row.maxupsell),
  };
}

export function mapProductRow(row: Product): CatalogProduct {
  const description = row.productdescription?.trim() || null;
  return {
    id: String(row.id),
    organizationId: row.organization_id,
    name: description || row.productcode || `Product ${row.id}`,
    description,
    sku: row.productcode ?? "",
    manufacturer: row.brand?.trim() || null,
    category: row.category?.trim() || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    unitPrice: numberOrNull(row.unitprice),
    unit: row.unit?.trim() || null,
    taxCode: row.hsncode?.trim() || null,
    taxRate: numberOrNull(row.gstrate),
    url: row.productlink?.trim() || null,
    isFeatured: Boolean(row.is_top_seller),
    attributes: recordValue(row.attributes),
    defaultAdjustments: adjustments(row.default_adjustments, row.calibrationcharges),
    pricingPolicy: pricingPolicy(row),
    createdAt: row.addedtime ? new Date(row.addedtime).toISOString() : null,
    createdBy: row.addeduser?.trim() || null,
  };
}

export function withLegacyProductAliases(product: CatalogProduct) {
  const calibration = product.defaultAdjustments.find((item) => item.code === "calibration");
  return {
    ...product,
    organization_id: product.organizationId,
    brand: product.manufacturer,
    productdescription: product.description,
    productcode: product.sku,
    unitprice: product.unitPrice,
    hsncode: product.taxCode,
    gstrate: product.taxRate,
    productlink: product.url,
    maxdiscount: product.pricingPolicy.maxDiscountPercent,
    maxupsell: product.pricingPolicy.maxMarkupPercent,
    calibrationcharges: calibration?.value ?? null,
    is_top_seller: product.isFeatured,
    addedtime: product.createdAt,
    addeduser: product.createdBy,
  };
}
