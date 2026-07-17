export type CatalogAttributeValue = string | number | boolean | null;

export type CatalogAdjustmentType = "fixed" | "percentage";

export interface CatalogAdjustment {
  id: string;
  code: string;
  label: string;
  type: CatalogAdjustmentType;
  value: number;
  taxable: boolean;
}

export interface CatalogPricingPolicy {
  maxDiscountPercent: number | null;
  maxMarkupPercent: number | null;
}

export interface CatalogProduct {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  sku: string;
  manufacturer: string | null;
  category: string | null;
  tags: string[];
  unitPrice: number | null;
  unit: string | null;
  taxCode: string | null;
  taxRate: number | null;
  url: string | null;
  isFeatured: boolean;
  attributes: Record<string, CatalogAttributeValue>;
  defaultAdjustments: CatalogAdjustment[];
  pricingPolicy: CatalogPricingPolicy;
  createdAt: string | null;
  createdBy: string | null;
}

export interface CatalogProductInput {
  name?: unknown;
  description?: unknown;
  sku?: unknown;
  manufacturer?: unknown;
  category?: unknown;
  tags?: unknown;
  unitPrice?: unknown;
  unit?: unknown;
  taxCode?: unknown;
  taxRate?: unknown;
  url?: unknown;
  isFeatured?: unknown;
  attributes?: unknown;
  defaultAdjustments?: unknown;
  pricingPolicy?: unknown;
}

export interface RequestedCatalogItem {
  description: string;
  quantity: number;
  sku: string | null;
  manufacturer: string | null;
  specifications: Record<string, string>;
}

export interface QuoteLineAdjustment extends CatalogAdjustment {
  amount: number;
}

export interface QuoteTax {
  code: string | null;
  rate: number | null;
  label: string;
}
