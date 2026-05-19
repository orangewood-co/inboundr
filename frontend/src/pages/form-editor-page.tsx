import { useCallback, useEffect, useMemo, useState } from "react"
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
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleIcon,
  CodeXmlIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FileUpIcon,
  GripVerticalIcon,
  HashIcon,
  InboxIcon,
  LinkIcon,
  Link2Icon,
  LoaderIcon,
  MailIcon,
  MessageSquareTextIcon,
  MonitorSmartphoneIcon,
  PhoneIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  StarIcon,
  ToggleLeftIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader, type BreadcrumbSegment } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
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
  | "rating"
  | "url"
  | "yes_no"

type FormField = {
  id: string
  label: string
  type: FieldType
  required: boolean
  description?: string | null
  placeholder?: string | null
  options?: string[]
  maxFileSizeMb?: number
  allowedMimeTypes?: string[]
  multiple?: boolean
}

type FormBranding = {
  accentColor: string
  logoUrl: string | null
  backgroundType?: "solid" | "gradient" | "none"
  backgroundColor?: string | null
  backgroundGradient?: string | null
  theme?: string | null
  borderRadius?: "sm" | "md" | "lg"
}

type ManagedForm = {
  _id: string
  title: string
  description: string | null
  slug: string
  status: "draft" | "published" | "archived"
  fields: FormField[]
  branding: FormBranding
  settings: {
    submitButtonLabel: string
    successMessage: string
    notifyOnSubmission: boolean
    collectDeviceInfo: boolean
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
  metadata?: {
    device?: string | null
    os?: string | null
    browser?: string | null
    referrer?: string | null
  }
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

const FIELD_TYPE_META: Record<FieldType, { label: string; icon: React.ReactNode }> = {
  short_text: { label: "Short text", icon: <TypeIcon className="size-4" /> },
  long_text: { label: "Long text", icon: <MessageSquareTextIcon className="size-4" /> },
  email: { label: "Email", icon: <MailIcon className="size-4" /> },
  phone: { label: "Phone", icon: <PhoneIcon className="size-4" /> },
  number: { label: "Number", icon: <HashIcon className="size-4" /> },
  dropdown: { label: "Dropdown", icon: <ChevronDownIcon className="size-4" /> },
  checkbox: { label: "Checkboxes", icon: <CheckSquareIcon className="size-4" /> },
  date: { label: "Date", icon: <CalendarIcon className="size-4" /> },
  file: { label: "File upload", icon: <FileUpIcon className="size-4" /> },
  rating: { label: "Rating", icon: <StarIcon className="size-4" /> },
  url: { label: "URL", icon: <Link2Icon className="size-4" /> },
  yes_no: { label: "Yes / No", icon: <ToggleLeftIcon className="size-4" /> },
}

const THEME_PRESETS = [
  { id: "minimal", label: "Minimal", accent: "#111827", bg: "#ffffff", gradient: null },
  { id: "ocean", label: "Ocean", accent: "#0369a1", bg: "#f0f9ff", gradient: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)" },
  { id: "sunset", label: "Sunset", accent: "#c2410c", bg: "#fff7ed", gradient: "linear-gradient(135deg, #fed7aa 0%, #fecaca 100%)" },
  { id: "forest", label: "Forest", accent: "#15803d", bg: "#f0fdf4", gradient: "linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%)" },
  { id: "midnight", label: "Midnight", accent: "#6d28d9", bg: "#faf5ff", gradient: "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)" },
  { id: "lavender", label: "Lavender", accent: "#7c3aed", bg: "#fdf4ff", gradient: "linear-gradient(135deg, #f5d0fe 0%, #e9d5ff 100%)" },
  { id: "slate", label: "Slate", accent: "#334155", bg: "#f8fafc", gradient: "linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)" },
  { id: "rose", label: "Rose", accent: "#be123c", bg: "#fff1f2", gradient: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)" },
] as const

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
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

const EMBED_ORIGIN = import.meta.env.VITE_EMBED_URL ?? "http://localhost:5175"

function publicUrl(slug: string) {
  return `${EMBED_ORIGIN}/form/${slug}`
}

function embedSnippet(slug: string) {
  return `<iframe src="${publicUrl(slug)}?embed=1" width="100%" height="720" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`
}

function isUploadedFileValue(value: unknown): value is UploadedFileValue {
  return Boolean(value && typeof value === "object" && "key" in value && "originalName" in value)
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
    : isUploadedFileValue(value) ? [value] : []

  async function openFile(file: UploadedFileValue) {
    if (file.url) { window.open(file.url, "_blank", "noopener,noreferrer"); return }
    const response = await fetch(`${UPLOADS_API_BASE}/view?key=${encodeURIComponent(file.key)}`, { credentials: "include" })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.url) return
    window.open(payload.url, "_blank", "noopener,noreferrer")
  }

  if (files.length > 0) {
    return (
      <div className="mt-1 grid gap-1">
        {files.map((file) => (
          <button key={file.key} type="button" onClick={() => void openFile(file)}
            className="w-fit break-all text-left font-medium text-primary underline-offset-4 hover:underline" title={file.key}>
            {file.originalName}
          </button>
        ))}
      </div>
    )
  }
  return <p className="mt-1 break-words">{formatResponseValue(value)}</p>
}

function SortableFieldItem({ field, index, isSelected, onSelect }: {
  field: FormField; index: number; isSelected: boolean; onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const meta = FIELD_TYPE_META[field.type]

  return (
    <button ref={setNodeRef} style={style} onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md py-2 pr-2.5 pl-1 text-left text-[13px] transition-all",
        isSelected ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        isDragging && "z-50 shadow-lg",
      )}>
      <span {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center opacity-0 transition-opacity group-hover:opacity-60">
        <GripVerticalIcon className="size-3" />
      </span>
      <span className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold tabular-nums",
        isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
      )}>
        {index + 1}
      </span>
      <span className="min-w-0 truncate">{field.label || "Untitled"}</span>
    </button>
  )
}

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
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState<string>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [detailId, setDetailId] = useState<string | null>(null)

  const fetchForm = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to load forms")
      const data = (await response.json()) as { forms: ManagedForm[] }
      const match = data.forms.find((f) => f.slug === slug)
      if (!match) { void navigate({ to: "/forms" }); return }
      setForm(match)
      setDraft(match)
    } catch { void navigate({ to: "/forms" }) }
    finally { setLoading(false) }
  }, [slug, navigate])

  const fetchSubmissions = useCallback(async () => {
    if (!form) return
    setRefreshing(true)
    try {
      const r = await fetch(`${API_BASE}/${form._id}/submissions`, { credentials: "include" })
      if (r.ok) {
        const d = (await r.json()) as { submissions: FormSubmission[] }
        setSubmissions(d.submissions)
      }
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }, [form])

  useEffect(() => { void fetchForm() }, [fetchForm])
  useEffect(() => { void fetchSubmissions() }, [fetchSubmissions])

  const fields = useMemo(() => draft.fields ?? [], [draft.fields])
  const selectedField = useMemo(() =>
    selected !== "welcome" && selected !== "ending" ? fields.find((f) => f.id === selected) ?? null : null,
    [selected, fields])
  const selectedFieldIndex = useMemo(() => (selectedField ? fields.indexOf(selectedField) : -1), [selectedField, fields])

  const collectDeviceInfo = draft.settings?.collectDeviceInfo ?? false

  const sortedSubmissions = useMemo(() => {
    const copy = [...submissions]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status)
      else if (sortKey === "source") cmp = a.source.localeCompare(b.source)
      return sortDir === "desc" ? -cmp : cmp
    })
    return copy
  }, [submissions, sortKey, sortDir])

  const detailSubmission = useMemo(
    () => (detailId ? submissions.find((s) => s._id === detailId) ?? null : null),
    [detailId, submissions],
  )

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  function updateDraft<K extends keyof ManagedForm>(key: K, value: ManagedForm[K]) {
    setDraft((cur) => ({ ...cur, [key]: value }))
  }
  function updateField(index: number, patch: Partial<FormField>) {
    const next = [...fields]; next[index] = { ...next[index], ...patch } as FormField
    setDraft((cur) => ({ ...cur, fields: next }))
  }
  function addField() {
    const f = newField()
    setDraft((cur) => ({ ...cur, fields: [...(cur.fields ?? []), f] }))
    setSelected(f.id)
  }
  function duplicateField(field: FormField) {
    const copy = { ...field, id: makeFieldId(), label: `${field.label} (copy)` }
    const idx = fields.indexOf(field); const next = [...fields]; next.splice(idx + 1, 0, copy)
    setDraft((cur) => ({ ...cur, fields: next })); setSelected(copy.id)
  }
  function removeField(id: string) {
    setDraft((cur) => ({ ...cur, fields: (cur.fields ?? []).filter((f) => f.id !== id) }))
    setSelected("welcome")
  }
  function patchSettings(patch: Partial<ManagedForm["settings"]>) {
    setDraft((cur) => ({
      ...cur,
      settings: { ...(cur.settings ?? { submitButtonLabel: "Submit", successMessage: "", notifyOnSubmission: true, collectDeviceInfo: false }), ...patch },
    }))
  }
  function patchBranding(patch: Partial<FormBranding>) {
    setDraft((cur) => ({
      ...cur,
      branding: { ...(cur.branding ?? { accentColor: "#111827", logoUrl: null }), ...patch },
    }))
  }
  function applyTheme(themeId: string) {
    const preset = THEME_PRESETS.find((t) => t.id === themeId)
    if (!preset) return
    patchBranding({
      theme: themeId,
      accentColor: preset.accent,
      backgroundType: preset.gradient ? "gradient" : preset.bg === "#ffffff" ? "none" : "solid",
      backgroundColor: preset.bg === "#ffffff" ? null : preset.bg,
      backgroundGradient: preset.gradient,
    })
  }

  async function saveForm(status = draft.status ?? "draft") {
    setSaving(true); setMessage(null)
    const payload = { ...draft, status }; const isExisting = Boolean(draft._id)
    try {
      const response = await fetch(isExisting ? `${API_BASE}/${draft._id}` : API_BASE, {
        method: isExisting ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Unable to save")
      if (body.slug !== slug) void navigate({ to: "/forms/$slug", params: { slug: body.slug }, replace: true })
      setMessage(status === "published" ? "Published" : "Saved")
      await fetchForm(); setTimeout(() => setMessage(null), 2500)
    } catch (err) { setMessage(err instanceof Error ? err.message : "Save failed") }
    finally { setSaving(false) }
  }

  async function updateSubmissionStatus(submissionId: string, status: FormSubmission["status"]) {
    if (!form) return
    const response = await fetch(`${API_BASE}/${form._id}/submissions/${submissionId}`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    })
    if (response.ok) setSubmissions((cur) => cur.map((s) => (s._id === submissionId ? { ...s, status } : s)))
  }

  async function createCustomerFromSubmission(sub: FormSubmission) {
    const readValue = (names: string[]) => {
      const field = fields.find((f) => names.some((n) => f.label.toLowerCase().includes(n)))
      return field ? String(sub.values[field.id] ?? "").trim() : ""
    }
    const name = readValue(["name", "contact"]) || "Form respondent"
    const company = readValue(["company", "business"]) || "Unknown company"
    const email = readValue(["email"])
    const contactNumber = readValue(["phone", "mobile", "contact"]) || "-"
    const address = readValue(["address", "location"]) || "-"
    if (!email) { setMessage("No email field found in this response."); return }
    const response = await fetch(CUSTOMERS_API_BASE, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company, email, contactNumber, address, notes: `Created from form response on ${formatDate(sub.createdAt)}`, specialDiscountPercentage: 0 }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) { setMessage(body?.error ?? "Failed to create customer"); return }
    setMessage("Customer created"); await updateSubmissionStatus(sub._id, "reviewed")
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event; if (!over || active.id === over.id) return
    const oldIdx = fields.findIndex((f) => f.id === active.id)
    const newIdx = fields.findIndex((f) => f.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const next = [...fields]; const [moved] = next.splice(oldIdx, 1); next.splice(newIdx, 0, moved)
    setDraft((cur) => ({ ...cur, fields: next }))
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); addField() }
      if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey) && selectedField) { e.preventDefault(); duplicateField(selectedField) }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedField && !e.metaKey && !e.ctrlKey) { e.preventDefault(); removeField(selectedField.id) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField, fields])

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Forms", href: "/forms" },
    { label: draft.title || "Untitled" },
  ]

  const headerActions = (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs font-medium text-muted-foreground animate-in fade-in">{message}</span>}
      <Badge variant={draft.status === "published" ? "default" : "secondary"} className="text-[11px]">
        {draft.status === "published" ? "Live" : "Draft"}
      </Badge>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button variant="outline" size="sm" onClick={() => void saveForm("draft")} disabled={saving}>
        {saving ? <LoaderIcon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
        Save
      </Button>
      <Button size="sm" onClick={() => void saveForm("published")} disabled={saving}>Publish</Button>
    </div>
  )

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={breadcrumbs} />
        <div className="flex flex-1 items-center justify-center"><LoaderIcon className="size-5 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={breadcrumbs} actions={headerActions} />

      <Tabs defaultValue="create" className="flex min-h-0 flex-1 flex-row gap-0">
        <QuestionSidebar
          fields={fields} selected={selected} setSelected={setSelected}
          sensors={sensors} handleDragEnd={handleDragEnd} addField={addField}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b bg-background px-6 py-2">
            <TabsList>
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="share">Share</TabsTrigger>
              <TabsTrigger value="responses">
                Responses
                {submissions.length > 0 && (
                  <span className="ml-1 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] tabular-nums">{submissions.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ---- CREATE ---- */}
          <TabsContent value="create" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-xl px-6 py-8 lg:px-8">

              {selected === "welcome" && (
                <div className="space-y-6">
                  <SectionHeader title="Welcome screen" description="The first thing respondents see when they open your form." />

                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="space-y-5">
                      <FieldRow label="Title">
                        <Input value={draft.title ?? ""} onChange={(e) => updateDraft("title", e.target.value)} placeholder="Form title" />
                      </FieldRow>
                      <FieldRow label="Description">
                        <textarea rows={3} value={draft.description ?? ""} onChange={(e) => updateDraft("description", e.target.value)}
                          placeholder="Describe what this form is about..."
                          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring" />
                      </FieldRow>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <FieldRow label="Slug">
                          <Input value={draft.slug ?? ""} onChange={(e) => updateDraft("slug", e.target.value)} className="font-mono text-xs" />
                        </FieldRow>
                        <FieldRow label="Button label">
                          <Input value={draft.settings?.submitButtonLabel ?? "Submit"} onChange={(e) => patchSettings({ submitButtonLabel: e.target.value })} />
                        </FieldRow>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <p className="mb-4 text-sm font-medium">Preview</p>
                    <div className="overflow-hidden rounded-lg text-white shadow-md" style={{ backgroundColor: draft.branding?.accentColor ?? "#111827" }}>
                      <div className="relative px-8 pb-8 pt-10">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,.18),transparent_50%)]" />
                        <div className="relative space-y-4">
                          <h3 className="text-xl font-semibold leading-tight">{draft.title || "Untitled form"}</h3>
                          {draft.description && <p className="text-sm leading-relaxed text-white/65">{draft.description}</p>}
                          <button type="button" className="rounded-md bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/25">
                            {draft.settings?.submitButtonLabel || "Start"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selected === "ending" && (
                <div className="space-y-6">
                  <SectionHeader title="Thank you screen" description="What respondents see after submitting." />

                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="space-y-5">
                      <FieldRow label="Success message">
                        <textarea rows={3} value={draft.settings?.successMessage ?? ""} onChange={(e) => patchSettings({ successMessage: e.target.value })}
                          placeholder="Thanks! Your response has been recorded."
                          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring" />
                      </FieldRow>
                      <ToggleRow label="Email notifications" description="Get notified when someone submits."
                        checked={draft.settings?.notifyOnSubmission ?? true} onCheckedChange={(v) => patchSettings({ notifyOnSubmission: v })} />
                      <ToggleRow label="Collect device information" description="Record the respondent's device, OS, and browser."
                        checked={draft.settings?.collectDeviceInfo ?? false} onCheckedChange={(v) => patchSettings({ collectDeviceInfo: v })} />
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <p className="mb-4 text-sm font-medium">Preview</p>
                    <div className="rounded-lg border bg-muted/30 px-8 py-10 text-center">
                      <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-emerald-500/15">
                        <svg className="size-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="font-semibold">Response submitted</p>
                      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{draft.settings?.successMessage || "Thanks! Your response has been recorded."}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedField && selectedFieldIndex >= 0 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold tabular-nums text-background">
                        {selectedFieldIndex + 1}
                      </span>
                      <div>
                        <h2 className="text-base font-semibold leading-tight">{selectedField.label || "Untitled question"}</h2>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{FIELD_TYPE_META[selectedField.type].label}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => duplicateField(selectedField)} title="Duplicate">
                        <CopyIcon className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeField(selectedField.id)} title="Delete">
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="space-y-5">
                      <FieldRow label="Question">
                        <Input value={selectedField.label} onChange={(e) => updateField(selectedFieldIndex, { label: e.target.value })} placeholder="Type your question" />
                      </FieldRow>

                      <FieldRow label="Description (optional)">
                        <Input value={selectedField.description ?? ""} onChange={(e) => updateField(selectedFieldIndex, { description: e.target.value || null })} placeholder="Add helper text for respondents" />
                      </FieldRow>

                      <div className="space-y-2">
                        <Label className="text-[13px] text-muted-foreground">Type</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(Object.entries(FIELD_TYPE_META) as [FieldType, (typeof FIELD_TYPE_META)[FieldType]][]).map(([type, meta]) => (
                            <button key={type} type="button" onClick={() => updateField(selectedFieldIndex, { type })}
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2.5 py-2 text-[13px] transition-all",
                                selectedField.type === type
                                  ? "border-foreground bg-foreground text-background shadow-sm"
                                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}>
                              <span className="shrink-0">{meta.icon}</span>
                              <span className="truncate">{meta.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <FieldRow label="Placeholder">
                        <Input value={selectedField.placeholder ?? ""} onChange={(e) => updateField(selectedFieldIndex, { placeholder: e.target.value })} placeholder="Optional placeholder text" />
                      </FieldRow>

                      <ToggleRow label="Required" description="Respondent must answer this question"
                        checked={selectedField.required} onCheckedChange={(v) => updateField(selectedFieldIndex, { required: v })} />

                      {(selectedField.type === "dropdown" || selectedField.type === "checkbox") && (
                        <div className="space-y-2">
                          <Label className="text-[13px] text-muted-foreground">Options</Label>
                          <div className="space-y-1.5">
                            {(selectedField.options ?? []).map((option, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="w-5 text-right text-[11px] tabular-nums text-muted-foreground">{optIdx + 1}</span>
                                <Input value={option} placeholder={`Option ${optIdx + 1}`} className="flex-1"
                                  onChange={(e) => { const opts = [...(selectedField.options ?? [])]; opts[optIdx] = e.target.value; updateField(selectedFieldIndex, { options: opts }) }} />
                                <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => updateField(selectedFieldIndex, { options: (selectedField.options ?? []).filter((_, i) => i !== optIdx) })}>
                                  <Trash2Icon className="size-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <Button variant="ghost" size="sm" className="text-muted-foreground"
                            onClick={() => updateField(selectedFieldIndex, { options: [...(selectedField.options ?? []), ""] })}>
                            <PlusIcon className="size-3.5" /> Add option
                          </Button>
                        </div>
                      )}

                      {selectedField.type === "file" && (
                        <div className="space-y-4 rounded-lg bg-muted/40 p-4">
                          <p className="text-[13px] font-medium">File upload settings</p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FieldRow label="Max size (MB)">
                              <Input type="number" min="1" max="50" value={selectedField.maxFileSizeMb ?? 10}
                                onChange={(e) => updateField(selectedFieldIndex, { maxFileSizeMb: Number(e.target.value) })} />
                            </FieldRow>
                            <FieldRow label="Allowed types">
                              <Input value={(selectedField.allowedMimeTypes ?? []).join(", ")} placeholder="application/pdf, image/png"
                                onChange={(e) => updateField(selectedFieldIndex, { allowedMimeTypes: e.target.value.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean) })} />
                            </FieldRow>
                          </div>
                          <ToggleRow label="Multiple files" checked={Boolean(selectedField.multiple)}
                            onCheckedChange={(v) => updateField(selectedFieldIndex, { multiple: v })} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---- APPEARANCE ---- */}
          <TabsContent value="appearance" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-xl px-6 py-8 lg:px-8">
              <div className="space-y-6">
                <SectionHeader title="Appearance" description="Customize how your form looks to respondents." />

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Theme presets</p>
                  <div className="grid grid-cols-4 gap-3">
                    {THEME_PRESETS.map((preset) => {
                      const isActive = draft.branding?.theme === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyTheme(preset.id)}
                          className={cn(
                            "group relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                            isActive ? "border-foreground shadow-sm" : "border-transparent hover:border-muted-foreground/30 hover:bg-muted/50",
                          )}
                        >
                          <div className="flex size-8 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: preset.accent }}>
                            {isActive && <CheckIcon className="size-3.5 text-white" />}
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Accent color</p>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input type="color" value={draft.branding?.accentColor ?? "#111827"} onChange={(e) => patchBranding({ accentColor: e.target.value, theme: null })}
                        className="absolute inset-0 cursor-pointer opacity-0" />
                      <div className="size-9 rounded-lg border shadow-sm" style={{ backgroundColor: draft.branding?.accentColor ?? "#111827" }} />
                    </div>
                    <Input value={draft.branding?.accentColor ?? "#111827"} onChange={(e) => patchBranding({ accentColor: e.target.value, theme: null })} className="w-28 font-mono text-xs" />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Background</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {(["none", "solid", "gradient"] as const).map((type) => (
                        <button key={type} type="button"
                          onClick={() => patchBranding({ backgroundType: type, theme: null })}
                          className={cn(
                            "rounded-lg border-2 px-3 py-2 text-[13px] font-medium capitalize transition-all",
                            draft.branding?.backgroundType === type || (!draft.branding?.backgroundType && type === "none")
                              ? "border-foreground bg-foreground/5"
                              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
                          )}>
                          {type === "none" ? "White" : type}
                        </button>
                      ))}
                    </div>

                    {draft.branding?.backgroundType === "solid" && (
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input type="color" value={draft.branding?.backgroundColor ?? "#f5f5f4"} onChange={(e) => patchBranding({ backgroundColor: e.target.value, theme: null })}
                            className="absolute inset-0 cursor-pointer opacity-0" />
                          <div className="size-9 rounded-lg border shadow-sm" style={{ backgroundColor: draft.branding?.backgroundColor ?? "#f5f5f4" }} />
                        </div>
                        <Input value={draft.branding?.backgroundColor ?? "#f5f5f4"} onChange={(e) => patchBranding({ backgroundColor: e.target.value, theme: null })} className="w-28 font-mono text-xs" />
                      </div>
                    )}

                    {draft.branding?.backgroundType === "gradient" && (
                      <FieldRow label="CSS gradient">
                        <Input
                          value={draft.branding?.backgroundGradient ?? "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)"}
                          onChange={(e) => patchBranding({ backgroundGradient: e.target.value, theme: null })}
                          placeholder="linear-gradient(135deg, #e0f2fe, #bae6fd)"
                          className="font-mono text-xs"
                        />
                      </FieldRow>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Border radius</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "sm" as const, label: "Sharp", radius: "4px" },
                      { value: "md" as const, label: "Rounded", radius: "12px" },
                      { value: "lg" as const, label: "Pill", radius: "24px" },
                    ]).map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => patchBranding({ borderRadius: opt.value, theme: null })}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                          (draft.branding?.borderRadius ?? "md") === opt.value
                            ? "border-foreground bg-foreground/5"
                            : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
                        )}>
                        <div className="h-6 w-12 border-2 border-current" style={{ borderRadius: opt.radius }} />
                        <span className="text-[11px] font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Logo</p>
                  <FieldRow label="Logo URL">
                    <Input value={draft.branding?.logoUrl ?? ""} onChange={(e) => patchBranding({ logoUrl: e.target.value || null })} placeholder="https://example.com/logo.png" className="text-xs" />
                  </FieldRow>
                  {draft.branding?.logoUrl && (
                    <div className="mt-4 flex items-center gap-3">
                      <img src={draft.branding.logoUrl} alt="Logo preview" className="size-12 rounded-lg border object-contain" />
                      <span className="text-xs text-muted-foreground">Logo preview</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <p className="mb-4 text-sm font-medium">Live preview</p>
                  <div
                    className="flex items-center justify-center overflow-hidden p-8"
                    style={{
                      background: draft.branding?.backgroundType === "gradient" && draft.branding.backgroundGradient
                        ? draft.branding.backgroundGradient
                        : draft.branding?.backgroundType === "solid" && draft.branding.backgroundColor
                          ? draft.branding.backgroundColor
                          : "#ffffff",
                      borderRadius: draft.branding?.borderRadius === "sm" ? "4px" : draft.branding?.borderRadius === "lg" ? "24px" : "12px",
                    }}
                  >
                    <div
                      className="w-full max-w-xs space-y-3 bg-white p-6 shadow-lg"
                      style={{ borderRadius: draft.branding?.borderRadius === "sm" ? "4px" : draft.branding?.borderRadius === "lg" ? "20px" : "12px" }}
                    >
                      <div className="h-2 w-16 rounded-full" style={{ backgroundColor: draft.branding?.accentColor ?? "#111827" }} />
                      <div className="h-2 w-32 rounded-full bg-muted" />
                      <div className="h-8 rounded-md border" />
                      <div className="h-8 rounded-md text-white text-xs font-medium flex items-center justify-center" style={{ backgroundColor: draft.branding?.accentColor ?? "#111827" }}>
                        Submit
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---- SHARE ---- */}
          <TabsContent value="share" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-xl px-6 py-8 lg:px-8">
              <div className="space-y-6">
                <SectionHeader title="Share" description="Share a direct link or embed the form on your site." />

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <LinkIcon className="size-4 text-muted-foreground" /> Public link
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={draft.slug ? publicUrl(draft.slug) : "Save the form first"} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => draft.slug && navigator.clipboard.writeText(publicUrl(draft.slug))}>
                      <CopyIcon className="size-3.5" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={draft.slug ? publicUrl(draft.slug) : "#"} target="_blank" rel="noreferrer"><EyeIcon className="size-3.5" /> Preview</a>
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                    <CodeXmlIcon className="size-4 text-muted-foreground" /> Embed code
                  </div>
                  <textarea readOnly rows={4} value={draft.slug ? embedSnippet(draft.slug) : ""}
                    className="w-full rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground outline-none" />
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => draft.slug && navigator.clipboard.writeText(embedSnippet(draft.slug))}>
                    <CopyIcon className="size-3.5" /> Copy embed code
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---- RESPONSES ---- */}
          <TabsContent value="responses" className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 p-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Responses</h2>
                  <p className="text-[13px] text-muted-foreground">{submissions.length} response{submissions.length !== 1 && "s"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void fetchSubmissions()} disabled={refreshing}>
                    <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
                    Refresh
                  </Button>
                  {form && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`${API_BASE}/${form._id}/submissions/export`}><DownloadIcon className="size-3.5" /> Export CSV</a>
                    </Button>
                  )}
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="rounded-xl border border-dashed px-6 py-20 text-center">
                  <InboxIcon className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                  <p className="font-medium text-muted-foreground">No responses yet</p>
                  <p className="mt-1 text-sm text-muted-foreground/70">Share your form to start collecting data.</p>
                </div>
              ) : (
                <div className="rounded-xl border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8 text-center">#</TableHead>
                        <SortableHead label="Submitted" sortKey="createdAt" currentKey={sortKey} dir={sortDir} onToggle={toggleSort} />
                        <SortableHead label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onToggle={toggleSort} />
                        <SortableHead label="Source" sortKey="source" currentKey={sortKey} dir={sortDir} onToggle={toggleSort} />
                        {collectDeviceInfo && <TableHead>Device</TableHead>}
                        {fields.map((f) => (
                          <TableHead key={f.id} className="max-w-[180px]">{f.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSubmissions.map((sub, i) => (
                        <TableRow key={sub._id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => setDetailId(sub._id)}>
                          <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-[13px]">{formatDate(sub.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === "new" ? "default" : "outline"} className="text-[10px] capitalize">
                              {sub.status === "new" && <CircleIcon className="size-1.5 fill-current" />}
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">{sub.source}</TableCell>
                          {collectDeviceInfo && (
                            <TableCell className="text-[13px] text-muted-foreground">
                              {sub.metadata?.device ?? "-"}
                            </TableCell>
                          )}
                          {fields.map((f) => (
                            <TableCell key={f.id} className="max-w-[180px] truncate text-[13px]">
                              {formatResponseValue(sub.values[f.id])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Sheet open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
              <SheetContent className="overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Submission details</SheetTitle>
                </SheetHeader>
                {detailSubmission && (
                  <div className="space-y-5 px-4 pb-8">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                        <p className="mt-0.5 font-medium">{formatDate(detailSubmission.createdAt)}</p>
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

                    {collectDeviceInfo && (detailSubmission.metadata?.device || detailSubmission.metadata?.os || detailSubmission.metadata?.browser) && (
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
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                          <ResponseValue value={detailSubmission.values[field.id]} />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button size="sm" variant="outline" onClick={() => void createCustomerFromSubmission(detailSubmission)}>Create customer</Button>
                      <Button size="sm" variant={detailSubmission.status === "reviewed" ? "default" : "outline"}
                        onClick={() => void updateSubmissionStatus(detailSubmission._id, "reviewed")}>
                        Reviewed
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void updateSubmissionStatus(detailSubmission._id, "archived")}>
                        <ArchiveIcon className="size-3.5" /> Archive
                      </Button>
                    </div>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>
        </div>
      </Tabs>
    </AppLayout>
  )
}

function QuestionSidebar({ fields, selected, setSelected, sensors, handleDragEnd, addField }: {
  fields: FormField[]
  selected: SelectedItem
  setSelected: (v: SelectedItem) => void
  sensors: ReturnType<typeof useSensors>
  handleDragEnd: (e: DragEndEvent) => void
  addField: () => void
}) {
  const [width, setWidth] = useState(224)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX
    const startW = width
    function onMove(ev: PointerEvent) {
      const next = Math.max(180, Math.min(360, startW + (ev.clientX - startX)))
      setWidth(next)
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <aside className="relative hidden shrink-0 lg:flex" style={{ width }}>
      <div className="flex h-full w-full flex-col border-r bg-muted/30">
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Content</p>

          <button onClick={() => setSelected("welcome")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-all",
              selected === "welcome" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}>
            <span className="font-medium">Welcome</span>
          </button>

          <div className="my-2 border-t" />
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Questions</p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-px">
                {fields.map((field, i) => (
                  <SortableFieldItem key={field.id} field={field} index={i} isSelected={selected === field.id} onSelect={() => setSelected(field.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button onClick={addField}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
            <PlusIcon className="size-4" />
            Add question
          </button>

          <div className="my-2 border-t" />
          <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Endings</p>

          <button onClick={() => setSelected("ending")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-all",
              selected === "ending" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}>
            <span className="font-medium">Thank you</span>
          </button>
        </div>
      </div>
      <div onPointerDown={onPointerDown}
        className={cn(
          "absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-foreground/10",
          dragging && "bg-foreground/15",
        )} />
    </aside>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-[12px] text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SortableHead({ label, sortKey, currentKey, dir, onToggle }: {
  label: string; sortKey: string; currentKey: string; dir: "asc" | "desc"; onToggle: (key: string) => void
}) {
  const active = currentKey === sortKey
  return (
    <TableHead>
      <button type="button" onClick={() => onToggle(sortKey)}
        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground">
        {label}
        {active && (dir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
      </button>
    </TableHead>
  )
}
