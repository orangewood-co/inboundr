import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  EllipsisIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  SearchXIcon,
  Settings2Icon,
  Trash2Icon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  CreateFolderDialog,
  DeleteFolderDialog,
  FolderSettingsDialog,
} from "@/components/forms/folder-dialogs"
import { FolderSwatch } from "@/components/forms/folder-swatch"
import { FormCard } from "@/components/forms/form-card"
import { FormsStatCards } from "@/components/forms/forms-stat-cards"
import { publicFormUrl, type FormFolder, type ManagedForm } from "@/components/forms/types"

type StatusFilter = "all" | "published" | "draft"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Live" },
  { value: "draft", label: "Drafts" },
]

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
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [folderDialogTarget, setFolderDialogTarget] = useState<FormFolder | null>(null)
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false)
  const [folderSettingsFocus, setFolderSettingsFocus] = useState<"design" | "name">("design")
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)

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

  const openFolder = useMemo(
    () => folders.find((folder) => folder._id === openFolderId) ?? null,
    [folders, openFolderId],
  )

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder._id, folder])),
    [folders],
  )

  // Drive-style scoping: the root view shows forms outside folders; opening a
  // folder shows only its forms.
  const scopedForms = useMemo(
    () =>
      openFolder
        ? forms.filter((form) => form.folderId === openFolder._id)
        : forms.filter((form) => !form.folderId),
    [forms, openFolder],
  )

  const filteredForms = useMemo(() => {
    return scopedForms
      .filter((form) => statusFilter === "all" || form.status === statusFilter)
      .sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [scopedForms, statusFilter])

  async function moveToFolder(form: ManagedForm, folderId: string | null) {
    try {
      await saveForm({ ...form, folderId, useFolderDesign: folderId !== null })
      toast.success(
        folderId
          ? `Moved to ${folderById.get(folderId)?.name ?? "folder"}`
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
        folderId: openFolder?._id ?? null,
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

  function openFolderSettings(folder: FormFolder, focus: "design" | "name") {
    setFolderDialogTarget(folder)
    setFolderSettingsFocus(focus)
    setFolderSettingsOpen(true)
  }

  const newFormButton = (
    <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
      {creating ? <Spinner data-icon="inline-start" /> : <PlusIcon className="size-4" />}
      New Form
    </Button>
  )

  return (
    <AppLayout>
        <SiteHeader
          breadcrumbs={
            openFolder
              ? [{ label: "Forms", href: "/forms" }, { label: openFolder.name }]
              : [{ label: "Forms" }]
          }
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">
            {openFolder ? (
              <div className="animate-in fade-in-0 duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-2 h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpenFolderId(null)}
                >
                  <ArrowLeftIcon className="size-4" />
                  All Forms
                </Button>
                <PageHeader
                  title={
                    <span className="flex items-center gap-3">
                      <FolderSwatch branding={openFolder.branding} className="size-10" />
                      <span className="truncate">{openFolder.name}</span>
                    </span>
                  }
                  description={`${scopedForms.length} ${scopedForms.length === 1 ? "form" : "forms"} · forms in this folder inherit its design`}
                  actions={
                    <>
                      <Button
                        variant="outline"
                        onClick={() => openFolderSettings(openFolder, "design")}
                      >
                        <Settings2Icon className="size-4" />
                        Edit Design
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <EllipsisIcon className="size-4" />
                            <span className="sr-only">Folder actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openFolderSettings(openFolder, "name")}
                          >
                            <PencilIcon className="size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => {
                              setFolderDialogTarget(openFolder)
                              setDeleteFolderOpen(true)
                            }}
                          >
                            <Trash2Icon className="size-4" />
                            Delete Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {newFormButton}
                    </>
                  }
                />
              </div>
            ) : (
              <PageHeader
                title="Forms"
                description={`${forms.length} ${forms.length === 1 ? "form" : "forms"}`}
                actions={newFormButton}
              />
            )}

            {loading ? (
              <LoadingState />
            ) : forms.length === 0 && folders.length === 0 ? (
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
              <div className="mt-6 space-y-8 animate-in fade-in-0 duration-300">
                {!openFolder && <FormsStatCards forms={forms} />}

                {!openFolder && (
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Folders
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setCreateFolderOpen(true)}
                      >
                        <FolderPlusIcon className="size-4" />
                        New Folder
                      </Button>
                    </div>
                    {folders.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setCreateFolderOpen(true)}
                        className="flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 text-left transition-colors hover:border-muted-foreground/40 hover:bg-muted/30"
                      >
                        <FolderPlusIcon className="size-4 shrink-0 text-muted-foreground/60" />
                        <span className="text-sm text-muted-foreground">
                          Create a folder to group forms and give them one shared design.
                        </span>
                      </button>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {folders.map((folder) => (
                          <FolderCard
                            key={folder._id}
                            folder={folder}
                            formCount={
                              forms.filter((form) => form.folderId === folder._id).length
                            }
                            onOpen={() => setOpenFolderId(folder._id)}
                            onEditDesign={() => openFolderSettings(folder, "design")}
                            onRename={() => openFolderSettings(folder, "name")}
                            onDelete={() => {
                              setFolderDialogTarget(folder)
                              setDeleteFolderOpen(true)
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {openFolder ? "Forms in this folder" : "Forms"}
                    </h2>
                    <div className="flex w-fit shrink-0 items-center rounded-lg bg-muted p-[3px]">
                      {STATUS_FILTERS.map((filter) => {
                        const count =
                          filter.value === "all"
                            ? scopedForms.length
                            : scopedForms.filter((form) => form.status === filter.value)
                                .length
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
                  scopedForms.length === 0 && openFolder ? (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
                      <FolderOpenIcon className="size-8 text-muted-foreground/40" />
                      <div>
                        <p className="font-medium">No forms in {openFolder.name} yet</p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          New forms created here inherit this folder's design. You can
                          also move existing forms here from a form card's menu.
                        </p>
                      </div>
                      <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                        <PlusIcon className="size-4" />
                        New Form
                      </Button>
                    </div>
                  ) : scopedForms.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
                      <FolderOpenIcon className="size-8 text-muted-foreground/40" />
                      <div>
                        <p className="font-medium">Everything is in folders</p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          All your forms live inside folders. Open one above, or create
                          a new form here.
                        </p>
                      </div>
                      <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                        <PlusIcon className="size-4" />
                        New Form
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
                      <SearchXIcon className="size-8 text-muted-foreground/40" />
                      <div>
                        <p className="font-medium">No Matching Forms</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          No forms match the current filters.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusFilter("all")}
                      >
                        Show All Statuses
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredForms.map((form) => (
                      <FormCard
                        key={form._id}
                        form={form}
                        folders={folders}
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
                </section>
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
            setOpenFolderId(folder._id)
          }}
        />

        <FolderSettingsDialog
          folder={folderDialogTarget}
          open={folderSettingsOpen}
          onOpenChange={setFolderSettingsOpen}
          initialFocus={folderSettingsFocus}
          onSaved={(saved) => {
            setFolders((current) =>
              current
                .map((folder) => (folder._id === saved._id ? saved : folder))
                .sort((a, b) => a.name.localeCompare(b.name)),
            )
          }}
        />

        <DeleteFolderDialog
          folder={folderDialogTarget}
          open={deleteFolderOpen}
          onOpenChange={setDeleteFolderOpen}
          onDeleted={(folderId) => {
            setFolders((current) => current.filter((folder) => folder._id !== folderId))
            setOpenFolderId((current) => (current === folderId ? null : current))
            void refreshForms()
            void refreshFolders()
          }}
        />
    </AppLayout>
  )
}

function FolderCard({
  folder,
  formCount,
  onOpen,
  onEditDesign,
  onRename,
  onDelete,
}: {
  folder: FormFolder
  formCount: number
  onOpen: () => void
  onEditDesign: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault()
          onOpen()
        }
      }}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 shadow-xs outline-none transition-all hover:border-muted-foreground/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <FolderSwatch branding={folder.branding} className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{folder.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formCount} form{formCount !== 1 && "s"}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            <EllipsisIcon className="size-4" />
            <span className="sr-only">Folder actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem onClick={onOpen}>
            <FolderOpenIcon className="size-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEditDesign}>
            <Settings2Icon className="size-4" />
            Edit Design
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <PencilIcon className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon className="size-4" />
            Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
