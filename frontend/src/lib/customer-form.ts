import {
  activeCustomerFields,
  customerFieldValue,
  SPECIAL_DISCOUNT_FIELD_ID,
  type CustomerFieldDefinition,
  type CustomerFieldValues,
} from "@/lib/customer-fields"

export type CustomerFormState = {
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  notes: string
  fieldValues: CustomerFieldValues
}

export type CustomerPayload = {
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  notes: string | null
  customFields: CustomerFieldValues
  specialDiscountPercentage?: number
}

export function createEmptyCustomerForm(): CustomerFormState {
  return {
    name: "",
    company: "",
    email: "",
    contactNumber: "",
    address: "",
    notes: "",
    fieldValues: {},
  }
}

export function customerToForm(
  customer: {
    name?: string
    company?: string
    email?: string
    contactNumber?: string | null
    address?: string | null
    notes?: string | null
    specialDiscountPercentage?: number
    customFields?: CustomerFieldValues
  },
  fieldDefinitions: CustomerFieldDefinition[],
): CustomerFormState {
  return {
    name: customer.name ?? "",
    company: customer.company ?? "",
    email: customer.email ?? "",
    contactNumber: customer.contactNumber ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    fieldValues: Object.fromEntries(
      activeCustomerFields(fieldDefinitions).map((field) => [
        field.id,
        customerFieldValue(customer, field),
      ]),
    ),
  }
}

export function customerFormToPayload(
  form: CustomerFormState,
  fieldDefinitions: CustomerFieldDefinition[],
): CustomerPayload {
  const discountField = fieldDefinitions.find(
    (field) => field.id === SPECIAL_DISCOUNT_FIELD_ID && field.isActive,
  )
  const customFields = Object.fromEntries(
    activeCustomerFields(fieldDefinitions)
      .filter((field) => !field.isSystem)
      .map((field) => [field.id, form.fieldValues[field.id] ?? null]),
  )
  const discountValue = discountField
    ? Number(form.fieldValues[SPECIAL_DISCOUNT_FIELD_ID] ?? 0)
    : undefined

  return {
    name: form.name.trim(),
    company: form.company.trim(),
    email: form.email.trim(),
    contactNumber: form.contactNumber.trim(),
    address: form.address.trim(),
    notes: form.notes.trim() || null,
    customFields,
    ...(discountField
      ? {
          specialDiscountPercentage: Number.isFinite(discountValue)
            ? discountValue
            : 0,
        }
      : {}),
  }
}

export function validateCustomerPayload(payload: CustomerPayload): string | null {
  if (!payload.name || !payload.company || !payload.email) {
    return "Name, company, and email are required"
  }
  if (
    payload.specialDiscountPercentage !== undefined &&
    (payload.specialDiscountPercentage < 0 || payload.specialDiscountPercentage > 100)
  ) {
    return "Special discount must be between 0 and 100"
  }
  return null
}
