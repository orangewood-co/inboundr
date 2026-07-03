import type { ComponentType } from "react"
import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  FileUpIcon,
  HashIcon,
  Link2Icon,
  MailIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  StarIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react"

import { getEmbedOrigin, getFormsShareOrigin } from "@/lib/env"

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

export type FormField = {
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

export type FormBranding = {
  accentColor: string
  logoUrl: string | null
  backgroundType?: "solid" | "gradient" | "none"
  backgroundColor?: string | null
  backgroundGradient?: string | null
  theme?: string | null
  borderRadius?: "sm" | "md" | "lg"
}

export type FormSettings = {
  submitButtonLabel: string
  successMessage: string
  notifyOnSubmission: boolean
  collectDeviceInfo: boolean
}

export type ManagedForm = {
  _id: string
  title: string
  description: string | null
  slug: string
  status: "draft" | "published" | "archived"
  fields: FormField[]
  branding: FormBranding
  settings: FormSettings
  submissionCount: number
  updatedAt: string
  /** List-endpoint stats — absent on single-form responses. */
  newSubmissionCount?: number
  lastSubmissionAt?: string | null
  recentSubmissionDates?: string[]
}

export type FormSubmission = {
  _id: string
  values: Record<string, unknown>
  status: "new" | "reviewed" | "archived"
  source: "link" | "embed"
  createdAt: string
  metadata?: {
    device?: string | null
    os?: string | null
    browser?: string | null
    referrer?: string | null
  }
}

export type UploadedFileValue = {
  key: string
  bucket?: string
  originalName: string
  contentType?: string
  size?: number
  uploadedAt?: string | null
  url?: string | null
}

export type FormFilePreview = {
  file: UploadedFileValue
  viewUrl: string | null
  downloadUrl: string | null
  loading: boolean
  error: string | null
}

type FieldTypeMeta = {
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  short_text: { label: "Short text", description: "Single line of text", icon: TypeIcon },
  long_text: { label: "Long text", description: "Multiple lines of text", icon: MessageSquareTextIcon },
  email: { label: "Email", description: "Validated email address", icon: MailIcon },
  phone: { label: "Phone", description: "Phone number", icon: PhoneIcon },
  number: { label: "Number", description: "Numeric answer only", icon: HashIcon },
  dropdown: { label: "Dropdown", description: "Pick one from a list", icon: ChevronDownIcon },
  checkbox: { label: "Checkboxes", description: "Pick one or more options", icon: CheckSquareIcon },
  date: { label: "Date", description: "Calendar date picker", icon: CalendarIcon },
  file: { label: "File upload", description: "Collect documents or media", icon: FileUpIcon },
  rating: { label: "Rating", description: "1 to 5 star rating", icon: StarIcon },
  url: { label: "URL", description: "Website link", icon: Link2Icon },
  yes_no: { label: "Yes / No", description: "Simple binary choice", icon: ToggleLeftIcon },
}

export const FIELD_TYPE_ORDER: FieldType[] = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "checkbox",
  "date",
  "file",
  "rating",
  "url",
  "yes_no",
]

export const THEME_PRESETS = [
  { id: "minimal", label: "Minimal", accent: "#111827", bg: "#ffffff", gradient: null },
  { id: "ocean", label: "Ocean", accent: "#0369a1", bg: "#f0f9ff", gradient: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)" },
  { id: "sunset", label: "Sunset", accent: "#c2410c", bg: "#fff7ed", gradient: "linear-gradient(135deg, #fed7aa 0%, #fecaca 100%)" },
  { id: "forest", label: "Forest", accent: "#15803d", bg: "#f0fdf4", gradient: "linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)" },
  { id: "midnight", label: "Midnight", accent: "#6d28d9", bg: "#faf5ff", gradient: "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)" },
  { id: "lavender", label: "Lavender", accent: "#7c3aed", bg: "#fdf4ff", gradient: "linear-gradient(135deg, #f5d0fe 0%, #e9d5ff 100%)" },
  { id: "slate", label: "Slate", accent: "#334155", bg: "#f8fafc", gradient: "linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)" },
  { id: "rose", label: "Rose", accent: "#be123c", bg: "#fff1f2", gradient: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)" },
] as const

export function makeFieldId(): string {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function newField(type: FieldType = "short_text"): FormField {
  return {
    id: makeFieldId(),
    label: "",
    type,
    required: false,
    description: null,
    placeholder: "",
    options: type === "dropdown" || type === "checkbox" ? ["Option 1"] : [],
    maxFileSizeMb: 10,
    allowedMimeTypes: [],
    multiple: false,
  }
}

// Share links go through the backend (/f/:slug), which serves OG meta tags to
// crawlers and instantly redirects browsers to the embed form page.
export function publicFormUrl(slug: string) {
  return `${getFormsShareOrigin()}/f/${slug}`
}

// Iframes load the embed page directly — no redirect hop, no OG tags needed.
export function embedFormUrl(slug: string) {
  return `${getEmbedOrigin()}/form/${slug}`
}

export function embedSnippet(slug: string) {
  return `<iframe src="${embedFormUrl(slug)}?embed=1" width="100%" height="720" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`
}

export function isUploadedFileValue(value: unknown): value is UploadedFileValue {
  return Boolean(value && typeof value === "object" && "key" in value && "originalName" in value)
}

export function fileContentType(file: UploadedFileValue) {
  return (file.contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
}

export function isPreviewableFormFile(file: UploadedFileValue) {
  const type = fileContentType(file)
  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/")
  )
}

export function formatFileSize(size?: number) {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "Unknown size"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export const RECENT_STATS_DAYS = 14

/**
 * Buckets submission timestamps into daily counts (viewer's local days) for
 * the trailing RECENT_STATS_DAYS window, oldest day first (today is the last
 * slot).
 */
export function bucketRecentSubmissions(dates: string[] | undefined, now = new Date()): number[] {
  const buckets = new Array<number>(RECENT_STATS_DAYS).fill(0)
  if (!dates || dates.length === 0) return buckets
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  for (const raw of dates) {
    const date = new Date(raw)
    if (!Number.isFinite(date.getTime())) continue
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    // Diffing local midnights (with rounding) keeps buckets aligned to
    // calendar days even when the window crosses a DST transition, where
    // fixed 24h-day arithmetic would drift by an hour.
    const daysAgo = Math.round((startOfToday - startOfDay) / dayMs)
    const index = RECENT_STATS_DAYS - 1 - daysAgo
    if (index >= 0 && index < RECENT_STATS_DAYS) buckets[index] += 1
  }
  return buckets
}

export function formatResponseValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "originalName" in item
          ? String((item as { originalName: unknown }).originalName)
          : String(item),
      )
      .join(", ")
  }
  if (value && typeof value === "object" && "originalName" in value) {
    return String((value as { originalName: unknown }).originalName)
  }
  return String(value ?? "-")
}
