import { type FormEvent, useEffect, useMemo, useState } from "react"
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

type FieldType = "short_text" | "long_text" | "email" | "phone" | "number" | "dropdown" | "checkbox" | "date" | "file"

type PublicField = {
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

type UploadedFile = {
  key: string
  bucket: string
  originalName: string
  contentType: string
  size: number
  uploadedAt: string | null
  url: string | null
}

type PublicForm = {
  title: string
  description: string | null
  slug: string
  fields: PublicField[]
  branding: { accentColor: string; logoUrl: string | null }
  settings: { submitButtonLabel: string; successMessage: string }
}

function FieldInput({
  field, value, error, onChange, onUpload, uploading,
}: {
  field: PublicField
  value: unknown
  error?: string
  onChange: (value: unknown) => void
  onUpload?: (files: FileList) => Promise<void>
  uploading?: boolean
}) {
  const id = `field-${field.id}`
  const errorRing = error ? "ring-2 ring-red-300" : ""

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-semibold text-stone-800">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </Label>

      {field.type === "file" ? (
        <div className={`rounded-xl border border-stone-200 bg-white p-3 ${errorRing}`}>
          <input
            id={id}
            type="file"
            multiple={Boolean(field.multiple)}
            accept={(field.allowedMimeTypes ?? []).join(",")}
            onChange={(e) => e.target.files && onUpload?.(e.target.files)}
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <p className="mt-2 text-xs text-stone-400">
            Max {field.maxFileSizeMb ?? 10}MB{field.allowedMimeTypes?.length ? ` · ${field.allowedMimeTypes.join(", ")}` : ""}
          </p>
          {uploading && <p className="mt-2 text-xs font-medium text-stone-600">Uploading...</p>}
          {Array.isArray(value) && value.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-stone-600">
              {(value as UploadedFile[]).map((f) => <li key={f.key}>{f.originalName}</li>)}
            </ul>
          )}
          {!Array.isArray(value) && value && typeof value === "object" && "originalName" in value && (
            <p className="mt-2 text-xs text-stone-600">{String((value as UploadedFile).originalName)}</p>
          )}
        </div>
      ) : field.type === "long_text" ? (
        <textarea
          id={id} rows={5}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          className={`w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300 ${errorRing}`}
        />
      ) : field.type === "dropdown" ? (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-stone-300 ${errorRing}`}
        >
          <option value="">Choose an option</option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === "checkbox" ? (
        <div className={`grid gap-2 rounded-xl border border-stone-200 bg-white p-3 ${errorRing}`}>
          {(field.options ?? []).map((opt) => {
            const checked = Array.isArray(value) ? value.includes(opt) : false
            return (
              <label key={opt} className="flex items-center gap-2 text-sm text-stone-800">
                <input type="checkbox" checked={checked}
                  onChange={(e) => {
                    const cur = Array.isArray(value) ? value.filter((v) => typeof v === "string") : []
                    onChange(e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt))
                  }} />
                {opt}
              </label>
            )
          })}
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "short_text" || field.type === "phone" ? "text" : field.type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? undefined}
          className={errorRing}
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default function FormPage({ slug, embed = false }: { slug: string; embed?: boolean }) {
  const [form, setForm] = useState<PublicForm | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_ORIGIN}/api/v1/public/forms/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This form is not available"))))
      .then((data: PublicForm) => setForm(data))
      .catch((err) => setFatalError(err instanceof Error ? err.message : "This form is not available"))
      .finally(() => setLoading(false))
  }, [slug])

  const accent = form?.branding.accentColor || "#111827"
  const initials = useMemo(() => form?.title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") ?? "IN", [form])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form) return
    setSubmitting(true); setErrors({}); setFatalError(null)

    const payload = {
      website: (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "",
      source: embed ? "embed" : "link",
      values,
    }

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/forms/${form.slug}/submissions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setErrors(body?.errors ?? {}); throw new Error(body?.error ?? "Unable to submit form") }
      setSuccessMessage(body?.message ?? form.settings.successMessage)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : "Unable to submit form")
    } finally { setSubmitting(false) }
  }

  async function uploadFiles(field: PublicField, files: FileList) {
    if (!form) return
    setUploadingFieldId(field.id)
    setErrors((cur) => ({ ...cur, [field.id]: "" }))
    setFatalError(null)

    try {
      const uploaded: UploadedFile[] = []
      for (const file of Array.from(files)) {
        if (file.size > (field.maxFileSizeMb ?? 10) * 1024 * 1024)
          throw new Error(`${file.name} is larger than ${field.maxFileSizeMb ?? 10}MB`)
        if (field.allowedMimeTypes?.length && !field.allowedMimeTypes.includes(file.type))
          throw new Error(`${file.name} is not an allowed file type`)

        const presignRes = await fetch(`${API_ORIGIN}/api/v1/public/forms/${form.slug}/uploads/presign`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldId: field.id, fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }),
        })
        const presign = await presignRes.json().catch(() => null)
        if (!presignRes.ok) throw new Error(presign?.error ?? "Unable to prepare upload")

        const uploadRes = await fetch(presign.uploadUrl, { method: presign.method, headers: presign.headers, body: file })
        if (!uploadRes.ok) throw new Error(`Unable to upload ${file.name}`)
        uploaded.push({ ...presign.file, uploadedAt: new Date().toISOString() })
      }
      setValues((cur) => ({ ...cur, [field.id]: field.multiple ? uploaded : uploaded[0] }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to upload file"
      setErrors((cur) => ({ ...cur, [field.id]: msg }))
      setFatalError(msg)
    } finally { setUploadingFieldId(null) }
  }

  return (
    <main className={embed ? "min-h-screen bg-transparent p-2" : "min-h-screen bg-stone-100 p-4 sm:p-8"}>
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-2xl shadow-stone-900/10">
          {/* Header */}
          <div className="relative p-8 text-white" style={{ backgroundColor: accent }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.28),transparent_35%)]" />
            <div className="relative flex items-start gap-4">
              {form?.branding.logoUrl ? (
                <img src={form.branding.logoUrl} alt="" className="size-14 rounded-2xl bg-white object-contain p-2" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">{initials}</div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Inboundr form</p>
                <h1 className="mt-2 text-2xl font-bold">{form?.title ?? "Loading form..."}</h1>
                {form?.description && <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{form.description}</p>}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <LoaderIcon className="size-4 animate-spin" />
                Loading form
              </div>
            ) : successMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <CheckCircle2Icon className="mb-3 size-6" />
                <p className="font-semibold">Response submitted</p>
                <p className="mt-1 text-sm">{successMessage}</p>
              </div>
            ) : form ? (
              <form onSubmit={submit} className="space-y-5">
                <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />
                {form.fields.map((field) => (
                  <FieldInput
                    key={field.id} field={field} value={values[field.id]} error={errors[field.id]}
                    onChange={(v) => setValues((cur) => ({ ...cur, [field.id]: v }))}
                    onUpload={(files) => uploadFiles(field, files)}
                    uploading={uploadingFieldId === field.id}
                  />
                ))}
                {fatalError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircleIcon className="size-4" />
                    {fatalError}
                  </div>
                )}
                <Button type="submit" className="h-11 w-full rounded-xl text-white" disabled={submitting} style={{ backgroundColor: accent }}>
                  {submitting && <LoaderIcon className="size-4 animate-spin" />}
                  {form.settings.submitButtonLabel}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                {fatalError ?? "This form is not available"}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
