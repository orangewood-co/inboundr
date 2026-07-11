import { API_ORIGIN } from "@/lib/env"

export type CustomerFieldType = "text" | "number" | "date" | "boolean" | "select"

export interface CustomerFieldDefinition {
  id: string
  key: string
  label: string
  type: CustomerFieldType
  options: string[]
  isActive: boolean
  isSystem: boolean
  showInList: boolean
  order: number
}

export type CustomerFieldValue = string | number | boolean | null
export type CustomerFieldValues = Record<string, CustomerFieldValue>

export const SPECIAL_DISCOUNT_FIELD_ID = "system.special_discount_percentage"
export const CUSTOMER_SETTINGS_API = `${API_ORIGIN}/api/v1/customers/settings`

export function sortCustomerFields(fields: CustomerFieldDefinition[]) {
  return [...fields].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}

export function activeCustomerFields(fields: CustomerFieldDefinition[]) {
  return sortCustomerFields(fields.filter((field) => field.isActive))
}

export function isSpecialDiscountEnabled(fields: CustomerFieldDefinition[]) {
  return fields.some((field) => field.id === SPECIAL_DISCOUNT_FIELD_ID && field.isActive)
}

export function customerFieldValue(
  customer: {
    specialDiscountPercentage?: number
    customFields?: CustomerFieldValues
  },
  field: CustomerFieldDefinition,
) {
  return field.id === SPECIAL_DISCOUNT_FIELD_ID
    ? (customer.specialDiscountPercentage ?? 0)
    : (customer.customFields?.[field.id] ?? null)
}

export function formatCustomerFieldValue(
  value: CustomerFieldValue | undefined,
  field: CustomerFieldDefinition,
) {
  if (value === null || value === undefined || value === "") return "—"
  if (field.type === "boolean") return value ? "Yes" : "No"
  if (field.id === SPECIAL_DISCOUNT_FIELD_ID) return `${value}%`
  if (field.type === "date") {
    const date = new Date(`${String(value)}T00:00:00`)
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
  }
  return String(value)
}

export async function fetchCustomerSettings(signal?: AbortSignal) {
  const response = await fetch(CUSTOMER_SETTINGS_API, {
    credentials: "include",
    signal,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? "Unable to load customer fields")
  return sortCustomerFields((data?.fieldDefinitions ?? []) as CustomerFieldDefinition[])
}
