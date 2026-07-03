import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  DownloadIcon,
  EyeIcon,
  InboxIcon,
  MonitorSmartphoneIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { DriveFolderPickerDialog } from "@/components/drive/drive-folder-picker-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"
import { saveFormSubmissionFileToDrive } from "@/lib/drive"
import {
  createCustomer,
  deleteSubmission as apiDeleteSubmission,
  listSubmissions,
  resolveUploadedFileUrl,
  submissionsExportUrl,
  updateSubmissionStatus as apiUpdateSubmissionStatus,
  type SubmissionsPage,
} from "@/lib/forms-api"
import { cn } from "@/lib/utils"
import { FormFilePreviewDialog } from "@/components/forms/form-file-preview-dialog"
import {
  formatResponseValue,
  isUploadedFileValue,
  type FormField,
  type FormFilePreview,
  type FormSubmission,
  type UploadedFileValue,
} from "@/components/forms/types"

const PAGE_SIZE = 20

export function ResponsesTab({
  formId,
  fields,
  collectDeviceInfo,
  onTotalChange,
}: {
  formId: string
  fields: FormField[]
  collectDeviceInfo: boolean
  onTotalChange?: (total: number) => void
}) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filePreview, setFilePreview] = useState<FormFilePreview | null>(null)
  const [driveSaveTarget, setDriveSaveTarget] = useState<UploadedFileValue | null>(null)
  const [savingToDrive, setSavingToDrive] = useState(false)

  const applyPage = useCallback(
    (data: SubmissionsPage) => {
      setSubmissions(data.submissions)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
      setPage(data.page)
      onTotalChange?.(data.total)
    },
    [onTotalChange],
  )

  useEffect(() => {
    let cancelled = false
    listSubmissions(formId, 1, PAGE_SIZE)
      .then((data) => {
        if (!cancelled) applyPage(data)
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load responses")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [formId, applyPage])

  async function fetchPage(targetPage: number) {
    setLoading(true)
    try {
      applyPage(await listSubmissions(formId, targetPage, PAGE_SIZE))
    } catch {
      toast.error("Failed to load responses")
    } finally {
      setLoading(false)
    }
  }

  const detailSubmission = useMemo(
    () => (detailId ? submissions.find((submission) => submission._id === detailId) ?? null : null),
    [detailId, submissions],
  )

  async function updateStatus(submissionId: string, status: FormSubmission["status"]) {
    try {
      await apiUpdateSubmissionStatus(formId, submissionId, status)
      setSubmissions((current) =>
        current.map((submission) =>
          submission._id === submissionId ? { ...submission, status } : submission,
        ),
      )
    } catch {
      toast.error("Failed to update response")
    }
  }

  async function removeSubmission(submissionId: string) {
    setDeleting(true)
    try {
      await apiDeleteSubmission(formId, submissionId)
      setDetailId(null)
      setDeleteTargetId(null)
      toast.success("Response deleted")
      await fetchPage(submissions.length === 1 && page > 1 ? page - 1 : page)
    } catch {
      toast.error("Failed to delete response")
    } finally {
      setDeleting(false)
    }
  }

  async function openSubmissionFile(file: UploadedFileValue) {
    setFilePreview({ file, viewUrl: null, downloadUrl: null, loading: true, error: null })
    try {
      const [viewUrl, downloadUrl] = await Promise.all([
        resolveUploadedFileUrl(file),
        resolveUploadedFileUrl(file, true),
      ])
      setFilePreview((current) =>
        current?.file.key === file.key
          ? { file, viewUrl, downloadUrl, loading: false, error: null }
          : current,
      )
    } catch (err) {
      const error = err instanceof Error ? err.message : "Failed to load file"
      setFilePreview((current) =>
        current?.file.key === file.key
          ? { file, viewUrl: null, downloadUrl: null, loading: false, error }
          : current,
      )
    }
  }

  async function saveFileToDrive(folder: { id: string | null; name: string }) {
    if (!detailSubmission || !driveSaveTarget) return
    setSavingToDrive(true)
    try {
      const { node } = await saveFormSubmissionFileToDrive({
        formId,
        submissionId: detailSubmission._id,
        key: driveSaveTarget.key,
        parentId: folder.id,
        name: driveSaveTarget.originalName,
      })
      setDriveSaveTarget(null)
      toast.success("Saved to Drive", { description: `${node.name} saved in ${folder.name}.` })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save file to Drive")
    } finally {
      setSavingToDrive(false)
    }
  }

  async function createCustomerFromSubmission(submission: FormSubmission) {
    const readValue = (names: string[]) => {
      const field = fields.find((f) => names.some((name) => f.label.toLowerCase().includes(name)))
      return field ? String(submission.values[field.id] ?? "").trim() : ""
    }
    const email = readValue(["email"])
    if (!email) {
      toast.error("No email field found in this response")
      return
    }
    try {
      await createCustomer({
        name: readValue(["name", "contact"]) || "Form respondent",
        company: readValue(["company", "business"]) || "Unknown company",
        email,
        contactNumber: readValue(["phone", "mobile", "contact"]) || "-",
        address: readValue(["address", "location"]) || "-",
        notes: `Created from form response on ${formatDateTime(submission.createdAt)}`,
        specialDiscountPercentage: 0,
      })
      toast.success("Customer created")
      await updateStatus(submission._id, "reviewed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer")
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <div>
          <h2 className="text-base font-semibold">Responses</h2>
          <p className="text-[13px] text-muted-foreground">
            {total} response{total !== 1 && "s"} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchPage(page)} disabled={loading}>
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={total === 0} asChild>
            <a href={submissionsExportUrl(formId)}>
              <DownloadIcon className="size-3.5" /> Export CSV
            </a>
          </Button>
        </div>
      </div>

      {total === 0 && !loading ? (
        <div className="mx-6 mb-6 flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-20 text-center lg:mx-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <InboxIcon className="size-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold">No Responses Yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Responses land here the moment someone submits your form. Share the link from the
              Share tab to get started.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto px-6 lg:px-8">
            <div className="rounded-xl border shadow-xs">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    {collectDeviceInfo && <TableHead>Device</TableHead>}
                    {fields.map((field) => (
                      <TableHead key={field.id} className="max-w-[180px] truncate">
                        {field.label || "Untitled"}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission, index) => (
                    <TableRow
                      key={submission._id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => setDetailId(submission._id)}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {rangeStart + index}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[13px]">
                        {formatDateTime(submission.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={submission.status === "new" ? "default" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {submission.status === "new" && <CircleIcon className="size-1.5 fill-current" />}
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{submission.source}</TableCell>
                      {collectDeviceInfo && (
                        <TableCell className="text-[13px] text-muted-foreground">
                          {submission.metadata?.device ?? "-"}
                        </TableCell>
                      )}
                      {fields.map((field) => (
                        <TableCell key={field.id} className="max-w-[180px] truncate text-[13px]">
                          {formatResponseValue(submission.values[field.id])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-3 lg:px-8">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => void fetchPage(page - 1)}
              >
                <ChevronLeftIcon className="size-3.5" /> Previous
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => void fetchPage(page + 1)}
              >
                Next <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail sheet */}
      <Sheet open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Submission Details</SheetTitle>
          </SheetHeader>
          {detailSubmission && (
            <div className="space-y-5 px-4 pb-8">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                  <p className="mt-0.5 font-medium">{formatDateTime(detailSubmission.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source</p>
                  <p className="mt-0.5">{detailSubmission.source}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <Badge variant="outline" className="mt-0.5 capitalize">{detailSubmission.status}</Badge>
                </div>
                {detailSubmission.metadata?.referrer && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Referrer</p>
                    <p className="mt-0.5 truncate text-xs">{detailSubmission.metadata.referrer}</p>
                  </div>
                )}
              </div>

              {collectDeviceInfo &&
                (detailSubmission.metadata?.device ||
                  detailSubmission.metadata?.os ||
                  detailSubmission.metadata?.browser) && (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <MonitorSmartphoneIcon className="size-3" /> Device info
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Device</p>
                        <p>{detailSubmission.metadata.device ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">OS</p>
                        <p>{detailSubmission.metadata.os ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Browser</p>
                        <p>{detailSubmission.metadata.browser ?? "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Field values</p>
                {fields.map((field) => (
                  <div key={field.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {field.label || "Untitled"}
                    </p>
                    <ResponseValue
                      value={detailSubmission.values[field.id]}
                      onOpenFile={(file) => void openSubmissionFile(file)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button size="sm" variant="outline" onClick={() => void createCustomerFromSubmission(detailSubmission)}>
                  Create Customer
                </Button>
                <Button
                  size="sm"
                  variant={detailSubmission.status === "reviewed" ? "default" : "outline"}
                  onClick={() => void updateStatus(detailSubmission._id, "reviewed")}
                >
                  Reviewed
                </Button>
                <Button size="sm" variant="outline" onClick={() => void updateStatus(detailSubmission._id, "archived")}>
                  <ArchiveIcon className="size-3.5" /> Archive
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTargetId(detailSubmission._id)}>
                  <Trash2Icon className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTargetId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Response</DialogTitle>
            <DialogDescription>
              This will permanently delete this response. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => { if (deleteTargetId) void removeSubmission(deleteTargetId) }}
            >
              {deleting ? "Deleting..." : "Delete Response"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FormFilePreviewDialog
        preview={filePreview}
        onOpenChange={(open) => { if (!open) setFilePreview(null) }}
        onSaveToDrive={setDriveSaveTarget}
        savingToDrive={savingToDrive}
      />
      <DriveFolderPickerDialog
        open={Boolean(driveSaveTarget)}
        onOpenChange={(open) => { if (!open && !savingToDrive) setDriveSaveTarget(null) }}
        onSelectFolder={(folder) => void saveFileToDrive(folder)}
        confirmLabel="Save file here"
        busy={savingToDrive}
      />
    </div>
  )
}

function ResponseValue({
  value,
  onOpenFile,
}: {
  value: unknown
  onOpenFile: (file: UploadedFileValue) => void
}) {
  const files = Array.isArray(value)
    ? value.filter(isUploadedFileValue)
    : isUploadedFileValue(value)
      ? [value]
      : []

  if (files.length > 0) {
    return (
      <div className="mt-1 grid gap-1">
        {files.map((file) => (
          <button
            key={file.key}
            type="button"
            onClick={() => onOpenFile(file)}
            className="inline-flex w-fit items-center gap-1.5 break-all text-left font-medium text-primary underline-offset-4 hover:underline"
            title={file.key}
          >
            <EyeIcon className="size-3.5 shrink-0" />
            {file.originalName}
          </button>
        ))}
      </div>
    )
  }
  return <p className="mt-1 break-words">{formatResponseValue(value)}</p>
}
