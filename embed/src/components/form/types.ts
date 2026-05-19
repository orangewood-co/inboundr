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

export type PublicField = {
  id: string
  label: string
  type: FieldType
  required: boolean
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

export type PublicForm = {
  title: string
  description: string | null
  slug: string
  fields: PublicField[]
  branding: { accentColor: string; logoUrl: string | null }
  settings: { submitButtonLabel: string; successMessage: string }
}
