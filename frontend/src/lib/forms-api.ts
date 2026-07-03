import { API_ORIGIN } from "@/lib/env"
import type {
  FormSubmission,
  ManagedForm,
  UploadedFileValue,
} from "@/components/forms/types"

const API_BASE = `${API_ORIGIN}/api/v1/forms`
const CUSTOMERS_API_BASE = `${API_ORIGIN}/api/v1/customers`
const UPLOADS_API_BASE = `${API_ORIGIN}/api/v1/uploads`

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init })
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }
  return body as T
}

export async function listForms(): Promise<ManagedForm[]> {
  const data = await request<{ forms: ManagedForm[] }>(API_BASE)
  return data.forms
}

export async function getFormBySlug(slug: string): Promise<ManagedForm | null> {
  const forms = await listForms()
  return forms.find((form) => form.slug === slug) ?? null
}

export async function saveForm(payload: Partial<ManagedForm>): Promise<ManagedForm> {
  const isExisting = Boolean(payload._id)
  return request<ManagedForm>(isExisting ? `${API_BASE}/${payload._id}` : API_BASE, {
    method: isExisting ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function duplicateForm(id: string): Promise<ManagedForm> {
  return request<ManagedForm>(`${API_BASE}/${id}/duplicate`, { method: "POST" })
}

export async function archiveForm(id: string): Promise<void> {
  await request(`${API_BASE}/${id}`, { method: "DELETE" })
}

export type SubmissionsPage = {
  submissions: FormSubmission[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listSubmissions(
  formId: string,
  page = 1,
  limit = 20,
): Promise<SubmissionsPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return request<SubmissionsPage>(`${API_BASE}/${formId}/submissions?${params.toString()}`)
}

export async function updateSubmissionStatus(
  formId: string,
  submissionId: string,
  status: FormSubmission["status"],
): Promise<void> {
  await request(`${API_BASE}/${formId}/submissions/${submissionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
}

export async function deleteSubmission(formId: string, submissionId: string): Promise<void> {
  await request(`${API_BASE}/${formId}/submissions/${submissionId}`, { method: "DELETE" })
}

export function submissionsExportUrl(formId: string): string {
  return `${API_BASE}/${formId}/submissions/export`
}

export async function resolveUploadedFileUrl(
  file: UploadedFileValue,
  download = false,
): Promise<string> {
  const params = new URLSearchParams({ key: file.key })
  if (download) {
    params.set("download", "1")
    params.set("filename", file.originalName)
  }
  const payload = await request<{ url?: string }>(`${UPLOADS_API_BASE}/view?${params.toString()}`)
  if (!payload.url) throw new Error("Failed to load file")
  return payload.url
}

export async function createCustomer(payload: {
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  notes: string
  specialDiscountPercentage: number
}): Promise<void> {
  await request(CUSTOMERS_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}
