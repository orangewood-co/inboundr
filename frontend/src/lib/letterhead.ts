import { API_ORIGIN } from "@/lib/env"
import { resolveUploadedImageUrl } from "./uploaded-image"

export const MAX_LETTERHEADS = 10
export const MAX_LETTERHEAD_SIZE = 2 * 1024 * 1024
export const ACCEPTED_LETTERHEAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: {
    key: string
    url: string | null
  }
}

export interface UploadedLetterheadImage {
  key: string
  displayUrl: string
  originalName: string
  contentType: string
  size: number
}

export async function uploadLetterheadImage(file: File): Promise<UploadedLetterheadImage> {
  if (!ACCEPTED_LETTERHEAD_TYPES.includes(file.type)) {
    throw new Error("Please upload a PNG, JPG, WebP, or SVG image.")
  }

  if (file.size > MAX_LETTERHEAD_SIZE) {
    throw new Error("Letterhead must be 2MB or smaller.")
  }

  const presignResponse = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "letterhead",
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })
  const presign: PresignedUpload | { error?: string } = await presignResponse.json()

  if (!presignResponse.ok || !("uploadUrl" in presign)) {
    throw new Error((presign as { error?: string }).error || "Failed to prepare letterhead upload")
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload letterhead")
  }

  return {
    key: presign.file.key,
    displayUrl: await resolveUploadedImageUrl(presign.file.key),
    originalName: file.name,
    contentType: file.type,
    size: file.size,
  }
}
