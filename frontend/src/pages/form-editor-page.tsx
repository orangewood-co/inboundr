import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArchiveIcon,
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FileUpIcon,
  GripVerticalIcon,
  HashIcon,
  ListIcon,
  LoaderIcon,
  MailIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader, type BreadcrumbSegment } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/forms`
const CUSTOMERS_API_BASE = `${API_ORIGIN}/api/v1/customers`
const UPLOADS_API_BASE = `${API_ORIGIN}/api/v1/uploads`

type FieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "dropdown"
  | "checkbox"
  | "date"
  | "file"

type FormField = {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string | null
  options?: string[]
  maxFileSizeMb?: number
  allowedMimeTypes?: string[]
  multiple?: boolean
}

type ManagedForm = {
  _id: string
  title: string
  description: string | null
  slug: string
  status: "draft" | "published" | "archived"
  fields: FormField[]
  branding: { accentColor: string; logoUrl: string | null }
  settings: {
    submitButtonLabel: string
    successMessage: string
    notifyOnSubmission: boolean
  }
  submissionCount: number
  updatedAt: string
}

type FormSubmission = {
  _id: string
  values: Record<string, unknown>
  status: "new" | "reviewed" | "archived"
  source: "link" | "embed"
  createdAt: string
}

type UploadedFileValue = {
  key: string
  bucket?: string
  originalName: string
  contentType?: string
  size?: number
  uploadedAt?: string | null
  url?: string | null
}

type SelectedItem = "welcome" | "ending" | string

const FIELD_TYPE_META: Record<
  FieldType,
  { label: string; icon: React.ReactNode }
> = {
  short_text: { label: "Short text", icon: <TypeIcon className="size-4" /> },
  long_text: {
    label: "Long text",
    icon: <MessageSquareTextIcon className="size-4" />,
  },
  email: { label: "Email", icon: <MailIcon className="size-4" /> },
  phone: { label: "Phone", icon: <PhoneIcon className="size-4" /> },
  number: { label: "Number", icon: <HashIcon className="size-4" /> },
  dropdown: { label: "Dropdown", icon: <ChevronDownIcon className="size-4" /> },
  checkbox: {
    label: "Checkboxes",
    icon: <CheckSquareIcon className="size-4" />,
  },
  date: { label: "Date", icon: <CalendarIcon className="size-4" /> },
  file: { label: "File upload", icon: <FileUpIcon className="size-4" /> },
}

function makeFieldId(): string {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function newField(): FormField {
  return {
    id: makeFieldId(),
    label: "New question",
    type: "short_text",
    required: false,
    placeholder: "",
    options: [],
    maxFileSizeMb: 10,
    allowedMimeTypes: [],
    multiple: false,
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function publicUrl(slug: string) {
  return `${window.location.origin}/f/${slug}`
}

function embedSnippet(slug: string) {
  return `<iframe src="${publicUrl(slug)}?embed=1" width="100%" height="720" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`
}

function isUploadedFileValue(value: unknown): value is UploadedFileValue {
  return Boolean(
    value && typeof value === "object" && "key" in value && "originalName" in value,
  )
}

function formatResponseValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "originalName" in item
          ? String((item as { originalName: unknown }).originalName)
          : String(item),
      )
      .join(", ")
  }
  if (value && typeof value === "object" && "originalName" in value) {
    return String((value as { originalName: unknown }).originalName)
  }
  return String(value ?? "-")
}

function ResponseValue({ value }: { value: unknown }) {
  const files = Array.isArray(value)
    ? value.filter(isUploadedFileValue)
    : isUploadedFileValue(value)
      ? [value]
      : []

  async function openFile(file: UploadedFileValue) {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer")
      return
    }
    const response = await fetch(
      `${UPLOADS_API_BASE}/view?key=${encodeURIComponent(file.key)}`,
      { credentials: "include" },
    )
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.url) return
    window.open(payload.url, "_blank", "noopener,noreferrer")
  }

  if (files.length > 0) {
    return (
      <div className="mt-1 grid gap-1">
        {files.map((file) => (
          <button
            key={file.key}
            type="button"
            onClick={() => void openFile(file)}
            className="w-fit break-all text-left font-medium text-primary underline-offset-4 hover:underline"
            title={file.key}
          >
            {file.originalName}
          </button>
        ))}
      </div>
    )
  }

  return <p className="mt-1 break-words">{formatResponseValue(value)}</p>
}

// ---------------------------------------------------------------------------
// Sortable sidebar item
// ---------------------------------------------------------------------------
function SortableFieldItem({
  field,
  index,
  isSelected,
  onSelect,
}: {
  field: FormField
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const meta = FIELD_TYPE_META[field.type]

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/60",
        isDragging && "z-50 opacity-80 shadow-lg",
      )}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVerticalIcon className="size-3.5" />
      </span>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
        {index + 1}
      </span>
      <span className="shrink-0 text-muted-foreground">{meta.icon}</span>
      <span className="min-w-0 truncate">{field.label || "Untitled"}</span>
    </button>
  )
}

// ===========================================================================
// Main editor page
// ===========================================================================
export default function FormEditorPage() {
  const { slug } = useParams({ from: "/forms/$slug" })
  const navigate = useNavigate()

  const [form, setForm] = useState<ManagedForm | null>(null)
  const [draft, setDraft] = useState<Partial<ManagedForm>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedItem>("welcome")
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])

  // ---- fetch form by slug (find from list) ----
  const fetchForm = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to load forms")
      const data = (await response.json()) as { forms: ManagedForm[] }
      const match = data.forms.find((f) => f.slug === slug)
      if (!match) {
        void navigate({ to: "/forms" })
        return
      }
      setForm(match)
      setDraft(match)
    } catch {
      void navigate({ to: "/forms" })
    } finally {
      setLoading(false)
    }
  }, [slug, navigate])

  useEffect(() => {
    void fetchForm()
  }, [fetchForm])

  // ---- fetch submissions ----
  useEffect(() => {
    if (!form) return
    void fetch(`${API_BASE}/${form._id}/submissions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { submissions: FormSubmission[] }) =>
        setSubmissions(d.submissions),
      )
      .catch(() => {})
  }, [form])

  // ---- helpers ----
  const fields = useMemo(() => draft.fields ?? [], [draft.fields])

  const selectedField = useMemo(
    () =>
      selected !== "welcome" && selected !== "ending"
        ? fields.find((f) => f.id === selected) ?? null
        : null,
    [selected, fields],
  )

  const selectedFieldIndex = useMemo(
    () => (selectedField ? fields.indexOf(selectedField) : -1),
    [selectedField, fields],
  )

  function updateDraft<K extends keyof ManagedForm>(
    key: K,
    value: ManagedForm[K],
  ) {
    setDraft((cur) => ({ ...cur, [key]: value }))
  }

  function updateField(index: number, patch: Partial<FormField>) {
    const next = [...fields]
    next[index] = { ...next[index], ...patch } as FormField
    setDraft((cur) => ({ ...cur, fields: next }))
  }

  function addField() {
    const f = newField()
    setDraft((cur) => ({ ...cur, fields: [...(cur.fields ?? []), f] }))
    setSelected(f.id)
  }

  function duplicateField(field: FormField) {
    const copy = { ...field, id: makeFieldId(), label: `${field.label} (copy)` }
    const idx = fields.indexOf(field)
    const next = [...fields]
    next.splice(idx + 1, 0, copy)
    setDraft((cur) => ({ ...cur, fields: next }))
    setSelected(copy.id)
  }

  function removeField(id: string) {
    setDraft((cur) => ({
      ...cur,
      fields: (cur.fields ?? []).filter((f) => f.id !== id),
    }))
    setSelected("welcome")
  }

  // ---- save / publish ----
  async function saveForm(status = draft.status ?? "draft") {
    setSaving(true)
    setMessage(null)
    const payload = { ...draft, status }
    const isExisting = Boolean(draft._id)

    try {
      const response = await fetch(
        isExisting ? `${API_BASE}/${draft._id}` : API_BASE,
        {
          method: isExisting ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Unable to save")

      if (body.slug !== slug) {
        void navigate({
          to: "/forms/$slug",
          params: { slug: body.slug },
          replace: true,
        })
      }

      setMessage(status === "published" ? "Published" : "Saved")
      await fetchForm()
      setTimeout(() => setMessage(null), 2500)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  // ---- submissions helpers ----
  async function updateSubmissionStatus(
    submissionId: string,
    status: FormSubmission["status"],
  ) {
    if (!form) return
    const response = await fetch(
      `${API_BASE}/${form._id}/submissions/${submissionId}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    )
    if (response.ok) {
      setSubmissions((cur) =>
        cur.map((s) => (s._id === submissionId ? { ...s, status } : s)),
      )
    }
  }

  async function createCustomerFromSubmission(sub: FormSubmission) {
    const readValue = (names: string[]) => {
      const field = fields.find((f) =>
        names.some((n) => f.label.toLowerCase().includes(n)),
      )
      return field ? String(sub.values[field.id] ?? "").trim() : ""
    }
    const name = readValue(["name", "contact"]) || "Form respondent"
    const company = readValue(["company", "business"]) || "Unknown company"
    const email = readValue(["email"])
    const contactNumber = readValue(["phone", "mobile", "contact"]) || "-"
    const address = readValue(["address", "location"]) || "-"

    if (!email) {
      setMessage("No email field found in this response.")
      return
    }

    const response = await fetch(CUSTOMERS_API_BASE, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        company,
        email,
        contactNumber,
        address,
        notes: `Created from form response on ${formatDate(sub.createdAt)}`,
        specialDiscountPercentage: 0,
      }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setMessage(body?.error ?? "Failed to create customer")
      return
    }
    setMessage("Customer created")
    await updateSubmissionStatus(sub._id, "reviewed")
  }

  // ---- drag-and-drop ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = fields.findIndex((f) => f.id === active.id)
    const newIdx = fields.findIndex((f) => f.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = [...fields]
    const [moved] = next.splice(oldIdx, 1)
    next.splice(newIdx, 0, moved)
    setDraft((cur) => ({ ...cur, fields: next }))
  }

  // ---- keyboard shortcuts ----
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        addField()
      }
      if (
        (e.key === "d" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "D" && (e.metaKey || e.ctrlKey))
      ) {
        if (selectedField) {
          e.preventDefault()
          duplicateField(selectedField)
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedField && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          removeField(selectedField.id)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField, fields])

  // ---- breadcrumbs ----
  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Forms", href: "/forms" },
    { label: draft.title || "Untitled" },
  ]

  const headerActions = (
    <>
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
      <Badge variant={draft.status === "published" ? "default" : "outline"}>
        {draft.status === "published" ? "Published" : "Draft"}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void saveForm("draft")}
        disabled={saving}
      >
        {saving ? (
          <LoaderIcon className="size-3.5 animate-spin" />
        ) : (
          <SaveIcon className="size-3.5" />
        )}
        Save
      </Button>
      <Button size="sm" onClick={() => void saveForm("published")} disabled={saving}>
        Publish
      </Button>
    </>
  )

  if (loading) {
    return (
      <SidebarProvider
        defaultOpen
        style={
          { "--header-height": "4rem", "--sidebar-width": "18rem" } as CSSProperties
        }
      >
        <AppSidebar collapsible="icon" variant="inset" />
        <SidebarInset className="overflow-hidden">
          <SiteHeader breadcrumbs={breadcrumbs} />
          <div className="flex flex-1 items-center justify-center">
            <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      defaultOpen
      style={
        { "--header-height": "4rem", "--sidebar-width": "18rem" } as CSSProperties
      }
    >
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader breadcrumbs={breadcrumbs} actions={headerActions} />

        <Tabs defaultValue="create" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-5">
            <TabsList className="h-10 bg-transparent p-0">
              <TabsTrigger
                value="create"
                className="rounded-none border-b-2 border-transparent px-4 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Create
              </TabsTrigger>
              <TabsTrigger
                value="share"
                className="rounded-none border-b-2 border-transparent px-4 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Share
              </TabsTrigger>
              <TabsTrigger
                value="responses"
                className="rounded-none border-b-2 border-transparent px-4 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Responses
                {submissions.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {submissions.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ============================================================ */}
          {/* CREATE TAB                                                    */}
          {/* ============================================================ */}
          <TabsContent value="create" className="mt-0 flex min-h-0 flex-1">
            {/* ------ question sidebar ------ */}
            <aside className="hidden w-60 shrink-0 flex-col border-r lg:flex">
              <div className="flex-1 overflow-y-auto p-3">
                {/* Welcome screen (pinned) */}
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selected === "welcome"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60",
                  )}
                  onClick={() => setSelected("welcome")}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ClipboardListIcon className="size-3" />
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    Welcome Screen
                  </span>
                </button>

                <Separator className="my-2" />

                {/* Sortable field list */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0.5">
                      {fields.map((field, i) => (
                        <SortableFieldItem
                          key={field.id}
                          field={field}
                          index={i}
                          isSelected={selected === field.id}
                          onSelect={() => setSelected(field.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <button
                  onClick={addField}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <PlusIcon className="size-4" />
                  Add question
                </button>

                <Separator className="my-2" />

                {/* Ending (pinned) */}
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selected === "ending"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60",
                  )}
                  onClick={() => setSelected("ending")}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ListIcon className="size-3" />
                  </span>
                  <span className="min-w-0 truncate font-medium">
                    Thank You Screen
                  </span>
                </button>
              </div>
            </aside>

            {/* ------ center editor ------ */}
            <main className="min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl p-6 lg:p-10">
                {/* ---- WELCOME SCREEN ---- */}
                {selected === "welcome" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">Welcome Screen</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The first thing respondents see when they open your form.
                      </p>
                    </div>
                    <div className="space-y-4 rounded-xl border p-5">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          value={draft.title ?? ""}
                          onChange={(e) => updateDraft("title", e.target.value)}
                          placeholder="Form title"
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                          id="description"
                          rows={3}
                          value={draft.description ?? ""}
                          onChange={(e) =>
                            updateDraft("description", e.target.value)
                          }
                          placeholder="Describe what this form is about..."
                          className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="slug">Public slug</Label>
                          <Input
                            id="slug"
                            value={draft.slug ?? ""}
                            onChange={(e) =>
                              updateDraft("slug", e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="btnLabel">Start button label</Label>
                          <Input
                            id="btnLabel"
                            value={
                              draft.settings?.submitButtonLabel ?? "Submit"
                            }
                            onChange={(e) =>
                              setDraft((cur) => ({
                                ...cur,
                                settings: {
                                  ...(cur.settings ?? {
                                    submitButtonLabel: "Submit",
                                    successMessage: "",
                                    notifyOnSubmission: true,
                                  }),
                                  submitButtonLabel: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-medium">Branding</h3>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="accent">Accent color</Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={
                                  draft.branding?.accentColor ?? "#111827"
                                }
                                onChange={(e) =>
                                  setDraft((cur) => ({
                                    ...cur,
                                    branding: {
                                      ...(cur.branding ?? { logoUrl: null }),
                                      accentColor: e.target.value,
                                    },
                                  }))
                                }
                                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                              />
                              <Input
                                id="accent"
                                value={
                                  draft.branding?.accentColor ?? "#111827"
                                }
                                onChange={(e) =>
                                  setDraft((cur) => ({
                                    ...cur,
                                    branding: {
                                      ...(cur.branding ?? { logoUrl: null }),
                                      accentColor: e.target.value,
                                    },
                                  }))
                                }
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                        Preview
                      </h3>
                      <div
                        className="overflow-hidden rounded-2xl text-white"
                        style={{
                          backgroundColor:
                            draft.branding?.accentColor ?? "#111827",
                        }}
                      >
                        <div className="relative p-8">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.28),transparent_35%)]" />
                          <div className="relative">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                              Inboundr form
                            </p>
                            <h3 className="mt-3 text-xl font-bold">
                              {draft.title || "Untitled form"}
                            </h3>
                            {draft.description && (
                              <p className="mt-2 text-sm text-white/70">
                                {draft.description}
                              </p>
                            )}
                            <button
                              className="mt-5 rounded-lg bg-white/20 px-5 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/30"
                              type="button"
                            >
                              {draft.settings?.submitButtonLabel || "Start"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- ENDING SCREEN ---- */}
                {selected === "ending" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold">
                        Thank You Screen
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        What respondents see after submitting.
                      </p>
                    </div>
                    <div className="space-y-4 rounded-xl border p-5">
                      <div className="grid gap-2">
                        <Label htmlFor="successMsg">Success message</Label>
                        <textarea
                          id="successMsg"
                          rows={4}
                          value={draft.settings?.successMessage ?? ""}
                          onChange={(e) =>
                            setDraft((cur) => ({
                              ...cur,
                              settings: {
                                ...(cur.settings ?? {
                                  submitButtonLabel: "Submit",
                                  successMessage: "",
                                  notifyOnSubmission: true,
                                }),
                                successMessage: e.target.value,
                              },
                            }))
                          }
                          placeholder="Thanks! Your response has been recorded."
                          className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">
                            Email notifications
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Get notified when someone submits a response.
                          </p>
                        </div>
                        <Switch
                          checked={
                            draft.settings?.notifyOnSubmission ?? true
                          }
                          onCheckedChange={(checked) =>
                            setDraft((cur) => ({
                              ...cur,
                              settings: {
                                ...(cur.settings ?? {
                                  submitButtonLabel: "Submit",
                                  successMessage: "",
                                  notifyOnSubmission: true,
                                }),
                                notifyOnSubmission: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                        Preview
                      </h3>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60">
                          <svg
                            className="size-6 text-emerald-600 dark:text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <p className="mt-4 font-semibold">
                          Response submitted
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {draft.settings?.successMessage ||
                            "Thanks! Your response has been recorded."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---- FIELD EDITOR ---- */}
                {selectedField && selectedFieldIndex >= 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                          {selectedFieldIndex + 1}
                        </span>
                        <h2 className="text-lg font-semibold">
                          {selectedField.label || "Untitled question"}
                        </h2>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateField(selectedField)}
                          title="Duplicate (Ctrl+D)"
                        >
                          <CopyIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(selectedField.id)}
                          title="Delete (Del)"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-5 rounded-xl border p-5">
                      {/* Label */}
                      <div className="grid gap-2">
                        <Label>Question</Label>
                        <Input
                          value={selectedField.label}
                          onChange={(e) =>
                            updateField(selectedFieldIndex, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Type your question"
                          className="text-base font-medium"
                        />
                      </div>

                      {/* Type selector */}
                      <div className="grid gap-2">
                        <Label>Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            Object.entries(FIELD_TYPE_META) as [
                              FieldType,
                              (typeof FIELD_TYPE_META)[FieldType],
                            ][]
                          ).map(([type, meta]) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() =>
                                updateField(selectedFieldIndex, { type })
                              }
                              className={cn(
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                selectedField.type === type
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "hover:border-muted-foreground/30 hover:bg-muted/40",
                              )}
                            >
                              {meta.icon}
                              {meta.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Placeholder */}
                      <div className="grid gap-2">
                        <Label>Placeholder</Label>
                        <Input
                          value={selectedField.placeholder ?? ""}
                          onChange={(e) =>
                            updateField(selectedFieldIndex, {
                              placeholder: e.target.value,
                            })
                          }
                          placeholder="Placeholder text (optional)"
                        />
                      </div>

                      {/* Required toggle */}
                      <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">Required</p>
                          <p className="text-xs text-muted-foreground">
                            Respondent must answer this question
                          </p>
                        </div>
                        <Switch
                          checked={selectedField.required}
                          onCheckedChange={(checked) =>
                            updateField(selectedFieldIndex, {
                              required: checked,
                            })
                          }
                        />
                      </div>

                      {/* Options for dropdown/checkbox */}
                      {(selectedField.type === "dropdown" ||
                        selectedField.type === "checkbox") && (
                        <div className="grid gap-2">
                          <Label>Options</Label>
                          <div className="space-y-2">
                            {(selectedField.options ?? []).map(
                              (option, optIdx) => (
                                <div
                                  key={optIdx}
                                  className="flex items-center gap-2"
                                >
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                                    {optIdx + 1}
                                  </span>
                                  <Input
                                    value={option}
                                    onChange={(e) => {
                                      const opts = [
                                        ...(selectedField.options ?? []),
                                      ]
                                      opts[optIdx] = e.target.value
                                      updateField(selectedFieldIndex, {
                                        options: opts,
                                      })
                                    }}
                                    placeholder={`Option ${optIdx + 1}`}
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 shrink-0"
                                    onClick={() => {
                                      const opts = (
                                        selectedField.options ?? []
                                      ).filter((_, i) => i !== optIdx)
                                      updateField(selectedFieldIndex, {
                                        options: opts,
                                      })
                                    }}
                                  >
                                    <Trash2Icon className="size-3.5" />
                                  </Button>
                                </div>
                              ),
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 w-fit"
                            onClick={() =>
                              updateField(selectedFieldIndex, {
                                options: [
                                  ...(selectedField.options ?? []),
                                  "",
                                ],
                              })
                            }
                          >
                            <PlusIcon className="size-3.5" />
                            Add option
                          </Button>
                        </div>
                      )}

                      {/* File upload config */}
                      {selectedField.type === "file" && (
                        <div className="space-y-4 rounded-lg border p-4">
                          <h4 className="text-sm font-medium">
                            File upload settings
                          </h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>Max file size (MB)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="50"
                                value={selectedField.maxFileSizeMb ?? 10}
                                onChange={(e) =>
                                  updateField(selectedFieldIndex, {
                                    maxFileSizeMb: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Allowed MIME types</Label>
                              <Input
                                value={(
                                  selectedField.allowedMimeTypes ?? []
                                ).join(", ")}
                                onChange={(e) =>
                                  updateField(selectedFieldIndex, {
                                    allowedMimeTypes: e.target.value
                                      .split(",")
                                      .map((m) => m.trim().toLowerCase())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="application/pdf, image/png"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm">Allow multiple files</p>
                            <Switch
                              checked={Boolean(selectedField.multiple)}
                              onCheckedChange={(checked) =>
                                updateField(selectedFieldIndex, {
                                  multiple: checked,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </TabsContent>

          {/* ============================================================ */}
          {/* SHARE TAB                                                     */}
          {/* ============================================================ */}
          <TabsContent value="share" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-10">
              <div>
                <h2 className="text-lg font-semibold">Share your form</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share a direct link or embed the form in your website.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border p-5">
                <h3 className="text-sm font-medium">Public link</h3>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={
                      draft.slug
                        ? publicUrl(draft.slug)
                        : "Save the form first"
                    }
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      draft.slug &&
                      navigator.clipboard.writeText(publicUrl(draft.slug))
                    }
                  >
                    <CopyIcon className="size-4" />
                    Copy
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href={draft.slug ? `/f/${draft.slug}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <EyeIcon className="size-4" />
                      Preview
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border p-5">
                <h3 className="text-sm font-medium">Embed code</h3>
                <textarea
                  readOnly
                  rows={5}
                  value={draft.slug ? embedSnippet(draft.slug) : ""}
                  className="w-full rounded-lg border bg-muted/30 p-3 font-mono text-xs"
                />
              </div>
            </div>
          </TabsContent>

          {/* ============================================================ */}
          {/* RESPONSES TAB                                                 */}
          {/* ============================================================ */}
          <TabsContent value="responses" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl space-y-5 p-6 lg:p-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Responses</h2>
                  <p className="text-sm text-muted-foreground">
                    {submissions.length} response
                    {submissions.length !== 1 && "s"}
                  </p>
                </div>
                {form && (
                  <Button variant="outline" asChild>
                    <a
                      href={`${API_BASE}/${form._id}/submissions/export`}
                    >
                      <DownloadIcon className="size-4" />
                      Export CSV
                    </a>
                  </Button>
                )}
              </div>

              {submissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
                  No responses yet. Share your form to start collecting data.
                </div>
              ) : (
                submissions.map((sub) => (
                  <div key={sub._id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-medium">
                          {formatDate(sub.createdAt)}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          via {sub.source}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void createCustomerFromSubmission(sub)
                          }
                        >
                          Create customer
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            sub.status === "reviewed" ? "default" : "outline"
                          }
                          onClick={() =>
                            void updateSubmissionStatus(sub._id, "reviewed")
                          }
                        >
                          Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void updateSubmissionStatus(sub._id, "archived")
                          }
                        >
                          <ArchiveIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {fields.map((field) => (
                        <div
                          key={field.id}
                          className="rounded-lg bg-muted/40 p-3 text-sm"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {field.label}
                          </p>
                          <ResponseValue value={sub.values[field.id]} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SidebarInset>
    </SidebarProvider>
  )
}
