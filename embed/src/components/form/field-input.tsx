import { useEffect, useRef } from "react"
import type { PublicField, UploadedFile } from "./types"

export function FieldInput({
  field,
  value,
  accent,
  onChange,
  onUpload,
  uploading,
  onSubmit,
}: {
  field: PublicField
  value: unknown
  accent: string
  onChange: (value: unknown) => void
  onUpload?: (files: FileList) => Promise<void>
  uploading?: boolean
  onSubmit?: () => void
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const uploadedFile = !Array.isArray(value) && isUploadedFile(value) ? value : null

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(timer)
  }, [field.id])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && field.type !== "long_text" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  const baseInputClasses =
    "w-full border-0 border-b-2 border-stone-200 bg-transparent px-0 py-3 text-2xl sm:text-3xl font-medium text-stone-900 placeholder:text-stone-300 outline-none transition-colors focus:border-current"

  if (field.type === "file") {
    return (
      <div className="space-y-4">
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-8 transition-colors hover:border-stone-400"
          style={{ "--tw-ring-color": accent } as React.CSSProperties}
        >
          <svg className="mb-3 size-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-sm font-medium text-stone-600">
            Click to upload {field.multiple ? "files" : "a file"}
          </span>
          <span className="mt-1 text-xs text-stone-400">
            Max {field.maxFileSizeMb ?? 10}MB
            {field.allowedMimeTypes?.length ? ` · ${field.allowedMimeTypes.join(", ")}` : ""}
          </span>
          <input
            type="file"
            multiple={Boolean(field.multiple)}
            accept={(field.allowedMimeTypes ?? []).join(",")}
            onChange={(e) => e.target.files && onUpload?.(e.target.files)}
            className="hidden"
          />
        </label>
        {uploading && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <div className="size-4 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
            Uploading...
          </div>
        )}
        {Array.isArray(value) && value.length > 0 && (
          <ul className="space-y-1 text-sm text-stone-600">
            {(value as UploadedFile[]).map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <svg className="size-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f.originalName}
              </li>
            ))}
          </ul>
        )}
        {uploadedFile && (
          <p className="flex items-center gap-2 text-sm text-stone-600">
            <svg className="size-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {uploadedFile.originalName}
          </p>
        )}
      </div>
    )
  }

  if (field.type === "long_text") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        rows={4}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSubmit?.()
          }
        }}
        placeholder={field.placeholder ?? "Type your answer here..."}
        className={`${baseInputClasses} resize-none text-xl sm:text-2xl`}
        style={{ borderColor: value ? accent : undefined }}
      />
    )
  }

  if (field.type === "dropdown") {
    return (
      <div className="space-y-3">
        {(field.options ?? []).map((opt, i) => {
          const selected = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setTimeout(() => onSubmit?.(), 300)
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left text-lg font-medium transition-all ${
                selected
                  ? "border-current bg-stone-50 text-stone-900"
                  : "border-stone-200 text-stone-600 hover:border-stone-400 hover:bg-stone-50"
              }`}
              style={selected ? { borderColor: accent, color: accent } : undefined}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                selected ? "border-current bg-current text-white" : "border-stone-300 text-stone-400"
              }`}>
                {selected ? (
                  <span style={{ color: "white" }}>{String.fromCharCode(65 + i)}</span>
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className={selected ? "text-stone-900" : ""}>{opt}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === "checkbox") {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="space-y-3">
        {(field.options ?? []).map((opt, i) => {
          const checked = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = checked
                  ? selected.filter((v: string) => v !== opt)
                  : [...selected, opt]
                onChange(next)
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left text-lg font-medium transition-all ${
                checked
                  ? "border-current bg-stone-50 text-stone-900"
                  : "border-stone-200 text-stone-600 hover:border-stone-400 hover:bg-stone-50"
              }`}
              style={checked ? { borderColor: accent, color: accent } : undefined}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold transition-colors ${
                checked ? "border-current bg-current" : "border-stone-300"
              }`}>
                {checked && (
                  <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={checked ? "text-stone-900" : ""}>
                <span className="mr-2 text-xs text-stone-400">{String.fromCharCode(65 + i)}</span>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === "rating") {
    const currentRating = typeof value === "number" ? value : 0
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => {
              onChange(star)
              setTimeout(() => onSubmit?.(), 400)
            }}
            className="transition-transform hover:scale-110"
          >
            <svg
              className="size-10 sm:size-12"
              viewBox="0 0 24 24"
              fill={star <= currentRating ? accent : "none"}
              stroke={star <= currentRating ? accent : "#d6d3d1"}
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </button>
        ))}
      </div>
    )
  }

  if (field.type === "yes_no") {
    const selected = value === "yes" || value === "no" ? (value as string) : null
    return (
      <div className="grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((opt) => {
          const isSelected = selected === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setTimeout(() => onSubmit?.(), 300)
              }}
              className={`rounded-xl border-2 px-6 py-5 text-xl font-semibold capitalize transition-all ${
                isSelected
                  ? "border-current text-stone-900"
                  : "border-stone-200 text-stone-500 hover:border-stone-400 hover:bg-stone-50"
              }`}
              style={isSelected ? { borderColor: accent, color: accent } : undefined}
            >
              {opt === "yes" ? "Yes" : "No"}
            </button>
          )
        })}
      </div>
    )
  }

  const inputType = field.type === "short_text" || field.type === "phone" ? "text" : field.type === "url" ? "url" : field.type

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={inputType}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={field.placeholder ?? (field.type === "url" ? "https://..." : "Type your answer here...")}
      className={baseInputClasses}
      style={{ borderColor: value ? accent : undefined }}
    />
  )
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "originalName" in value &&
    typeof value.originalName === "string"
  )
}
