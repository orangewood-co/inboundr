import { useState } from "react"
import { makeAssistantToolUI } from "@assistant-ui/react"
import {
  AlertCircleIcon,
  CheckIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  InboxIcon,
  LinkIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type FormSummary = {
  id: string
  title: string
  description: string | null
  status: "draft" | "published" | "archived"
  slug: string
  publicUrl: string
  fieldCount: number
  submissionCount?: number
  newSubmissionCount?: number
  updatedAt: string | null
}

type SearchFormsResult = {
  query: string | null
  status: "ok" | "empty"
  forms: FormSummary[]
}

type FormMutationResult =
  | { status: "created" | "updated"; form: FormSummary }
  | { status: "invalid" | "not_found"; error: string }

type GetFormSubmissionsResult =
  | {
      status: "ok"
      form: { id: string; title: string; formStatus: string }
      counts: { total: number; new: number; reviewed: number; archived: number }
      lastSubmissionAt: string | null
      submissions: unknown[]
    }
  | { status: "invalid" | "not_found"; error: string }

function ToolPendingCard({ label }: { label: string }) {
  return (
    <div className="flex w-full max-w-md items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <Spinner className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function ToolErrorNote({ message }: { message: string }) {
  return (
    <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
      <AlertCircleIcon className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function FormStatusBadge({ status }: { status: FormSummary["status"] }) {
  return (
    <Badge variant={status === "published" ? "default" : "secondary"} className="capitalize">
      {status}
    </Badge>
  )
}

function CopyPublicLinkButton({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(publicUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
      {copied ? "Copied" : "Copy Public Link"}
    </Button>
  )
}

function FormCard({ form }: { form: FormSummary }) {
  return (
    <div className="flex w-full items-start gap-3 px-3 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ClipboardListIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{form.title || "Untitled form"}</span>
          <FormStatusBadge status={form.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {form.fieldCount} {form.fieldCount === 1 ? "question" : "questions"}
          {form.submissionCount !== undefined
            ? ` · ${form.submissionCount} ${form.submissionCount === 1 ? "response" : "responses"}`
            : ""}
          {form.newSubmissionCount ? ` (${form.newSubmissionCount} new)` : ""}
        </p>
        {form.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{form.description}</p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <a href={`/forms/${form.slug}`}>
              <ExternalLinkIcon className="size-4" />
              Open Editor
            </a>
          </Button>
          {form.status === "published" ? <CopyPublicLinkButton publicUrl={form.publicUrl} /> : null}
        </div>
      </div>
    </div>
  )
}

function SearchFormsResults({ result }: { result: SearchFormsResult }) {
  if (result.forms.length === 0) {
    return (
      <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
        <ClipboardListIcon className="size-4 shrink-0" />
        No matching forms found.
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ClipboardListIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Forms</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tabular-nums">
          {result.forms.length}
        </span>
      </div>
      <ul className="divide-y">
        {result.forms.map((form) => (
          <li key={form.id}>
            <FormCard form={form} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FormMutationResultCard({
  result,
  statusType,
  pendingLabel,
  title,
}: {
  result: FormMutationResult | undefined
  statusType: string
  pendingLabel: string
  title: string
}) {
  if (statusType === "running") return <ToolPendingCard label={pendingLabel} />
  if (!result) return null
  if ("error" in result) return <ToolErrorNote message={result.error} />

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ClipboardListIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <FormCard form={result.form} />
    </div>
  )
}

function FormSubmissionsStatsCard({
  result,
  statusType,
}: {
  result: GetFormSubmissionsResult | undefined
  statusType: string
}) {
  if (statusType === "running") return <ToolPendingCard label="Loading responses..." />
  if (!result) return null
  if ("error" in result) return <ToolErrorNote message={result.error} />

  return (
    <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <InboxIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{result.form.title}</p>
        <p className="text-xs text-muted-foreground">
          {result.counts.total} {result.counts.total === 1 ? "response" : "responses"}
          {result.counts.new ? ` · ${result.counts.new} new` : ""}
          {result.lastSubmissionAt
            ? ` · last ${new Date(result.lastSubmissionAt).toLocaleDateString()}`
            : ""}
        </p>
      </div>
    </div>
  )
}

const SearchFormsToolUI = makeAssistantToolUI<Record<string, unknown>, SearchFormsResult>({
  toolName: "searchForms",
  render: ({ result, status }) => {
    if (status.type === "running") return <ToolPendingCard label="Searching forms..." />
    if (!result) return null
    return <SearchFormsResults result={result} />
  },
})

const CreateFormToolUI = makeAssistantToolUI<Record<string, unknown>, FormMutationResult>({
  toolName: "createForm",
  render: ({ result, status }) => (
    <FormMutationResultCard
      result={result}
      statusType={status.type}
      pendingLabel="Creating form..."
      title="Form Created"
    />
  ),
})

const UpdateFormToolUI = makeAssistantToolUI<Record<string, unknown>, FormMutationResult>({
  toolName: "updateForm",
  render: ({ result, status }) => (
    <FormMutationResultCard
      result={result}
      statusType={status.type}
      pendingLabel="Updating form..."
      title="Form Updated"
    />
  ),
})

const GetFormSubmissionsToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  GetFormSubmissionsResult
>({
  toolName: "getFormSubmissions",
  render: ({ result, status }) => (
    <FormSubmissionsStatsCard result={result} statusType={status.type} />
  ),
})

export function FormToolUIs() {
  return (
    <>
      <SearchFormsToolUI />
      <CreateFormToolUI />
      <UpdateFormToolUI />
      <GetFormSubmissionsToolUI />
    </>
  )
}
