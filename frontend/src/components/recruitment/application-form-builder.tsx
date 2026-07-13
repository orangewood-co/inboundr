import { ArrowDownIcon, ArrowUpIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { FIELD_TYPE_META, FIELD_TYPE_ORDER, makeFieldId, type FieldType } from "@/components/forms/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { RecruitmentApplicationField, RecruitmentApplicationForm } from "@/lib/recruitment"

const LOCKED = [
  { label: "Full name", type: "Short text" },
  { label: "Email", type: "Email" },
  { label: "Resume", type: "PDF or DOCX" },
  { label: "Candidate consent", type: "Agreement" },
]

function newApplicationField(type: FieldType = "short_text"): RecruitmentApplicationField {
  return {
    id: makeFieldId(),
    label: "",
    type,
    required: false,
    description: null,
    placeholder: null,
    options: type === "dropdown" || type === "checkbox" ? ["Option 1"] : [],
    maxFileSizeMb: 10,
    allowedMimeTypes: type === "file" ? ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] : [],
    multiple: false,
    visibilityCondition: null,
  }
}

export function ApplicationFormBuilder({
  value,
  onChange,
}: {
  value: RecruitmentApplicationForm
  onChange: (value: RecruitmentApplicationForm) => void
}) {
  const fields = value.fields ?? []
  function update(index: number, patch: Partial<RecruitmentApplicationField>) {
    onChange({ schemaVersion: 1, fields: fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field) })
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ schemaVersion: 1, fields: next })
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><h2 className="font-semibold">Application form</h2><p className="text-sm text-muted-foreground">This form belongs to this job and does not create a generic Form record.</p></div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ schemaVersion: 1, fields: [...fields, newApplicationField()] })}><PlusIcon /> Add question</Button>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {LOCKED.map((field) => <div key={field.label} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3"><span className="flex size-8 items-center justify-center rounded-lg bg-background"><LockIcon className="size-3.5 text-muted-foreground" /></span><span className="min-w-0"><span className="block text-sm font-medium">{field.label}</span><span className="text-xs text-muted-foreground">{field.type} · Required</span></span></div>)}
      </div>
      <div className="mt-5 space-y-3">
        {fields.length === 0 && <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">Add optional screening questions, work eligibility, portfolio links, or supporting documents.</div>}
        {fields.map((field, index) => {
          const conditionSources = fields.slice(0, index).filter((item) => ["dropdown", "checkbox", "yes_no"].includes(item.type))
          const source = conditionSources.find((item) => item.id === field.visibilityCondition?.fieldId)
          return <article key={field.id} className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className="mt-1 shrink-0">{index + 1}</Badge>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><div><Label>Question</Label><Input className="mt-1.5" value={field.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Do you have the right to work here?" /></div><div><Label>Answer type</Label><Select value={field.type} onValueChange={(type: FieldType) => update(index, { ...newApplicationField(type), id: field.id, label: field.label, description: field.description, required: field.required })}><SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger><SelectContent>{FIELD_TYPE_ORDER.map((type) => <SelectItem key={type} value={type}>{FIELD_TYPE_META[type].label}</SelectItem>)}</SelectContent></Select></div></div>
                <div><Label>Description</Label><Input className="mt-1.5" value={field.description ?? ""} onChange={(event) => update(index, { description: event.target.value || null })} placeholder="Optional context for candidates" /></div>
                {(field.type === "dropdown" || field.type === "checkbox") && <div><Label>Options</Label><textarea className="mt-1.5 min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={field.options.join("\n")} onChange={(event) => update(index, { options: event.target.value.split("\n") })} placeholder={"Option one\nOption two"} /><p className="mt-1 text-xs text-muted-foreground">One option per line.</p></div>}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={field.required} onCheckedChange={(checked) => update(index, { required: checked })} /> Required</label>
                  {field.type === "file" && <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={field.multiple} onCheckedChange={(checked) => update(index, { multiple: checked })} /> Allow multiple files</label>}
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <Label>Visibility</Label>
                  <Select value={field.visibilityCondition?.fieldId ?? "always"} onValueChange={(fieldId) => {
                    if (fieldId === "always") return update(index, { visibilityCondition: null })
                    const dependency = conditionSources.find((item) => item.id === fieldId)
                    update(index, { visibilityCondition: { fieldId, operator: "equals", value: dependency?.type === "yes_no" ? true : dependency?.options[0] ?? "" } })
                  }}><SelectTrigger className="mt-1.5 w-full bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="always">Always show</SelectItem>{conditionSources.map((item) => <SelectItem key={item.id} value={item.id}>Show based on “{item.label || "Untitled question"}”</SelectItem>)}</SelectContent></Select>
                  {field.visibilityCondition && source && <div className="mt-2 grid gap-2 sm:grid-cols-[140px_1fr]"><Select value={field.visibilityCondition.operator} onValueChange={(operator: "equals" | "not_equals") => update(index, { visibilityCondition: { ...field.visibilityCondition!, operator } })}><SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equals">is</SelectItem><SelectItem value="not_equals">is not</SelectItem></SelectContent></Select><Select value={String(field.visibilityCondition.value)} onValueChange={(conditionValue) => update(index, { visibilityCondition: { ...field.visibilityCondition!, value: source.type === "yes_no" ? conditionValue === "true" : conditionValue } })}><SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger><SelectContent>{source.type === "yes_no" ? <><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></> : source.options.map((option) => option.trim() && <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col"><Button type="button" size="icon-sm" variant="ghost" disabled={index === 0} aria-label="Move question up" onClick={() => move(index, -1)}><ArrowUpIcon /></Button><Button type="button" size="icon-sm" variant="ghost" disabled={index === fields.length - 1} aria-label="Move question down" onClick={() => move(index, 1)}><ArrowDownIcon /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label="Delete question" onClick={() => onChange({ schemaVersion: 1, fields: fields.filter((_, fieldIndex) => fieldIndex !== index) })}><Trash2Icon /></Button></div>
            </div>
          </article>
        })}
      </div>
    </section>
  )
}
