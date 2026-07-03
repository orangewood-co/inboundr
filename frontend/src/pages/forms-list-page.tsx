import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ClipboardListIcon,
  CopyIcon,
  EllipsisIcon,
  LinkIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { FormTemplateDialog } from "@/components/form-template-dialog"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ListSkeleton } from "@/components/list-states"
import { PageHeader } from "@/components/page-header"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import {
  archiveForm as apiArchiveForm,
  duplicateForm as apiDuplicateForm,
  listForms,
  saveForm,
} from "@/lib/forms-api"
import { publicFormUrl, type ManagedForm } from "@/components/forms/types"

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const, tooltip: "Form is in draft mode and not publicly accessible" },
  published: { label: "Published", variant: "default" as const, tooltip: "Form is live and accepting submissions" },
  archived: { label: "Archived", variant: "secondary" as const, tooltip: "Form has been archived and is no longer accessible" },
}

export default function FormsListPage() {
  const navigate = useNavigate()
  const [forms, setForms] = useState<ManagedForm[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ManagedForm | null>(null)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    let cancelled = false
    listForms()
      .then((data) => {
        if (!cancelled) setForms(data)
      })
      .catch(() => {
        /* handled by empty state */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshForms() {
    try {
      setForms(await listForms())
    } catch {
      /* keep current list */
    }
  }

  async function createFromTemplate(template: {
    title: string
    description: string
    fields: { id: string; label: string; type: string; required: boolean; description?: string | null; placeholder?: string | null; options?: string[] }[]
  }) {
    setCreating(true)
    try {
      const slug = `form-${Date.now().toString(36)}`
      const created = await saveForm({
        title: template.title,
        description: template.description,
        slug,
        status: "draft",
        fields: template.fields as ManagedForm["fields"],
        branding: { accentColor: "#111827", logoUrl: null },
        settings: {
          submitButtonLabel: "Submit",
          successMessage: "Thanks! Your response has been submitted.",
          notifyOnSubmission: true,
          collectDeviceInfo: false,
        },
      })
      void navigate({ to: "/forms/$slug", params: { slug: created.slug } })
    } catch {
      toast.error("Failed to create form")
      setCreating(false)
    }
  }

  async function duplicateForm(form: ManagedForm) {
    try {
      await apiDuplicateForm(form._id)
      toast.success("Form duplicated")
      void refreshForms()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate form")
    }
  }

  async function archiveForm(form: ManagedForm) {
    setArchiving(true)
    try {
      await apiArchiveForm(form._id)
      toast.success("Form archived")
      setArchiveTarget(null)
      void refreshForms()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive form")
    } finally {
      setArchiving(false)
    }
  }

  function copyLink(form: ManagedForm) {
    void navigator.clipboard.writeText(publicFormUrl(form.slug))
    toast.success("Link copied")
  }

  return (
    <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Forms" }]} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            <PageHeader
              title="Forms"
              description={`${forms.length} ${forms.length === 1 ? "form" : "forms"}`}
              actions={
                <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                  {creating ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <PlusIcon className="size-4" />
                  )}
                  New Form
                </Button>
              }
            />

            {loading ? (
              <ListSkeleton rows={6} columns={3} className="mt-8 rounded-2xl border" />
            ) : forms.length === 0 ? (
              <div className="mt-16 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ClipboardListIcon className="size-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">No Forms Yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Create your first form to start collecting responses from
                    customers.
                  </p>
                </div>
                <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                  <PlusIcon className="size-4" />
                  Create Your First Form
                </Button>
              </div>
            ) : (
              <div className="mt-6 animate-in fade-in-0 duration-300 rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40%]">Name</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((form) => {
                      const status = statusConfig[form.status]
                      return (
                        <TableRow
                          key={form._id}
                          className="group/row cursor-pointer"
                          onClick={() =>
                            void navigate({
                              to: "/forms/$slug",
                              params: { slug: form.slug },
                            })
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                                <ClipboardListIcon className="size-4 text-success" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {form.title}
                                </p>
                                {form.description && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {form.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {form.submissionCount > 0
                              ? form.submissionCount
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{status.tooltip}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{formatRelativeTime(form.updatedAt)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {formatDateTime(form.updatedAt)}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <EllipsisIcon className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>More actions</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end">
                                {form.status === "published" && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyLink(form)
                                    }}
                                  >
                                    <LinkIcon className="size-4" />
                                    Copy Link
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void duplicateForm(form)
                                  }}
                                >
                                  <CopyIcon className="size-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setArchiveTarget(form)
                                  }}
                                >
                                  <Trash2Icon className="size-4" />
                                  Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>

        <Dialog
          open={archiveTarget !== null}
          onOpenChange={(open) => {
            if (!open && !archiving) setArchiveTarget(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive Form</DialogTitle>
              <DialogDescription>
                {archiveTarget?.status === "published"
                  ? `"${archiveTarget?.title}" is live — archiving takes it offline and its public link stops working. Existing responses are kept.`
                  : `"${archiveTarget?.title}" will be removed from this list. Existing responses are kept.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={archiving} onClick={() => setArchiveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={archiving}
                onClick={() => {
                  if (archiveTarget) void archiveForm(archiveTarget)
                }}
              >
                {archiving ? "Archiving..." : "Archive Form"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <FormTemplateDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          onSelect={(t) => void createFromTemplate(t)}
          creating={creating}
        />
    </AppLayout>
  )
}
