import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";

import {
  PRODUCT_FIELD_TYPES,
  ProductSettings,
  type IProductAdjustmentDefinition,
  type IProductFieldDefinition,
  type ProductFieldType,
} from "../models/product-settings.model";
import type { CatalogAttributeValue, CatalogAdjustment } from "../catalog/catalog.types";

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function keyFromLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function isFieldType(value: unknown): value is ProductFieldType {
  return typeof value === "string" && PRODUCT_FIELD_TYPES.includes(value as ProductFieldType);
}

export async function getOrCreateProductSettings(organizationId: Types.ObjectId) {
  return ProductSettings.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { organizationId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export function normalizeProductFieldDefinitions(
  value: unknown,
  existing: IProductFieldDefinition[] = []
): IProductFieldDefinition[] {
  if (!Array.isArray(value)) throw badRequest("Product fields must be an array");
  const existingById = new Map(existing.map((field) => [field.id, field]));
  const ids = new Set<string>();
  const keys = new Set<string>();

  return value.map((raw, index) => {
    const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const requestedId = text(input.id);
    const previous = existingById.get(requestedId);
    const label = text(input.label);
    const key = text(input.key) || previous?.key || keyFromLabel(label);
    const type = input.type ?? previous?.type;
    const id = requestedId || randomUUID();
    if (!label || !key || !isFieldType(type)) throw badRequest(`Product field ${index + 1} is invalid`);
    if (ids.has(id) || keys.has(key)) throw badRequest(`Product field "${label}" is duplicated`);
    ids.add(id);
    keys.add(key);
    const options = type === "select"
      ? [...new Set((Array.isArray(input.options) ? input.options : []).map(text).filter(Boolean))]
      : [];
    if (type === "select" && options.length === 0) throw badRequest(`Select field "${label}" needs options`);

    return {
      id,
      key,
      label,
      type,
      options,
      required: input.required === true,
      isActive: input.isActive !== false,
      showInList: input.showInList === true,
      searchable: input.searchable === true,
      importAliases: [...new Set((Array.isArray(input.importAliases) ? input.importAliases : []).map(text).filter(Boolean))],
      order: Number.isFinite(Number(input.order)) ? Number(input.order) : (index + 1) * 10,
    };
  });
}

export function normalizeProductAdjustmentDefinitions(value: unknown): IProductAdjustmentDefinition[] {
  if (!Array.isArray(value)) throw badRequest("Adjustment definitions must be an array");
  const codes = new Set<string>();
  return value.map((raw, index) => {
    const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const label = text(input.label);
    const code = (text(input.code) || keyFromLabel(label)).toLowerCase();
    const type = input.type === "percentage" ? "percentage" as const : "fixed" as const;
    const defaultValue = Number(input.defaultValue ?? 0);
    if (!label || !code || !Number.isFinite(defaultValue) || defaultValue < 0) {
      throw badRequest(`Adjustment ${index + 1} is invalid`);
    }
    if (codes.has(code)) throw badRequest(`Adjustment code "${code}" is duplicated`);
    codes.add(code);
    return {
      id: text(input.id) || randomUUID(),
      code,
      label,
      type,
      defaultValue,
      taxable: input.taxable === true,
      isActive: input.isActive !== false,
    };
  });
}

function normalizeAttributeValue(definition: IProductFieldDefinition, value: unknown): CatalogAttributeValue {
  if (value === undefined || value === null || value === "") return null;
  if (definition.type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw badRequest(`${definition.label} must be a number`);
    return parsed;
  }
  if (definition.type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = text(value).toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
    throw badRequest(`${definition.label} must be yes or no`);
  }
  if (definition.type === "date") {
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw badRequest(`${definition.label} must be a date`);
    return parsed.toISOString().slice(0, 10);
  }
  const normalized = text(value);
  if (definition.type === "select" && !definition.options.includes(normalized)) {
    throw badRequest(`${definition.label} must use a configured option`);
  }
  return normalized.slice(0, 4000);
}

export function normalizeProductAttributes(
  value: unknown,
  definitions: IProductFieldDefinition[]
): Record<string, CatalogAttributeValue> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Product attributes must be an object");
  const input = value as Record<string, unknown>;
  const active = definitions.filter((field) => field.isActive);
  const allowed = new Set(active.map((field) => field.key));
  if (Object.keys(input).some((key) => !allowed.has(key))) throw badRequest("One or more product attributes are not configured");
  const normalized = Object.fromEntries(
    active.filter((field) => field.key in input).map((field) => [field.key, normalizeAttributeValue(field, input[field.key])])
  );
  for (const field of active.filter((item) => item.required)) {
    if (normalized[field.key] == null || normalized[field.key] === "") throw badRequest(`${field.label} is required`);
  }
  return normalized;
}

export function adjustmentsFromDefinitions(
  definitions: IProductAdjustmentDefinition[]
): CatalogAdjustment[] {
  return definitions.filter((definition) => definition.isActive && definition.defaultValue > 0).map((definition) => ({
    id: definition.id,
    code: definition.code,
    label: definition.label,
    type: definition.type,
    value: definition.defaultValue,
    taxable: definition.taxable,
  }));
}
