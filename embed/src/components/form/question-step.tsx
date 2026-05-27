import { motion } from "motion/react"
import { ArrowRightIcon } from "lucide-react"
import { FieldInput } from "./field-input"
import type { PublicField } from "./types"

export function QuestionStep({
  field,
  value,
  error,
  accent,
  questionNumber,
  totalQuestions,
  onChange,
  onUpload,
  uploading,
  onNext,
  isLast,
  submitLabel,
  submitting,
}: {
  field: PublicField
  value: unknown
  error?: string
  accent: string
  questionNumber: number
  totalQuestions: number
  onChange: (value: unknown) => void
  onUpload?: (files: FileList) => Promise<void>
  uploading?: boolean
  onNext: () => void
  isLast: boolean
  submitLabel: string
  submitting: boolean
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-6 py-12 sm:px-12">
      <div className="mx-auto w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="mb-6 flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: accent }}>
              {questionNumber}
            </span>
            <span className="text-sm text-stone-400">/ {totalQuestions}</span>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            {field.label}
            {field.required && <span className="ml-1 text-red-400">*</span>}
          </h2>

          {field.description && (
            <p className="mb-4 text-base leading-relaxed text-stone-400">{field.description}</p>
          )}

          {field.placeholder && field.type !== "short_text" && field.type !== "long_text" && field.type !== "email" && field.type !== "phone" && field.type !== "number" && field.type !== "url" && (
            <p className="mb-6 text-base text-stone-400">{field.placeholder}</p>
          )}

          <div className="mt-8">
            <FieldInput
              field={field}
              value={value}
              accent={accent}
              onChange={onChange}
              onUpload={onUpload}
              uploading={uploading}
              onSubmit={onNext}
            />
          </div>

          {error && (
            <motion.p
              className="mt-4 text-sm font-medium text-red-500"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.p>
          )}

          <div className="mt-10 flex items-center gap-4">
            <motion.button
              type="button"
              onClick={onNext}
              disabled={submitting || uploading}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: accent }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {submitting ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : null}
              {isLast ? submitLabel : "OK"}
              {!isLast && <ArrowRightIcon className="size-3.5" />}
            </motion.button>

            <span className="text-xs text-stone-400">
              press <kbd className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px]">Enter ↵</kbd>
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
