import { FormEvent, useEffect, useMemo, useState } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { AlertCircleIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

type FieldType = "short_text" | "long_text" | "email" | "phone" | "number" | "dropdown" | "checkbox" | "date"

type PublicField = {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string | null
  options?: string[]
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
  field,
  value,
  error,
  onChange,
}: {
  field: PublicField
  value: unknown
  error?: string
  onChange: (value: unknown) => void
}) {
  const id = `public-${field.id}`
  const baseClass = error ? "border-destructive focus-visible:ring-destructive/20" : ""

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.type === "long_text" ? (
        <textarea
          id={id}
          rows={5}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? undefined}
          className={`rounded-xl border bg-white/80 px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-3 focus-visible:ring-black/10 ${baseClass}`}
        />
      ) : field.type === "dropdown" ? (
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 rounded-xl border bg-white/80 px-3 text-sm shadow-sm outline-none ${baseClass}`}
        >
          <option value="">Choose an option</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <div className="grid gap-2 rounded-xl border bg-white/70 p-3">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) ? value.includes(option) : false
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => {
                    const current = Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
                    onChange(event.target.checked ? [...current, option] : current.filter((item) => item !== option))
                  }}
                />
                {option}
              </label>
            )
          })}
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "short_text" || field.type === "phone" ? "text" : field.type}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder ?? undefined}
          className={`rounded-xl bg-white/80 shadow-sm ${baseClass}`}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function PublicFormPage() {
  const { slug } = useParams({ from: "/f/$slug" })
  const search = useSearch({ strict: false }) as { embed?: string }
  const isEmbed = search.embed === "1"
  const [form, setForm] = useState<PublicForm | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_ORIGIN}/api/v1/public/forms/${slug}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("This form is not available"))))
      .then((data: PublicForm) => setForm(data))
      .catch((error) => setFatalError(error instanceof Error ? error.message : "This form is not available"))
      .finally(() => setLoading(false))
  }, [slug])

  const accent = form?.branding.accentColor || "#111827"
  const initialLetters = useMemo(() => form?.title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") ?? "IN", [form])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setSubmitting(true)
    setErrors({})
    setFatalError(null)

    const payload = {
      website: (event.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "",
      source: isEmbed ? "embed" : "link",
      values,
    }

    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/public/forms/${form.slug}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        setErrors(responsePayload?.errors ?? {})
        throw new Error(responsePayload?.error ?? "Unable to submit form")
      }
      setSuccessMessage(responsePayload?.message ?? form.settings.successMessage)
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to submit form")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={isEmbed ? "min-h-screen bg-transparent p-2" : "min-h-screen bg-stone-100 p-4 sm:p-8"}>
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-[2rem] border bg-white shadow-2xl shadow-stone-900/10">
          <div className="relative p-8 text-white" style={{ backgroundColor: accent }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,.28),transparent_35%)]" />
            <div className="relative flex items-start gap-4">
              {form?.branding.logoUrl ? (
                <img src={form.branding.logoUrl} alt="" className="size-14 rounded-2xl bg-white object-contain p-2" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
                  {initialLetters}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Inboundr form</p>
                <h1 className="mt-2 text-2xl font-bold">{form?.title ?? "Loading form..."}</h1>
                {form?.description && <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{form.description}</p>}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    error={errors[field.id]}
                    onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
                  />
                ))}
                {fatalError && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircleIcon className="size-4" />
                    {fatalError}
                  </div>
                )}
                <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting} style={{ backgroundColor: accent }}>
                  {submitting && <LoaderIcon className="size-4 animate-spin" />}
                  {form.settings.submitButtonLabel}
                </Button>
              </form>
            ) : (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive">
                {fatalError ?? "This form is not available"}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
