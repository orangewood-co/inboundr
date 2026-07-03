import { DownloadIcon, FileUpIcon, HardDriveIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import {
  fileContentType,
  formatFileSize,
  isPreviewableFormFile,
  type FormFilePreview,
  type UploadedFileValue,
} from "@/components/forms/types"

export function FormFilePreviewDialog({
  preview,
  onOpenChange,
  onSaveToDrive,
  savingToDrive = false,
}: {
  preview: FormFilePreview | null
  onOpenChange: (open: boolean) => void
  onSaveToDrive?: (file: UploadedFileValue) => void
  savingToDrive?: boolean
}) {
  const file = preview?.file
  const type = file ? fileContentType(file) : ""
  const canPreview = file ? isPreviewableFormFile(file) : false

  return (
    <Dialog open={Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(86vh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {preview && file && (
          <>
            <DialogHeader className="border-b border-border/60 px-5 py-4 pr-16">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-sm">{file.originalName}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {(file.contentType || "Unknown type")} - {formatFileSize(file.size)}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  {onSaveToDrive && (
                    <Button size="sm" variant="outline" onClick={() => onSaveToDrive(file)} disabled={savingToDrive}>
                      {savingToDrive ? (
                        <Spinner className="size-3.5" data-icon="inline-start" />
                      ) : (
                        <HardDriveIcon className="size-3.5" data-icon="inline-start" />
                      )}
                      Save to Drive
                    </Button>
                  )}
                  {preview.downloadUrl ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={preview.downloadUrl} target="_blank" rel="noopener noreferrer" download={file.originalName}>
                        <DownloadIcon className="size-3.5" data-icon="inline-start" />
                        Download
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      <DownloadIcon className="size-3.5" data-icon="inline-start" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30">
              {preview.loading ? (
                <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                  <Spinner className="size-5" />
                  Preparing preview...
                </div>
              ) : preview.error ? (
                <div className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
                  <div className="rounded-2xl border bg-background p-5">
                    <FileUpIcon className="size-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Preview failed</p>
                    <p className="text-xs text-muted-foreground">{preview.error}</p>
                  </div>
                </div>
              ) : preview.viewUrl && canPreview && type === "application/pdf" ? (
                <iframe title={file.originalName} src={preview.viewUrl} className="size-full border-0 bg-white" />
              ) : preview.viewUrl && canPreview && type.startsWith("image/") ? (
                <div className="size-full overflow-auto p-6 text-center">
                  <img src={preview.viewUrl} alt={file.originalName} className="mx-auto max-h-full max-w-full rounded-lg object-contain shadow-lg" />
                </div>
              ) : preview.viewUrl && canPreview && type.startsWith("video/") ? (
                <video src={preview.viewUrl} controls className="max-h-full max-w-full" />
              ) : preview.viewUrl && canPreview && type.startsWith("audio/") ? (
                <div className="w-full max-w-xl rounded-2xl border bg-background p-6 shadow-sm">
                  <audio src={preview.viewUrl} controls className="w-full" />
                </div>
              ) : preview.viewUrl && canPreview && type.startsWith("text/") ? (
                <iframe title={file.originalName} src={preview.viewUrl} className="size-full border-0 bg-background" />
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-4 p-10 text-center">
                  <div className="rounded-2xl border bg-background p-5">
                    <FileUpIcon className="size-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Preview not available</p>
                    <p className="text-xs text-muted-foreground">
                      This file type is available to download, but it is not shown inline for safety.
                    </p>
                  </div>
                  {preview.downloadUrl && (
                    <Button asChild>
                      <a href={preview.downloadUrl} target="_blank" rel="noopener noreferrer" download={file.originalName}>
                        <DownloadIcon className="size-4" data-icon="inline-start" />
                        Download File
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
