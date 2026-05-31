import { resolveUploadedImageUrl } from "./uploaded-image"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const OUTPUT_SIZE = 512
const OUTPUT_TYPE = "image/webp"
const OUTPUT_QUALITY = 0.9

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: {
    key: string
    url: string | null
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Failed to load image"))
    image.src = src
  })
}

export async function getCroppedWebpBlob(imageSrc: string, crop: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not get canvas context")
  }

  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Failed to encode image"))
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    )
  })
}

export async function uploadAvatar(blob: Blob): Promise<{ key: string; displayUrl: string }> {
  const presignResponse = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: "avatar",
      fileName: "avatar.webp",
      contentType: OUTPUT_TYPE,
      size: blob.size,
    }),
  })
  const presign: PresignedUpload | { error?: string } = await presignResponse.json()

  if (!presignResponse.ok || !("uploadUrl" in presign)) {
    throw new Error((presign as { error?: string }).error || "Failed to prepare avatar upload")
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: blob,
  })
  if (!uploadResponse.ok) {
    throw new Error("Failed to upload avatar")
  }

  return {
    key: presign.file.key,
    displayUrl: await resolveUploadedImageUrl(presign.file.key),
  }
}
