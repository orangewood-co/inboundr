import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LoaderIcon } from "lucide-react"

import { WelcomeStep } from "@/components/form/welcome-step"
import { QuestionStep } from "@/components/form/question-step"
import { SuccessStep } from "@/components/form/success-step"
import { ProgressBar } from "@/components/form/progress-bar"
import { NavigationControls } from "@/components/form/navigation-controls"
import type { PublicField, PublicForm, UploadedFile } from "@/components/form/types"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

type Step = "welcome" | "question" | "success"

export default function FormPage({ slug, embed = false }: { slug: string; embed?: boolean }) {
  const [form, setForm] = useState<PublicForm | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(-1) // -1 = welcome
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_ORIGIN}/api/v1/public/forms/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This form is not available"))))
      .then((data: PublicForm) => setForm(data))
      .catch((err) => setFatalError(err instanceof Error ? err.message : "This form is not available"))
      .finally(() => setLoading(false))
  }, [slug])

  const totalFields = form?.fields.length ?? 0
  const accent = form?.branding.accentColor || "#111827"

  const currentStep: Step =
    successMessage ? "success" : currentIndex === -1 ? "welcome" : "question"

  const currentField: PublicField | undefined =
    currentStep === "question" ? form?.fields[currentIndex] : undefined

  const validateCurrent = useCallback((): boolean => {
    if (!currentField) return true
    const val = values[currentField.id]

    if (currentField.required) {
      if (val === undefined || val === null || val === "") {
        setErrors((e) => ({ ...e, [currentField.id]: "This field is required" }))
        return false
      }
      if (Array.isArray(val) && val.length === 0) {
        setErrors((e) => ({ ...e, [currentField.id]: "Please select at least one option" }))
        return false
      }
    }

    if (currentField.type === "email" && val) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(val))) {
        setErrors((e) => ({ ...e, [currentField.id]: "Please enter a valid email" }))
        return false
      }
    }

    setErrors((e) => ({ ...e, [currentField.id]: "" }))
    return true
  }, [currentField, values])

  const goNext = useCallback(() => {
    if (currentStep === "welcome") {
      setDirection(1)
      setCurrentIndex(0)
      return
    }

    if (currentStep !== "question" || !form) return

    if (!validateCurrent()) return

    if (currentIndex === totalFields - 1) {
      submitForm()
    } else {
      setDirection(1)
      setCurrentIndex((i) => i + 1)
    }
  }, [currentStep, currentIndex, totalFields, form, validateCurrent])

  const goPrev = useCallback(() => {
    if (currentStep === "question" && currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex((i) => i - 1)
    } else if (currentStep === "question" && currentIndex === 0) {
      setDirection(-1)
      setCurrentIndex(-1)
    }
  }, [currentStep, currentIndex])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && currentStep === "welcome") {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentStep, goNext])

  async function submitForm() {
    if (!form) return
    setSubmitting(true)
    setErrors({})
    setFatalError(null)

    const payload = {
      website: "",
      source: embed ? "embed" : "link",
      values,
    }

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/forms/${form.slug}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        if (body?.errors) setErrors(body.errors)
        throw new Error(body?.error ?? "Unable to submit form")
      }
      setSuccessMessage(body?.message ?? form.settings.successMessage)
    } catch (err) {
      setFatalError(err instanceof Error ? err.message : "Unable to submit form")
    } finally {
      setSubmitting(false)
    }
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

        const presignRes = await fetch(
          `${API_ORIGIN}/api/v1/public/forms/${form.slug}/uploads/presign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fieldId: field.id,
              fileName: file.name,
              contentType: file.type || "application/octet-stream",
              size: file.size,
            }),
          }
        )
        const presign = await presignRes.json().catch(() => null)
        if (!presignRes.ok) throw new Error(presign?.error ?? "Unable to prepare upload")

        const uploadRes = await fetch(presign.uploadUrl, {
          method: presign.method,
          headers: presign.headers,
          body: file,
        })
        if (!uploadRes.ok) throw new Error(`Unable to upload ${file.name}`)
        uploaded.push({ ...presign.file, uploadedAt: new Date().toISOString() })
      }
      setValues((cur) => ({ ...cur, [field.id]: field.multiple ? uploaded : uploaded[0] }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to upload file"
      setErrors((cur) => ({ ...cur, [field.id]: msg }))
      setFatalError(msg)
    } finally {
      setUploadingFieldId(null)
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({
      y: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      y: dir > 0 ? -60 : 60,
      opacity: 0,
    }),
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <LoaderIcon className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  if (!form || (fatalError && !currentField)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-700">{fatalError ?? "This form is not available"}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-h-[100dvh] overflow-hidden bg-white">
      {currentStep !== "welcome" && currentStep !== "success" && (
        <ProgressBar current={currentIndex + 1} total={totalFields} accent={accent} />
      )}

      <AnimatePresence mode="wait" custom={direction}>
        {currentStep === "welcome" && (
          <motion.div
            key="welcome"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <WelcomeStep
              title={form.title}
              description={form.description}
              logoUrl={form.branding.logoUrl}
              accent={accent}
              onStart={goNext}
            />
          </motion.div>
        )}

        {currentStep === "question" && currentField && (
          <motion.div
            key={`question-${currentIndex}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <QuestionStep
              field={currentField}
              value={values[currentField.id]}
              error={errors[currentField.id] || (fatalError && currentIndex === totalFields - 1 ? fatalError : undefined)}
              accent={accent}
              questionNumber={currentIndex + 1}
              totalQuestions={totalFields}
              onChange={(v) => {
                setValues((cur) => ({ ...cur, [currentField.id]: v }))
                setErrors((cur) => ({ ...cur, [currentField.id]: "" }))
                setFatalError(null)
              }}
              onUpload={(files) => uploadFiles(currentField, files)}
              uploading={uploadingFieldId === currentField.id}
              onNext={goNext}
              isLast={currentIndex === totalFields - 1}
              submitLabel={form.settings.submitButtonLabel}
              submitting={submitting}
            />
          </motion.div>
        )}

        {currentStep === "success" && successMessage && (
          <motion.div
            key="success"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <SuccessStep message={successMessage} accent={accent} />
          </motion.div>
        )}
      </AnimatePresence>

      {currentStep === "question" && (
        <NavigationControls
          onPrev={goPrev}
          onNext={goNext}
          canGoPrev={currentIndex > 0}
          canGoNext={true}
          accent={accent}
        />
      )}
    </div>
  )
}
