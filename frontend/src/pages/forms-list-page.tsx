import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  ClipboardListIcon,
  CopyIcon,
  EllipsisIcon,
  LoaderIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { FormTemplateDialog } from "@/components/form-template-dialog"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/forms`

type ManagedForm = {
  _id: string
  title: string
  description: string | null
  slug: string
  status: "draft" | "published" | "archived"
  fields: { id: string; label: string }[]
  submissionCount: number
  updatedAt: string
}

function relativeDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date)
}

const statusConfig = {
  draft: { label: "Draft", variant: "outline" as const, tooltip: "Form is in draft mode and not publicly accessible" },
  published: { label: "Published", variant: "default" as const, tooltip: "Form is live and accepting submissions" },
  archived: { label: "Archived", variant: "secondary" as const, tooltip: "Form has been archived and is no longer accessible" },
}

export default function FormsListPage() {
  const navigate = useNavigate()
  const [forms, setForms] = useState<ManagedForm[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(API_BASE, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch forms")
      const data = (await response.json()) as { forms: ManagedForm[] }
      setForms(data.forms)
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchForms()
  }, [fetchForms])

  async function createFromTemplate(template: { title: string; description: string; fields: { id: string; label: string; type: string; required: boolean; description?: string | null; placeholder?: string | null; options?: string[] }[] }) {
    setCreating(true)
    try {
      const slug = `form-${Date.now().toString(36)}`
      const response = await fetch(API_BASE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          slug,
          status: "draft",
          fields: template.fields,
          branding: { accentColor: "#111827", logoUrl: null },
          settings: {
            submitButtonLabel: "Submit",
            successMessage: "Thanks! Your response has been submitted.",
            notifyOnSubmission: true,
          },
        }),
      })
      if (!response.ok) throw new Error("Failed to create form")
      const created = await response.json()
      void navigate({ to: "/forms/$slug", params: { slug: created.slug } })
    } catch {
      toast.error("Failed to create form")
      setCreating(false)
    }
  }

  async function duplicateForm(form: ManagedForm) {
    const response = await fetch(`${API_BASE}/${form._id}/duplicate`, {
      method: "POST",
      credentials: "include",
    })
    if (response.ok) {
      toast.success("Form duplicated")
      void fetchForms()
    }
  }

  async function archiveForm(form: ManagedForm) {
    await fetch(`${API_BASE}/${form._id}`, {
      method: "DELETE",
      credentials: "include",
    })
    toast.success("Form archived")
    void fetchForms()
  }

  return (
    <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Forms" }]} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {forms.length} {forms.length === 1 ? "form" : "forms"}
                </p>
              </div>
              <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                {creating ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon className="size-4" />
                )}
                Create Form
              </Button>
            </div>

            {loading ? (
              <div className="mt-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <LoaderIcon className="size-5 animate-spin" />
                <p className="text-sm">Loading forms...</p>
              </div>
            ) : forms.length === 0 ? (
              <div className="mt-16 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ClipboardListIcon className="size-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">No Forms Yet</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Create your first form to start collecting responses from
                    customers.
                  </p>
                </div>
                <Button onClick={() => setTemplateOpen(true)} disabled={creating}>
                  <PlusIcon className="size-4" />
                  Create Your First Form
                </Button>
              </div>
            ) : (
              <div className="mt-6 animate-in fade-in-0 duration-300 rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40%]">Name</TableHead>
                      <TableHead>Responses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((form) => {
                      const status = statusConfig[form.status]
                      return (
                        <TableRow
                          key={form._id}
                          className="group/row cursor-pointer"
                          onClick={() =>
                            void navigate({
                              to: "/forms/$slug",
                              params: { slug: form.slug },
                            })
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                <ClipboardListIcon className="size-4 text-emerald-700 dark:text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {form.title}
                                </p>
                                {form.description && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {form.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {form.submissionCount > 0
                              ? form.submissionCount
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{status.tooltip}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{relativeDate(form.updatedAt)}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {new Date(form.updatedAt).toLocaleString()}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <EllipsisIcon className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>More actions</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void duplicateForm(form)
                                  }}
                                >
                                  <CopyIcon className="size-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void archiveForm(form)
                                  }}
                                >
                                  <Trash2Icon className="size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
        <FormTemplateDialog
          open={templateOpen}
          onOpenChange={setTemplateOpen}
          onSelect={(t) => void createFromTemplate(t)}
          creating={creating}
        />
    </AppLayout>
  )
}
