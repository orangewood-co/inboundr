export type FieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "checkbox"
  | "date"
  | "file"
  | "rating"
  | "url"
  | "yes_no"

export type PublicField = {
  id: string
  label: string
  type: FieldType
  required: boolean
  description?: string | null
  placeholder?: string | null
  options?: string[]
  maxFileSizeMb?: number
  allowedMimeTypes?: string[]
  multiple?: boolean
}

export type UploadedFile = {
  key: string
  bucket: string
  originalName: string
  contentType: string
  size: number
  uploadedAt: string | null
  url: string | null
}

export type PublicFormBranding = {
  accentColor: string
  logoUrl: string | null
  backgroundType?: "solid" | "gradient" | "none"
  backgroundColor?: string | null
  backgroundGradient?: string | null
  theme?: string | null
  borderRadius?: "sm" | "md" | "lg"
}

export type PublicForm = {
  title: string
  description: string | null
  slug: string
  fields: PublicField[]
  branding: PublicFormBranding
  settings: { submitButtonLabel: string; successMessage: string }
}
