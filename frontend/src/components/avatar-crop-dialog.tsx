import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { ZoomInIcon, ZoomOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { getCroppedWebpBlob, uploadAvatar } from "@/lib/avatar"

export interface AvatarCropResult {
  key: string
  displayUrl: string
}

interface AvatarCropDialogProps {
  open: boolean
  imageSrc: string | null
  title?: string
  description?: string
  saveLabel?: string
  upload?: (blob: Blob) => Promise<AvatarCropResult>
  onOpenChange: (open: boolean) => void
  onUploaded: (result: AvatarCropResult) => void
  onError?: (message: string) => void
}

export function AvatarCropDialog({
  open,
  imageSrc,
  title = "Crop Profile Picture",
  description = "Drag to reposition and zoom to frame your photo.",
  saveLabel = "Save Photo",
  upload = uploadAvatar,
  onOpenChange,
  onUploaded,
  onError,
}: AvatarCropDialogProps) {
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(next) => (!saving ? onOpenChange(next) : undefined)}>
      {open ? (
        <AvatarCropDialogContent
          key={imageSrc ?? "empty"}
          imageSrc={imageSrc}
          title={title}
          description={description}
          saveLabel={saveLabel}
          upload={upload}
          saving={saving}
          setSaving={setSaving}
          onOpenChange={onOpenChange}
          onUploaded={onUploaded}
          onError={onError}
        />
      ) : null}
    </Dialog>
  )
}

function AvatarCropDialogContent({
  imageSrc,
  title,
  description,
  saveLabel,
  upload,
  saving,
  setSaving,
  onOpenChange,
  onUploaded,
  onError,
}: Required<Pick<AvatarCropDialogProps, "title" | "description" | "saveLabel" | "upload">> &
  Pick<AvatarCropDialogProps, "imageSrc" | "onOpenChange" | "onUploaded" | "onError"> & {
    saving: boolean
    setSaving: (saving: boolean) => void
  }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return

    setSaving(true)
    try {
      const blob = await getCroppedWebpBlob(imageSrc, croppedAreaPixels)
      const result = await upload(blob)
      onUploaded(result)
      onOpenChange(false)
    } catch (err: any) {
      onError?.(err?.message || "Failed to update profile picture")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="relative h-72 w-full overflow-hidden rounded-xl bg-muted">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <ZoomOutIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          aria-label="Zoom"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        <ZoomInIcon className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !croppedAreaPixels}>
          {saving && <Spinner data-icon="inline-start" />}
          {saveLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
