export type CatalogAttributeValue = string | number | boolean | null

export interface ProductFieldDefinition {
  id: string
  key: string
  label: string
  type: "text" | "number" | "date" | "boolean" | "select"
  options: string[]
  required: boolean
  isActive: boolean
  showInList: boolean
  searchable: boolean
  importAliases: string[]
  order: number
}

export interface ProductAdjustmentDefinition {
  id: string
  code: string
  label: string
  type: "fixed" | "percentage"
  defaultValue: number
  taxable: boolean
  isActive: boolean
}

export interface ProductSettings {
  currency: string
  terminology: {
    singular: string
    plural: string
    skuLabel: string
    manufacturerLabel: string
    taxCodeLabel: string
    taxRateLabel: string
  }
  fieldDefinitions: ProductFieldDefinition[]
  adjustmentDefinitions: ProductAdjustmentDefinition[]
  search: {
    synonyms: Record<string, string[]>
    stopWords: string[]
    instructions: string
    matchThreshold: number
    ambiguityGap: number
  }
}

export interface CatalogAdjustment {
  id: string
  code: string
  label: string
  type: "fixed" | "percentage"
  value: number
  amount?: number
  taxable: boolean
}

export function formatCatalogMoney(
  value: number | string | null | undefined,
  currency = "INR"
): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "Price pending"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(number)
  } catch {
    return `${currency} ${number.toFixed(2)}`
  }
}

export function legacyCalibrationAdjustment(value: unknown): CatalogAdjustment[] {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0
    ? [{
        id: "legacy.calibration",
        code: "calibration",
        label: "Calibration",
        type: "fixed",
        value: amount,
        taxable: false,
      }]
    : []
}
