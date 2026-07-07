import { API_ORIGIN } from "@/lib/env"

export const ASSETS_API_BASE = `${API_ORIGIN}/api/v1/assets`

export type AssetDepreciationMethod = "straight_line" | "written_down_value"
export type AssetLifecycleStatus = "draft" | "active" | "sold" | "scrapped"
export type AssetCondition =
  | "in_use"
  | "in_storage"
  | "in_repair"
  | "out_of_order"

export interface AssetCategory {
  _id: string
  name: string
  description: string
  depreciationMethod: AssetDepreciationMethod
  usefulLifeMonths: number
  salvagePercentage: number
  wdvRatePercentage: number
}

export interface AssetLocation {
  _id: string
  name: string
  address: string
  notes: string
}

export interface AssetScheduleRow {
  periodStartDate: string
  periodEndDate: string
  depreciationAmount: number
  accumulatedDepreciation: number
  bookValueAtEnd: number
  source: "auto" | "adjustment"
}

export interface AssetRepair {
  id: string
  date: string
  description: string
  cost: number
  loggedBy: string | null
  createdAt: string
}

export interface AssetValueAdjustment {
  id: string
  date: string
  previousBookValue: number
  newValue: number
  reason: string
  createdAt: string
}

export interface AssetDisposal {
  type: "sold" | "scrapped"
  date: string
  saleAmount: number
  buyerName: string
  notes: string
  bookValueAtDisposal: number
  gainLoss: number
}

export interface AssetAttachment {
  id: string
  key: string
  originalName: string
  contentType: string
  size: number
  createdAt: string
}

export interface AssetDepreciationParams {
  method: AssetDepreciationMethod
  usefulLifeMonths: number
  salvagePercentage: number
  wdvRatePercentage: number
  openingAccumulatedDepreciation: number
}

interface PopulatedRef {
  _id: string
  name?: string
  fullName?: string
  email?: string
  title?: string
  address?: string
}

export interface Asset {
  _id: string
  assetCode: string
  name: string
  serialNumber: string
  description: string
  categoryId: PopulatedRef | string | null
  purchaseDate: string | null
  purchaseCost: number
  vendorName: string
  invoiceReference: string
  availableForUseDate: string | null
  depreciation: AssetDepreciationParams
  depreciationSchedule: AssetScheduleRow[]
  assignedEmployeeId: PopulatedRef | string | null
  locationId: PopulatedRef | string | null
  lifecycleStatus: AssetLifecycleStatus
  condition: AssetCondition
  warrantyExpiryDate: string | null
  amcExpiryDate: string | null
  repairs: AssetRepair[]
  valueAdjustments: AssetValueAdjustment[]
  disposal: AssetDisposal | null
  attachments: AssetAttachment[]
  /** Photo gallery; the first image is the cover. */
  images: AssetAttachment[]
  currentBookValue: number
  createdAt: string
  updatedAt: string
}

export interface AssetActivityEntry {
  _id: string
  type: string
  actorName: string
  message: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface AssetStats {
  totalAssets: number
  draftAssets: number
  activeAssets: number
  disposedAssets: number
  totalPurchaseCost: number
  currentBookValue: number
  inRepair: number
  warrantyExpiringSoon: number
}

export const LIFECYCLE_STATUS_LABELS: Record<AssetLifecycleStatus, string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  scrapped: "Scrapped",
}

export const CONDITION_LABELS: Record<AssetCondition, string> = {
  in_use: "In use",
  in_storage: "In storage",
  in_repair: "In repair",
  out_of_order: "Out of order",
}

export const DEPRECIATION_METHOD_LABELS: Record<
  AssetDepreciationMethod,
  string
> = {
  straight_line: "Straight line",
  written_down_value: "Written down value",
}

export function populatedRef(value: Asset["categoryId"]): PopulatedRef | null {
  if (!value || typeof value === "string") return null
  return value
}

export function formatInr(value: number | null | undefined): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number)
}

export function formatInrExact(value: number | null | undefined): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number)
}

export async function assetsFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${ASSETS_API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed")
  }
  return payload as T
}

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: { key: string }
}

export async function uploadAssetAttachment(file: File): Promise<{
  key: string
  originalName: string
  contentType: string
  size: number
}> {
  const presignResponse = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "asset",
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  })
  const presign: PresignedUpload | { error?: string } =
    await presignResponse.json()
  if (!presignResponse.ok || !("uploadUrl" in presign)) {
    throw new Error(
      (presign as { error?: string }).error || `Unable to upload ${file.name}`
    )
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload ${file.name}`)
  }

  return {
    key: presign.file.key,
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  }
}

export const MAX_ASSET_IMAGES = 8
export const ASSET_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
const ASSET_IMAGE_MAX_BYTES = 10 * 1024 * 1024

export async function uploadAssetImage(file: File): Promise<{
  key: string
  originalName: string
  contentType: string
  size: number
}> {
  if (!ASSET_IMAGE_MIME_TYPES.includes(file.type)) {
    throw new Error(`${file.name} must be a JPG, PNG, or WebP image`)
  }
  if (file.size > ASSET_IMAGE_MAX_BYTES) {
    throw new Error(`${file.name} must be 10MB or smaller`)
  }
  return uploadAssetAttachment(file)
}

const imageUrlCache = new Map<string, Promise<string>>()

/** Presigned view URL for an asset image key, cached per session. */
export function resolveAssetImageUrl(key: string): Promise<string> {
  const cached = imageUrlCache.get(key)
  if (cached) return cached

  const promise = fetch(
    `${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(key)}`,
    { credentials: "include" }
  )
    .then(async (response) => {
      const data: { url?: string; error?: string } = await response
        .json()
        .catch(() => ({}))
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to load image")
      }
      return data.url
    })
    .catch((err) => {
      // Presigned URLs are transient; do not cache failures.
      imageUrlCache.delete(key)
      throw err
    })

  imageUrlCache.set(key, promise)
  return promise
}

export async function openAssetAttachment(
  key: string,
  fileName: string
): Promise<void> {
  const response = await fetch(
    `${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(key)}&filename=${encodeURIComponent(fileName)}`,
    { credentials: "include" }
  )
  const data: { url?: string; error?: string } = await response
    .json()
    .catch(() => ({}))
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to open attachment")
  }
  window.open(data.url, "_blank", "noopener,noreferrer")
}
