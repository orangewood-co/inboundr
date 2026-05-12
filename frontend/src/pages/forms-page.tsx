import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react"
import {
  ArchiveIcon,
  ClipboardListIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/forms`
const CUSTOMERS_API_BASE = `${API_ORIGIN}/api/v1/customers`
const UPLOADS_API_BASE = `${API_ORIGIN}/api/v1/uploads`

type FieldType = "short_text" | "long_text" | "email" | "phone" | "number" | "dropdown" | "checkbox" | "date" | "file"

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
  settings: { submitButtonLabel: string; successMessage: string; notifyOnSubmission: boolean }
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

const starterField = (): FormField => ({
  id: `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  label: "Customer email",
  type: "email",
  required: true,
  placeholder: "name@company.com",
  options: [],
  maxFileSizeMb: 10,
  allowedMimeTypes: [],
  multiple: false,
})

const defaultDraft = (): Partial<ManagedForm> => ({
  title: "New customer intake",
  description: "Tell us what you need and our team will get back to you.",
  slug: `customer-intake-${Date.now().toString(36)}`,
  status: "draft",
  fields: [starterField()],
  branding: { accentColor: "#111827", logoUrl: null },
  settings: {
    submitButtonLabel: "Submit request",
    successMessage: "Thanks. Your response has been submitted.",
    notifyOnSubmission: true,
  },
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function publicUrl(slug: string) {
  return `${window.location.origin}/f/${slug}`
}

function embedSnippet(slug: string) {
  return `<iframe src="${publicUrl(slug)}?embed=1" width="100%" height="720" style="border:0;border-radius:16px;overflow:hidden" loading="lazy"></iframe>`
}

function formatResponseValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "originalName" in item
          ? String((item as { originalName: unknown }).originalName)
          : String(item)
      )
      .join(", ")
  }
  if (value && typeof value === "object" && "originalName" in value) {
    return String((value as { originalName: unknown }).originalName)
  }
  return String(value ?? "-")
}

function isUploadedFileValue(value: unknown): value is UploadedFileValue {
  return Boolean(value && typeof value === "object" && "key" in value && "originalName" in value)
}

function ResponseValue({ value }: { value: unknown }) {
  const files = Array.isArray(value) ? value.filter(isUploadedFileValue) : isUploadedFileValue(value) ? [value] : []

  async function openFile(file: UploadedFileValue) {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer")
      return
    }

    const response = await fetch(`${UPLOADS_API_BASE}/view?key=${encodeURIComponent(file.key)}`, {
      credentials: "include",
    })
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

export default function FormsPage() {
  const [forms, setForms] = useState<ManagedForm[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ManagedForm>>(defaultDraft)
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selectedForm = useMemo(
    () => forms.find((form) => form._id === selectedId) ?? null,
    [forms, selectedId]
  )

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch forms")
      const data = (await response.json()) as { forms: ManagedForm[] }
      setForms(data.forms)
      if (!selectedId && data.forms[0]) {
        setSelectedId(data.forms[0]._id)
        setDraft(data.forms[0])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to fetch forms")
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void fetchForms()
  }, [fetchForms])

  useEffect(() => {
    if (!selectedForm) return
    setDraft(selectedForm)
    void fetch(`${API_BASE}/${selectedForm._id}/submissions`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to fetch responses"))))
      .then((data: { submissions: FormSubmission[] }) => setSubmissions(data.submissions))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to fetch responses"))
  }, [selectedForm])

  function updateDraft<K extends keyof ManagedForm>(key: K, value: ManagedForm[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateField(index: number, patch: Partial<FormField>) {
    const fields = [...(draft.fields ?? [])]
    fields[index] = { ...fields[index], ...patch } as FormField
    setDraft((current) => ({ ...current, fields }))
  }

  async function saveForm(status = draft.status ?? "draft") {
    setSaving(true)
    setMessage(null)
    const payload = { ...draft, status }
    const isExisting = Boolean(draft._id)

    try {
      const response = await fetch(isExisting ? `${API_BASE}/${draft._id}` : API_BASE, {
        method: isExisting ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(responsePayload?.error ?? "Unable to save form")
      setSelectedId(responsePayload._id)
      setMessage(status === "published" ? "Form published" : "Form saved")
      await fetchForms()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save form")
    } finally {
      setSaving(false)
    }
  }

  async function archiveForm() {
    if (!draft._id) return
    await fetch(`${API_BASE}/${draft._id}`, { method: "DELETE", credentials: "include" })
    setSelectedId(null)
    setDraft(defaultDraft())
    await fetchForms()
  }

  async function duplicateForm() {
    if (!draft._id) return
    const response = await fetch(`${API_BASE}/${draft._id}/duplicate`, { method: "POST", credentials: "include" })
    if (response.ok) {
      const copy = (await response.json()) as ManagedForm
      setSelectedId(copy._id)
      await fetchForms()
    }
  }

  async function updateSubmissionStatus(submissionId: string, status: FormSubmission["status"]) {
    if (!selectedForm) return
    const response = await fetch(`${API_BASE}/${selectedForm._id}/submissions/${submissionId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (response.ok) {
      setSubmissions((current) =>
        current.map((submission) => (submission._id === submissionId ? { ...submission, status } : submission))
      )
    }
  }

  async function createCustomerFromSubmission(submission: FormSubmission) {
    const readValue = (names: string[]) => {
      const field = fields.find((item) => names.some((name) => item.label.toLowerCase().includes(name)))
      return field ? String(submission.values[field.id] ?? "").trim() : ""
    }
    const name = readValue(["name", "contact"]) || "Form respondent"
    const company = readValue(["company", "business"]) || "Unknown company"
    const email = readValue(["email"])
    const contactNumber = readValue(["phone", "mobile", "contact"]) || "-"
    const address = readValue(["address", "location"]) || "-"

    if (!email) {
      setMessage("This response does not include an email field to create a customer.")
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
        notes: `Created from form response on ${formatDate(submission.createdAt)}`,
        specialDiscountPercentage: 0,
      }),
    })
    const responsePayload = await response.json().catch(() => null)
    if (!response.ok) {
      setMessage(responsePayload?.error ?? "Unable to create customer")
      return
    }
    setMessage("Customer created from response")
    await updateSubmissionStatus(submission._id, "reviewed")
  }

  const fields = draft.fields ?? []

  return (
    <SidebarProvider defaultOpen style={{ "--header-height": "4rem", "--sidebar-width": "18rem" } as CSSProperties}>
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-80 shrink-0 border-r bg-muted/20 lg:block">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold">Forms</p>
                <p className="text-xs text-muted-foreground">{forms.length} active forms</p>
              </div>
              <Button size="sm" onClick={() => { setSelectedId(null); setDraft(defaultDraft()); setSubmissions([]) }}>
                <PlusIcon className="size-4" />
                New
              </Button>
            </div>
            <div className="space-y-2 p-3">
              {loading ? (
                <p className="p-3 text-sm text-muted-foreground">Loading forms...</p>
              ) : forms.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Create your first customer-facing form.</p>
              ) : (
                forms.map((form) => (
                  <button
                    key={form._id}
                    className={cn(
                      "w-full rounded-xl border bg-background p-3 text-left transition hover:border-primary/50",
                      selectedId === form._id && "border-primary shadow-sm"
                    )}
                    onClick={() => setSelectedId(form._id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{form.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {form.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{form.submissionCount} responses</p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-auto">
            <div className="border-b bg-background/95 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10">
                    <ClipboardListIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold">Form studio</h1>
                    <p className="text-sm text-muted-foreground">Create intake forms, embed them, and review responses.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void fetchForms()}>
                    <RefreshCwIcon className="size-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={() => void saveForm("draft")} disabled={saving}>
                    {saving ? <LoaderIcon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                    Save draft
                  </Button>
                  <Button onClick={() => void saveForm("published")} disabled={saving}>
                    Publish
                  </Button>
                </div>
              </div>
              {message && <p className="mt-3 rounded-xl border bg-muted/40 px-3 py-2 text-sm">{message}</p>}
            </div>

            <Tabs defaultValue="builder" className="p-5">
              <TabsList>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="share">Share</TabsTrigger>
                <TabsTrigger value="responses">Responses</TabsTrigger>
              </TabsList>

              <TabsContent value="builder" className="mt-5 grid gap-5 xl:grid-cols-[1fr_24rem]">
                <section className="space-y-5 rounded-2xl border bg-background p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Form title</Label>
                      <Input id="title" value={draft.title ?? ""} onChange={(event) => updateDraft("title", event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="slug">Public slug</Label>
                      <Input id="slug" value={draft.slug ?? ""} onChange={(event) => updateDraft("slug", event.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      rows={3}
                      value={draft.description ?? ""}
                      onChange={(event) => updateDraft("description", event.target.value)}
                      className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Fields</h2>
                    <Button variant="outline" size="sm" onClick={() => updateDraft("fields", [...fields, starterField()])}>
                      <PlusIcon className="size-4" />
                      Add field
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="rounded-2xl border bg-muted/20 p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_12rem_7rem_2rem]">
                          <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Question label" />
                          <select
                            value={field.type}
                            onChange={(event) => updateField(index, { type: event.target.value as FieldType })}
                            className="rounded-md border bg-background px-3 py-2 text-sm"
                          >
                            <option value="short_text">Short text</option>
                            <option value="long_text">Long text</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="number">Number</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="date">Date</option>
                            <option value="file">File upload</option>
                          </select>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />
                            Required
                          </label>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => updateDraft("fields", fields.filter((item) => item.id !== field.id))}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                        <Input
                          className="mt-3"
                          value={field.placeholder ?? ""}
                          onChange={(event) => updateField(index, { placeholder: event.target.value })}
                          placeholder="Placeholder text"
                        />
                        {(field.type === "dropdown" || field.type === "checkbox") && (
                          <Input
                            className="mt-3"
                            value={(field.options ?? []).join(", ")}
                            onChange={(event) => updateField(index, { options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })}
                            placeholder="Options, separated by commas"
                          />
                        )}
                        {field.type === "file" && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr_8rem]">
                            <div className="grid gap-2">
                              <Label>Max size MB</Label>
                              <Input
                                type="number"
                                min="1"
                                max="50"
                                value={field.maxFileSizeMb ?? 10}
                                onChange={(event) => updateField(index, { maxFileSizeMb: Number(event.target.value) })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Allowed MIME types</Label>
                              <Input
                                value={(field.allowedMimeTypes ?? []).join(", ")}
                                onChange={(event) =>
                                  updateField(index, {
                                    allowedMimeTypes: event.target.value
                                      .split(",")
                                      .map((mime) => mime.trim().toLowerCase())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="application/pdf, image/png"
                              />
                            </div>
                            <label className="flex items-end gap-2 pb-2 text-sm">
                              <input type="checkbox" checked={Boolean(field.multiple)} onChange={(event) => updateField(index, { multiple: event.target.checked })} />
                              Multiple files
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border bg-[radial-gradient(circle_at_top_right,var(--muted),transparent_45%)] p-5">
                  <h2 className="font-semibold">Appearance and success</h2>
                  <div className="grid gap-2">
                    <Label htmlFor="accent">Accent color</Label>
                    <Input
                      id="accent"
                      value={draft.branding?.accentColor ?? "#111827"}
                      onChange={(event) => setDraft((current) => ({ ...current, branding: { ...(current.branding ?? { logoUrl: null }), accentColor: event.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="buttonLabel">Submit button label</Label>
                    <Input
                      id="buttonLabel"
                      value={draft.settings?.submitButtonLabel ?? "Submit"}
                      onChange={(event) => setDraft((current) => ({ ...current, settings: { ...(current.settings ?? defaultDraft().settings!), submitButtonLabel: event.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="success">Success message</Label>
                    <textarea
                      id="success"
                      rows={4}
                      value={draft.settings?.successMessage ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, settings: { ...(current.settings ?? defaultDraft().settings!), successMessage: event.target.value } }))}
                      className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="share" className="mt-5 space-y-5">
                <div className="rounded-2xl border p-5">
                  <h2 className="font-semibold">Public link</h2>
                  <div className="mt-3 flex gap-2">
                    <Input readOnly value={draft.slug ? publicUrl(draft.slug) : "Save the form to generate a link"} />
                    <Button variant="outline" onClick={() => draft.slug && navigator.clipboard.writeText(publicUrl(draft.slug))}>
                      <CopyIcon className="size-4" />
                      Copy
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={draft.slug ? `/f/${draft.slug}` : "#"} target="_blank" rel="noreferrer">
                        <EyeIcon className="size-4" />
                        Preview
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border p-5">
                  <h2 className="font-semibold">Iframe embed</h2>
                  <textarea readOnly rows={5} value={draft.slug ? embedSnippet(draft.slug) : ""} className="mt-3 w-full rounded-xl border bg-muted/30 p-3 font-mono text-xs" />
                </div>
              </TabsContent>

              <TabsContent value="responses" className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <h2 className="font-semibold">Responses</h2>
                    <p className="text-sm text-muted-foreground">{submissions.length} latest responses</p>
                  </div>
                  {selectedForm && (
                    <Button variant="outline" asChild>
                      <a href={`${API_BASE}/${selectedForm._id}/submissions/export`}>
                        <DownloadIcon className="size-4" />
                        Export CSV
                      </a>
                    </Button>
                  )}
                </div>
                {submissions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No responses yet.</div>
                ) : (
                  submissions.map((submission) => (
                    <div key={submission._id} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{formatDate(submission.createdAt)}</span>
                          <span className="ml-2 text-muted-foreground">via {submission.source}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => void createCustomerFromSubmission(submission)}>
                            Create customer
                          </Button>
                          <Button size="sm" variant={submission.status === "reviewed" ? "default" : "outline"} onClick={() => void updateSubmissionStatus(submission._id, "reviewed")}>
                            Reviewed
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void updateSubmissionStatus(submission._id, "archived")}>
                            <ArchiveIcon className="size-4" />
                            Archive
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {fields.map((field) => (
                          <div key={field.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                            <ResponseValue value={submission.values[field.id]} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
