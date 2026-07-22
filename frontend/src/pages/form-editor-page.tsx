import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useBlocker, useNavigate, useParams } from "@tanstack/react-router"
import {
  CircleDotIcon,
  ExternalLinkIcon,
  LoaderIcon,
  Settings2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader, type BreadcrumbSegment } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getFormBySlug, saveForm as apiSaveForm } from "@/lib/forms-api"
import { DesignTab } from "@/components/forms/design-tab"
import { FormCanvas } from "@/components/forms/form-canvas"
import { ResponsesTab } from "@/components/forms/responses-tab"
import { ShareTab } from "@/components/forms/share-tab"
import {
  FIELD_TYPE_META,
  makeFieldId,
  newField,
  publicFormUrl,
  type FieldType,
  type FormBranding,
  type FormField,
  type FormSettings,
  type ManagedForm,
} from "@/components/forms/types"

const DEFAULT_SETTINGS: FormSettings = {
  submitButtonLabel: "Submit",
  successMessage: "",
  notifyOnSubmission: true,
  collectDeviceInfo: false,
}

const DEFAULT_BRANDING: FormBranding = {
  accentColor: "#111827",
  logoUrl: null,
}

function draftSignature(form: ManagedForm) {
  return JSON.stringify({
    title: form.title,
    description: form.description,
    slug: form.slug,
    status: form.status,
    fields: form.fields,
    branding: form.branding,
    settings: form.settings,
  })
}

export default function FormEditorPage() {
  const { slug } = useParams({ from: "/forms/$slug" })
  const navigate = useNavigate()

  const [form, setForm] = useState<ManagedForm | null>(null)
  const [draft, setDraft] = useState<ManagedForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [responseTotal, setResponseTotal] = useState(0)

  const isDirty = useMemo(
    () => Boolean(form && draft && draftSignature(form) !== draftSignature(draft)),
    [form, draft],
  )
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = isDirty
  }, [isDirty])

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current,
    withResolver: true,
    enableBeforeUnload: () => dirtyRef.current,
  })

  useEffect(() => {
    let cancelled = false
    getFormBySlug(slug)
      .then((match) => {
        if (cancelled) return
        if (!match) {
          void navigate({ to: "/forms" })
          return
        }
        setForm(match)
        setDraft(match)
        setResponseTotal(match.submissionCount ?? 0)
      })
      .catch(() => {
        if (!cancelled) void navigate({ to: "/forms" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, navigate])

  const fields = draft?.fields ?? []

  function patchDraft(patch: Partial<ManagedForm>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function patchSettings(patch: Partial<FormSettings>) {
    setDraft((current) =>
      current
        ? { ...current, settings: { ...DEFAULT_SETTINGS, ...current.settings, ...patch } }
        : current,
    )
  }

  function patchBranding(patch: Partial<FormBranding>) {
    setDraft((current) =>
      current
        ? { ...current, branding: { ...DEFAULT_BRANDING, ...current.branding, ...patch } }
        : current,
    )
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === id ? { ...field, ...patch } : field,
            ),
          }
        : current,
    )
  }

  function insertField(type: FieldType, index: number): FormField {
    const field = newField(type)
    setDraft((current) => {
      if (!current) return current
      const next = [...current.fields]
      next.splice(index, 0, field)
      return { ...current, fields: next }
    })
    return field
  }

  function duplicateField(id: string): FormField | null {
    const source = fields.find((field) => field.id === id)
    if (!source) return null
    const copy: FormField = {
      ...source,
      id: makeFieldId(),
      options: [...(source.options ?? [])],
      allowedMimeTypes: [...(source.allowedMimeTypes ?? [])],
      label: source.label ? `${source.label} (copy)` : "",
    }
    setDraft((current) => {
      if (!current) return current
      const index = current.fields.findIndex((field) => field.id === id)
      const next = [...current.fields]
      next.splice(index + 1, 0, copy)
      return { ...current, fields: next }
    })
    return copy
  }

  function removeField(id: string) {
    setDraft((current) =>
      current
        ? { ...current, fields: current.fields.filter((field) => field.id !== id) }
        : current,
    )
  }

  function moveField(activeId: string, overId: string) {
    setDraft((current) => {
      if (!current) return current
      const oldIndex = current.fields.findIndex((field) => field.id === activeId)
      const newIndex = current.fields.findIndex((field) => field.id === overId)
      if (oldIndex === -1 || newIndex === -1) return current
      const next = [...current.fields]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return { ...current, fields: next }
    })
  }

  function validateDraft(current: ManagedForm): string | null {
    if (!current.title.trim()) return "Give your form a title before saving"
    for (const [index, field] of current.fields.entries()) {
      if (!field.label.trim()) return `Question ${index + 1} needs a title`
      if (
        (field.type === "dropdown" || field.type === "checkbox") &&
        (field.options ?? []).filter((option) => option.trim()).length === 0
      ) {
        return `"${field.label}" (${FIELD_TYPE_META[field.type].label}) needs at least one option`
      }
    }
    return null
  }

  const saveDraftForm = useCallback(
    async (status?: ManagedForm["status"]) => {
      if (!draft) return
      const nextStatus = status ?? draft.status
      const validationError = validateDraft(draft)
      if (validationError) {
        toast.error(validationError)
        return
      }
      setSaving(true)
      try {
        const payload: Partial<ManagedForm> = {
          ...draft,
          status: nextStatus,
          fields: draft.fields.map((field) => ({
            ...field,
            label: field.label.trim(),
            options: (field.options ?? []).map((option) => option.trim()).filter(Boolean),
          })),
        }
        const saved = await apiSaveForm(payload)
        const merged: ManagedForm = {
          ...saved,
          submissionCount: form?.submissionCount ?? 0,
        }
        setForm(merged)
        setDraft(merged)
        dirtyRef.current = false
        toast.success(
          nextStatus === "published"
            ? "Form published"
            : form?.status === "published" && nextStatus === "draft"
              ? "Form unpublished"
              : "Changes saved",
        )
        if (saved.slug !== slug) {
          void navigate({ to: "/forms/$slug", params: { slug: saved.slug }, replace: true })
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to save")
      } finally {
        setSaving(false)
      }
    },
    [draft, form, slug, navigate],
  )

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        if (dirtyRef.current && !saving) void saveDraftForm()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [saveDraftForm, saving])

  const handleResponseTotalChange = useCallback((total: number) => {
    setResponseTotal(total)
  }, [])

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Forms", href: "/forms" },
    { label: draft?.title || "Untitled" },
  ]

  if (loading || !draft) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={breadcrumbs} />
        <div className="flex flex-1 items-center justify-center">
          <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  const isPublished = draft.status === "published"

  const headerActions = (
    <div className="flex items-center gap-2">
      {isDirty && (
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs font-medium text-warning sm:flex animate-in fade-in">
          <CircleDotIcon className="size-3 shrink-0" />
          Unsaved changes
        </span>
      )}
      <Badge variant={isPublished ? "default" : "secondary"} className="text-[11px]">
        {isPublished ? "Live" : "Draft"}
      </Badge>

      <div className="mx-1 h-4 w-px bg-border" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <Settings2Icon className="size-4" />
            <span className="sr-only">Form settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b px-4 py-3">
            <p className="text-[13px] font-medium">Form Settings</p>
          </div>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Submit button label</Label>
              <Input
                value={draft.settings.submitButtonLabel}
                onChange={(event) => patchSettings({ submitButtonLabel: event.target.value })}
                placeholder="Submit"
                className="h-8"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Get notified on new responses</p>
              </div>
              <Switch
                checked={draft.settings.notifyOnSubmission}
                onCheckedChange={(checked) => patchSettings({ notifyOnSubmission: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium">Collect device info</p>
                <p className="text-xs text-muted-foreground">Record device, OS, and browser</p>
              </div>
              <Switch
                checked={draft.settings.collectDeviceInfo}
                onCheckedChange={(checked) => patchSettings({ collectDeviceInfo: checked })}
              />
            </div>
            {isPublished && (
              <div className="border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void saveDraftForm("draft")}
                >
                  Unpublish Form
                </Button>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  The public link stops working until you publish again.
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="ghost" size="sm" disabled={!isPublished} asChild={isPublished}>
              {isPublished ? (
                <a href={publicFormUrl(draft.slug)} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-3.5" />
                  Preview
                </a>
              ) : (
                <>
                  <ExternalLinkIcon className="size-3.5" />
                  Preview
                </>
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isPublished ? "Open the live form in a new tab" : "Publish to preview the live form"}
        </TooltipContent>
      </Tooltip>

      {isPublished ? (
        <Button size="sm" onClick={() => void saveDraftForm("published")} disabled={saving || !isDirty}>
          {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
          Save
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void saveDraftForm("draft")}
            disabled={saving || !isDirty}
          >
            {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
            Save Draft
          </Button>
          <Button size="sm" onClick={() => void saveDraftForm("published")} disabled={saving}>
            Publish
          </Button>
        </>
      )}
    </div>
  )

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={breadcrumbs} actions={headerActions} />

      <Tabs defaultValue="edit" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex justify-center border-b bg-background px-4 py-2">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="responses">
              Responses
              {responseTotal > 0 && (
                <span className="ml-1 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {responseTotal}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="edit" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <FormCanvas
            title={draft.title}
            description={draft.description ?? ""}
            successMessage={draft.settings.successMessage}
            fields={fields}
            onTitleChange={(value) => patchDraft({ title: value })}
            onDescriptionChange={(value) => patchDraft({ description: value || null })}
            onSuccessMessageChange={(value) => patchSettings({ successMessage: value })}
            onUpdateField={updateField}
            onInsertField={insertField}
            onDuplicateField={duplicateField}
            onRemoveField={removeField}
            onMoveField={moveField}
          />
        </TabsContent>

        <TabsContent value="design" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <DesignTab
            title={draft.title}
            description={draft.description ?? ""}
            submitButtonLabel={draft.settings.submitButtonLabel}
            branding={draft.branding}
            onPatchBranding={patchBranding}
          />
        </TabsContent>

        <TabsContent value="share" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <ShareTab
            slug={draft.slug}
            status={draft.status}
            onSlugChange={(value) => patchDraft({ slug: value })}
          />
        </TabsContent>

        <TabsContent value="responses" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ResponsesTab
            formId={draft._id}
            fields={fields}
            collectDeviceInfo={draft.settings.collectDeviceInfo}
            onTotalChange={handleResponseTotalChange}
          />
        </TabsContent>
      </Tabs>

      {/* Unsaved changes navigation guard */}
      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Unsaved Changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on this form. If you leave now, they will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
