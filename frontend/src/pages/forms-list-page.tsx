import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ClipboardListIcon,
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  SearchXIcon,
  Settings2Icon,
} from "lucide-react"

import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { FormTemplateDialog } from "@/components/form-template-dialog"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { PageHeader } from "@/components/page-header"
import {
  archiveForm as apiArchiveForm,
  duplicateForm as apiDuplicateForm,
  listFolders,
  listForms,
  saveForm,
} from "@/lib/forms-api"
import { cn } from "@/lib/utils"
import { CreateFolderDialog, FolderSettingsDialog } from "@/components/forms/folder-dialogs"
import { FormCard } from "@/components/forms/form-card"
import { FormsStatCards } from "@/components/forms/forms-stat-cards"
import { publicFormUrl, type FormFolder, type ManagedForm } from "@/components/forms/types"

type StatusFilter = "all" | "published" | "draft"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Drafts" },
]

type FolderFilter = "all" | "unfiled" | string

export default function FormsListPage() {
  const navigate = useNavigate()
  const [forms, setForms] = useState<ManagedForm[]>([])
  const [folders, setFolders] = useState<FormFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ManagedForm | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all")
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([listForms(), listFolders().catch(() => [] as FormFolder[])])
      .then(([formsData, foldersData]) => {
        if (cancelled) return
        setForms(formsData)
        setFolders(foldersData)
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

  async function refreshFolders() {
    try {
      setFolders(await listFolders())
    } catch {
      /* keep current list */
    }
  }

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder._id === folderFilter) ?? null,
    [folders, folderFilter],
  )

  const folderNameById = useMemo(
    () => new Map(folders.map((folder) => [folder._id, folder.name])),
    [folders],
  )

  const filteredForms = useMemo(() => {
    return forms
      .filter((form) =>
        folderFilter === "all"
          ? true
          : folderFilter === "unfiled"
            ? !form.folderId
            : form.folderId === folderFilter,
      )
      .filter((form) => statusFilter === "all" || form.status === statusFilter)
      .sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [forms, statusFilter, folderFilter])

  async function moveToFolder(form: ManagedForm, folderId: string | null) {
    try {
      await saveForm({ ...form, folderId, useFolderDesign: true })
      toast.success(
        folderId
          ? `Moved to ${folderNameById.get(folderId) ?? "folder"}`
          : "Removed from folder",
      )
      void refreshForms()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move form")
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
        folderId: selectedFolder?._id ?? null,
        useFolderDesign: true,
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
          <div className="mx-auto max-w-6xl p-6 lg:p-8">
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
              <LoadingState />
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
              <div className="mt-6 space-y-6 animate-in fade-in-0 duration-300">
                <FormsStatCards forms={forms} />

                <div className="flex flex-wrap items-center gap-2">
                  <FolderChip
                    label="All"
                    count={forms.length}
                    active={folderFilter === "all"}
                    onClick={() => setFolderFilter("all")}
                  />
                  <FolderChip
                    label="Unfiled"
                    count={forms.filter((form) => !form.folderId).length}
                    active={folderFilter === "unfiled"}
                    onClick={() => setFolderFilter("unfiled")}
                  />
                  {folders.map((folder) => (
                    <FolderChip
                      key={folder._id}
                      label={folder.name}
                      count={forms.filter((form) => form.folderId === folder._id).length}
                      active={folderFilter === folder._id}
                      withIcon
                      onClick={() => setFolderFilter(folder._id)}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground"
                    onClick={() => setCreateFolderOpen(true)}
                  >
                    <FolderPlusIcon className="size-4" />
                    New Folder
                  </Button>
                </div>

                {selectedFolder && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-semibold">{selectedFolder.name}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {(() => {
                          const count = forms.filter((form) => form.folderId === selectedFolder._id).length
                          return `${count} ${count === 1 ? "form inherits" : "forms inherit"} this folder's design`
                        })()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFolderSettingsOpen(true)}
                    >
                      <Settings2Icon className="size-4" />
                      Edit Design
                    </Button>
                  </div>
                )}

                <div className="flex justify-end">
                  <div className="flex w-fit items-center rounded-lg bg-muted p-[3px]">
                    {STATUS_FILTERS.map((filter) => {
                      const count =
                        filter.value === "all"
                          ? forms.length
                          : forms.filter((form) => form.status === filter.value).length
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setStatusFilter(filter.value)}
                          className={cn(
                            "inline-flex items-baseline gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
                            statusFilter === filter.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {filter.label}
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {filteredForms.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
                    <SearchXIcon className="size-8 text-muted-foreground/40" />
                    <div>
                      <p className="font-medium">No Matching Forms</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        No forms with this status yet.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatusFilter("all")}
                    >
                      Show All Forms
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredForms.map((form) => (
                      <FormCard
                        key={form._id}
                        form={form}
                        folders={folders}
                        folderName={
                          folderFilter === "all" && form.folderId
                            ? folderNameById.get(form.folderId) ?? null
                            : null
                        }
                        onOpen={() =>
                          void navigate({ to: "/forms/$slug", params: { slug: form.slug } })
                        }
                        onCopyLink={() => copyLink(form)}
                        onDuplicate={() => void duplicateForm(form)}
                        onArchive={() => setArchiveTarget(form)}
                        onMoveToFolder={(folderId) => void moveToFolder(form, folderId)}
                      />
                    ))}
                  </div>
                )}
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

        <CreateFolderDialog
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
          onCreated={(folder) => {
            setFolders((current) =>
              [...current, folder].sort((a, b) => a.name.localeCompare(b.name)),
            )
            setFolderFilter(folder._id)
          }}
        />

        <FolderSettingsDialog
          folder={selectedFolder}
          open={folderSettingsOpen}
          onOpenChange={setFolderSettingsOpen}
          onSaved={(saved) => {
            setFolders((current) =>
              current
                .map((folder) => (folder._id === saved._id ? saved : folder))
                .sort((a, b) => a.name.localeCompare(b.name)),
            )
          }}
          onDeleted={(folderId) => {
            setFolders((current) => current.filter((folder) => folder._id !== folderId))
            setFolderFilter("all")
            void refreshForms()
            void refreshFolders()
          }}
        />
    </AppLayout>
  )
}

function FolderChip({
  label,
  count,
  active,
  withIcon,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  withIcon?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {withIcon && <FolderIcon className="size-3.5" />}
      <span className="max-w-40 truncate">{label}</span>
      <span className="text-[11px] tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function lastActivity(form: ManagedForm): number {
  const updated = new Date(form.updatedAt).getTime()
  const lastSubmission = form.lastSubmissionAt ? new Date(form.lastSubmissionAt).getTime() : 0
  return Math.max(updated, lastSubmission)
}

function LoadingState() {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[210px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
