import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";

import {
  CUSTOMER_FIELD_TYPES,
  CustomerSettings,
  SPECIAL_DISCOUNT_FIELD_ID,
  type CustomerFieldType,
  type ICustomerFieldDefinition,
} from "../models/customer-settings.model";

export type CustomerFieldValue = string | number | boolean | null;
export type CustomerFieldValues = Record<string, CustomerFieldValue>;

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function isFieldType(value: unknown): value is CustomerFieldType {
  return typeof value === "string" && CUSTOMER_FIELD_TYPES.includes(value as CustomerFieldType);
}

export async function getOrCreateCustomerSettings(organizationId: Types.ObjectId) {
  return CustomerSettings.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { organizationId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export function normalizeCustomerFieldDefinitions(
  value: unknown,
  existing: ICustomerFieldDefinition[] = []
): ICustomerFieldDefinition[] {
  if (!Array.isArray(value)) throw badRequest("Customer fields must be an array");

  const existingById = new Map(existing.map((field) => [field.id, field]));
  const ids = new Set<string>();
  const keys = new Set<string>();

  return value.map((raw, index) => {
    const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const requestedId = stringValue(input.id);
    const previous = requestedId ? existingById.get(requestedId) : undefined;
    const isSystem = previous?.isSystem === true;
    const id = isSystem
      ? previous.id
      : requestedId && !requestedId.startsWith("system.")
        ? requestedId
        : randomUUID();
    const label = stringValue(input.label);
    const type = isSystem ? previous.type : input.type;
    const key = isSystem ? previous.key : stringValue(input.key) || fieldKey(label);

    if (!label) throw badRequest(`Customer field ${index + 1} needs a label`);
    if (!key) throw badRequest(`Customer field "${label}" needs a valid key`);
    if (!isFieldType(type)) throw badRequest(`Customer field "${label}" has an invalid type`);
    if (ids.has(id)) throw badRequest(`Customer field id "${id}" is duplicated`);
    if (keys.has(key)) throw badRequest(`Customer field key "${key}" is duplicated`);
    ids.add(id);
    keys.add(key);

    const options =
      type === "select"
        ? [...new Set((Array.isArray(input.options) ? input.options : []).map(stringValue).filter(Boolean))]
        : [];
    if (type === "select" && options.length === 0) {
      throw badRequest(`Select field "${label}" needs at least one option`);
    }

    return {
      id,
      key,
      label,
      type,
      options,
      isActive: input.isActive !== false,
      isSystem,
      showInList: input.showInList === true,
      order: Number.isFinite(Number(input.order)) ? Number(input.order) : (index + 1) * 10,
    };
  });
}

function normalizeFieldValue(
  definition: ICustomerFieldDefinition,
  value: unknown
): CustomerFieldValue {
  if (value === undefined || value === null || value === "") return null;

  switch (definition.type) {
    case "text":
      return String(value).trim().slice(0, 4000);
    case "number": {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) {
        throw badRequest(`${definition.label} must be a number`);
      }
      return numberValue;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      {
        const booleanValue = typeof value === "string" ? value.trim().toLowerCase() : value;
        if (booleanValue === "true" || booleanValue === "yes" || booleanValue === "1" || booleanValue === 1) return true;
        if (booleanValue === "false" || booleanValue === "no" || booleanValue === "0" || booleanValue === 0) return false;
      }
      throw badRequest(`${definition.label} must be yes or no`);
    case "date": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) throw badRequest(`${definition.label} must be a valid date`);
      return date.toISOString().slice(0, 10);
    }
    case "select": {
      const option = String(value).trim();
      if (!definition.options.includes(option)) {
        throw badRequest(`${definition.label} must use one of its configured options`);
      }
      return option;
    }
  }
}

export function normalizeCustomerFieldValues(
  value: unknown,
  definitions: ICustomerFieldDefinition[]
): CustomerFieldValues {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Custom customer fields must be an object");
  }

  const input = value as Record<string, unknown>;
  const activeCustomDefinitions = definitions.filter((field) => field.isActive && !field.isSystem);
  const allowedIds = new Set(activeCustomDefinitions.map((field) => field.id));
  const unknownIds = Object.keys(input).filter((id) => !allowedIds.has(id));
  if (unknownIds.length > 0) throw badRequest("One or more customer fields are not configured");

  return Object.fromEntries(
    activeCustomDefinitions
      .filter((field) => field.id in input)
      .map((field) => [field.id, normalizeFieldValue(field, input[field.id])])
  );
}

export function activeCustomerFields(definitions: ICustomerFieldDefinition[]) {
  return [...definitions]
    .filter((field) => field.isActive)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function isSpecialDiscountEnabled(definitions: ICustomerFieldDefinition[]): boolean {
  return definitions.some(
    (field) => field.id === SPECIAL_DISCOUNT_FIELD_ID && field.isActive
  );
}

export function customerCustomFieldsToObject(value: unknown): CustomerFieldValues {
  if (value instanceof Map) return Object.fromEntries(value.entries()) as CustomerFieldValues;
  if (value && typeof value === "object") return { ...(value as CustomerFieldValues) };
  return {};
}
