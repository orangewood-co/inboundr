import { API_ORIGIN } from "@/lib/env"

const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
const CROPPED_EMPLOYEE_IMAGE_TYPE = "image/webp"

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: {
    key: string
    url: string | null
  }
}

export async function resolveUploadedImageUrl(source: string): Promise<string> {
  const value = source.trim()
  if (!value || /^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value
  }

  const response = await fetch(`${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(value)}`, {
    credentials: "include",
  })
  const data: { url?: string; error?: string } = await response.json().catch(() => ({}))
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to load image")
  }
  return data.url
}

export async function uploadEmployeeImage(file: File): Promise<{ key: string; displayUrl: string }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please upload a PNG, JPG, WebP, or SVG image.")
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Profile picture must be 2MB or smaller.")
  }

  const presignResponse = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "branding",
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  const presign: PresignedUpload | { error?: string } = await presignResponse.json()

  if (!presignResponse.ok || !("uploadUrl" in presign)) {
    throw new Error((presign as { error?: string }).error || "Failed to prepare image upload")
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image")
  }

  return {
    key: presign.file.key,
    displayUrl: await resolveUploadedImageUrl(presign.file.key),
  }
}

export async function uploadCroppedEmployeeImage(blob: Blob): Promise<{ key: string; displayUrl: string }> {
  if (blob.size > MAX_IMAGE_SIZE) {
    throw new Error("Profile picture must be 2MB or smaller.")
  }

  const presignResponse = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "employee",
      fileName: "employee-photo.webp",
      contentType: CROPPED_EMPLOYEE_IMAGE_TYPE,
      size: blob.size,
    }),
  })
  const presign: PresignedUpload | { error?: string } = await presignResponse.json()

  if (!presignResponse.ok || !("uploadUrl" in presign)) {
    throw new Error((presign as { error?: string }).error || "Failed to prepare image upload")
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: blob,
  })
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image")
  }

  return {
    key: presign.file.key,
    displayUrl: await resolveUploadedImageUrl(presign.file.key),
  }
}
