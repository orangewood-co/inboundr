import { API_ORIGIN } from "./env"

const BASE = `${API_ORIGIN}/api/v1/public/recruitment`

export type VisibilityCondition = {
  fieldId: string
  operator: "equals" | "not_equals"
  value: string | number | boolean
}

export type CareersField = {
  id: string
  label: string
  type: "short_text" | "long_text" | "email" | "phone" | "number" | "dropdown" | "checkbox" | "date" | "file" | "rating" | "url" | "yes_no"
  required: boolean
  description?: string | null
  placeholder?: string | null
  options?: string[]
  maxFileSizeMb?: number
  allowedMimeTypes?: string[]
  multiple?: boolean
  visibilityCondition?: VisibilityCondition | null
}

export type UploadedResume = {
  key: string
  fileName: string
  originalName: string
  contentType: string
  size: number
}

export type CareersSite = {
  organizationPath: string
  organizationName: string
  website: string
  headline: string
  intro: string
  seoTitle: string
  seoDescription: string
  socialShareText: string
  bannerUrl: string | null
  socialLinks: Array<{ label: string; url: string }>
  privacyPolicyUrl: string | null
  branding: { primaryColor: string; logoUrl: string | null }
  seo: { title: string; description: string; image: string | null; canonicalPath: string }
  share: { path: string; title: string; text: string }
}

export type CareersJob = {
  id: string
  slug: string
  title: string
  department: string
  location: string
  employmentType: string
  workplaceType: "onsite" | "hybrid" | "remote" | null
  openings: number
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  salaryPeriod: "hour" | "month" | "year"
  salaryVisible: boolean
  publishedAt: string
  applicationDeadline: string | null
  acceptingApplications: boolean
  deadlineClosed: boolean
  description?: string
  requirements?: string
  applicationForm?: {
    schemaVersion: 1
    fields: CareersField[]
    lockedFields: Array<CareersField & { locked: true; version?: string }>
  }
  seo: { title: string; description: string; image?: string | null; canonicalPath: string }
  share: { path: string; title: string; text: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? "Careers request failed")
  return data as T
}

export const careersApi = {
  site: (path: string) => request<{ careers: CareersSite }>(`/${encodeURIComponent(path)}`),
  jobs: (path: string) => request<{ items: CareersJob[]; total: number }>(`/${encodeURIComponent(path)}/jobs?limit=50`),
  job: (path: string, slug: string) => request<{ job: CareersJob }>(`/${encodeURIComponent(path)}/jobs/${encodeURIComponent(slug)}`),
  upload: async (
    path: string,
    slug: string,
    file: File,
    options: { fieldId?: string; contentType?: string; turnstileToken?: string; uploadSession?: string } = {}
  ): Promise<{ file: UploadedResume; uploadSession: string }> => {
    const contentType = options.fieldId ? options.contentType : inferDocumentMimeType(file)
    if (!contentType) throw new Error("Choose a PDF or DOCX file")
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("File must be 10MB or smaller")
    const preparation = await request<{
      uploadUrl?: string
      url?: string
      key?: string
      file?: { key?: string }
      headers?: Record<string, string>
      uploadSession?: string
    }>(`/${encodeURIComponent(path)}/jobs/${encodeURIComponent(slug)}/resume/presign`, {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        originalName: file.name,
        contentType,
        size: file.size,
        fieldId: options.fieldId,
        turnstileToken: options.turnstileToken,
        uploadSession: options.uploadSession,
      }),
    })
    const uploadUrl = preparation.uploadUrl ?? preparation.url
    const key = preparation.file?.key ?? preparation.key
    if (!uploadUrl || !key || !preparation.uploadSession) throw new Error("Upload preparation was incomplete")
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: preparation.headers, body: file })
    if (!uploaded.ok) throw new Error(`Could not upload ${file.name}`)
    return {
      file: { key, fileName: file.name, originalName: file.name, contentType, size: file.size },
      uploadSession: preparation.uploadSession,
    }
  },
  apply: (path: string, slug: string, body: Record<string, unknown>) =>
    request<{ accepted: true; message: string }>(`/${encodeURIComponent(path)}/jobs/${encodeURIComponent(slug)}/applications`, { method: "POST", body: JSON.stringify(body) }),
}

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

export function inferDocumentMimeType(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().split(".").pop() ?? ""
  const inferred = DOCUMENT_MIME_BY_EXTENSION[extension]
  if (!inferred) return null
  return !file.type || file.type === "application/octet-stream" || file.type === inferred ? inferred : null
}

const COMMON_MIME_BY_EXTENSION: Record<string, string> = {
  ...DOCUMENT_MIME_BY_EXTENSION,
  doc: "application/msword",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export function inferFileMimeType(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().split(".").pop() ?? ""
  const inferred = COMMON_MIME_BY_EXTENSION[extension]
  const reported = file.type.trim().toLowerCase()
  if (inferred) return !reported || reported === "application/octet-stream" || reported === inferred ? inferred : null
  return reported && reported !== "application/octet-stream" ? reported : null
}

export function publicCareersPath(organizationPath: string, jobSlug?: string | null) {
  return `/careers/${encodeURIComponent(organizationPath)}${jobSlug ? `/jobs/${encodeURIComponent(jobSlug)}` : ""}`
}

export function isVisible(field: CareersField, answers: Record<string, unknown>) {
  const condition = field.visibilityCondition
  if (!condition) return true
  const current = answers[condition.fieldId]
  const equal = String(current ?? "") === String(condition.value ?? "")
  return condition.operator === "equals" ? equal : !equal
}
