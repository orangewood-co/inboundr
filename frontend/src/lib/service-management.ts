import { useEffect } from "react"

import { API_ORIGIN } from "@/lib/env"
import { ACTIVE_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-context"

export const SERVICE_API_BASE = `${API_ORIGIN}/api/v1/service-management`

export type ServiceSystemCategory =
  | "open"
  | "waiting"
  | "resolved"
  | "closed"
  | "cancelled"
export type ServicePriority = "low" | "medium" | "high" | "critical"
export type ServiceRecordType =
  | "service_visit"
  | "spare_dispatch"
  | "root_cause_analysis"

export interface NamedOption {
  _id: string
  name: string
}

export interface CustomerOption extends NamedOption {
  company?: string
  city?: string
  customerCode?: string
}

export interface SiteOption extends NamedOption {
  customerId?: string
  city?: string
  address?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface EquipmentOption extends NamedOption {
  customerId?: string
  siteId?: string
  serialNumber?: string
  model?: string
  modelName?: string
  manufacturer?: string
  customerSiteId?: string
}

export interface EmployeeOption {
  _id: string
  fullName: string
  email?: string
  title?: string
}

export interface ServiceAttachment {
  id?: string
  _id?: string
  key: string
  originalName: string
  contentType: string
  size: number
  createdAt?: string
  uploadedByName?: string
}

export interface ServiceTicket {
  _id: string
  ticketReference?: string
  subject: string
  status: string
  priority?: string
  channel?: string
}

export interface ServiceActivity {
  _id: string
  action: string
  message?: string
  note?: string
  actorName?: string
  attachments?: ServiceAttachment[]
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface ServiceRecord {
  _id: string
  type: ServiceRecordType
  title?: string
  statusId?: string
  systemCategory: ServiceSystemCategory
  description?: string
  reference?: string
  createdByName?: string
  createdAt: string
  updatedAt?: string
}

export type ServiceReference =
  | string
  | {
      _id: string
      name?: string
      fullName?: string
      city?: string
      serialNumber?: string
    }
  | null

export interface ServiceRequest {
  _id: string
  reference: string
  customerId: ServiceReference
  customerSiteId?: ServiceReference
  installedEquipmentId?: ServiceReference
  customerSnapshot?: { name?: string; company?: string }
  siteSnapshot?: { name?: string; city?: string; address?: string }
  equipmentSnapshot?: {
    name?: string
    model?: string
    modelName?: string
    serialNumber?: string
  }
  complaintType?: string
  title: string
  description?: string
  priority: ServicePriority
  statusId: string
  systemCategory: ServiceSystemCategory
  coordinatorId?: ServiceReference
  engineerId?: ServiceReference
  assignedEmployeeIds?: ServiceReference[]
  lastActivityAt?: string
  activities?: ServiceActivity[]
  records?: ServiceRecord[]
  attachments?: ServiceAttachment[]
  tickets?: ServiceTicket[]
  closure?: {
    confirmedByCustomer?: boolean
    confirmationNote?: string
    waiverReason?: string
    closedAt?: string
    closedByName?: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface ServiceSettings {
  complaintTypes?: string[]
  priorities?: ServicePriority[]
  recordTypes?: ServiceRecordType[]
  [key: string]: unknown
}

export interface ServiceStatus {
  id: string
  label: string
  systemCategory: ServiceSystemCategory
  color: string
  isDefault: boolean
  isActive: boolean
  order: number
}

export interface ServiceSettingsResponse {
  settings: ServiceSettings
  fiscalYearStartMonth: number
  numberPadding: number
  prefixes: Record<string, string>
  statuses: ServiceStatus[]
}

export interface ServiceListResponse {
  items: ServiceRequest[]
  requests: ServiceRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface DuplicateResponse {
  error?: string
  duplicateCandidates: DuplicateCandidate[]
  message?: string
}

export interface DuplicateCandidate {
  _id: string
  reference: string
  title: string
  priority: ServicePriority
  systemCategory: ServiceSystemCategory
  createdAt: string
}

export class ServiceApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "ServiceApiError"
    this.status = status
    this.payload = payload
  }
}

export async function serviceFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${SERVICE_API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? String(
            (payload as { error?: string; message?: string }).error ??
              (payload as { message?: string }).message ??
              `Request failed (${response.status})`
          )
        : `Request failed (${response.status})`
    throw new ServiceApiError(message, response.status, payload)
  }
  return payload as T
}

export async function coreApiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Request failed")
  }
  return payload as T
}

export function referenceName(
  value: ServiceReference | undefined,
  fallback = "—"
): string {
  if (!value || typeof value === "string") return fallback
  return value.name ?? value.fullName ?? fallback
}

export function requestNumber(request: ServiceRequest): string {
  return request.reference || request._id.slice(-8).toUpperCase()
}

export const SYSTEM_CATEGORY_LABELS: Record<ServiceSystemCategory, string> = {
  open: "Open",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
}

export const PRIORITY_LABELS: Record<ServicePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function useOrganizationRefresh(reset: () => void) {
  useEffect(() => {
    window.addEventListener(ACTIVE_ORGANIZATION_CHANGED_EVENT, reset)
    return () =>
      window.removeEventListener(ACTIVE_ORGANIZATION_CHANGED_EVENT, reset)
  }, [reset])
}

interface PresignedUpload {
  uploadUrl?: string
  url?: string
  headers?: Record<string, string>
  key?: string
  file?: {
    key?: string
    bucket?: string
    originalName?: string
    contentType?: string
    size?: number
  }
  attachment?: Partial<ServiceAttachment>
}

export async function uploadServiceAttachment(
  requestId: string,
  file: File
): Promise<ServiceAttachment> {
  const presign = await serviceFetch<PresignedUpload>(
    `/requests/${requestId}/attachments/presign`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }),
    }
  )
  const uploadUrl = presign.uploadUrl ?? presign.url
  const key = presign.key ?? presign.file?.key ?? presign.attachment?.key
  if (!uploadUrl || !key) throw new Error("Upload preparation was incomplete")

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  })
  if (!uploaded.ok) throw new Error(`Failed to upload ${file.name}`)

  const metadata = {
    ...presign.file,
    ...presign.attachment,
    key,
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  }
  const result = await serviceFetch<
    ServiceAttachment | { attachment: ServiceAttachment }
  >(`/requests/${requestId}/attachments`, {
    method: "POST",
    body: JSON.stringify(metadata),
  })
  return "attachment" in result ? result.attachment : result
}

export async function openServiceAttachment(
  requestId: string,
  attachment: ServiceAttachment
) {
  const attachmentId = attachment._id ?? attachment.id
  if (!attachmentId) throw new Error("Attachment identifier unavailable")
  const data = await serviceFetch<{ url?: string; viewUrl?: string }>(
    `/requests/${requestId}/attachments/${attachmentId}/view`
  )
  const url = data.url ?? data.viewUrl
  if (!url) throw new Error("Attachment URL unavailable")
  window.open(url, "_blank", "noopener,noreferrer")
}

export function customerName(request: ServiceRequest): string {
  return (
    request.customerSnapshot?.name ??
    request.customerSnapshot?.company ??
    referenceName(request.customerId)
  )
}

export function siteCity(request: ServiceRequest): string {
  return (
    request.siteSnapshot?.city ??
    (typeof request.customerSiteId === "object"
      ? request.customerSiteId?.city
      : undefined) ??
    "—"
  )
}

export function siteName(request: ServiceRequest): string {
  return request.siteSnapshot?.name ?? referenceName(request.customerSiteId)
}

export function equipmentName(request: ServiceRequest): string {
  return (
    request.equipmentSnapshot?.name ??
    request.equipmentSnapshot?.modelName ??
    request.equipmentSnapshot?.model ??
    referenceName(request.installedEquipmentId)
  )
}

export function statusLabel(
  request: Pick<ServiceRequest, "statusId" | "systemCategory">,
  statuses: ServiceStatus[]
): string {
  return (
    statuses.find((status) => status.id === request.statusId)?.label ??
    SYSTEM_CATEGORY_LABELS[request.systemCategory]
  )
}
