import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  Edit3Icon,
  MailIcon,
  PhoneIcon,
  SaveIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { CopyableText } from "@/components/copy-button"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDateTime, formatRelativeTime } from "@/lib/format"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/customers`

interface Customer {
  _id: string
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  notes: string | null
  specialDiscountPercentage: number
  createdAt: string
  updatedAt: string
}

type CustomerFormState = {
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  notes: string
  specialDiscountPercentage: string
}

function customerToForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name ?? "",
    company: customer.company ?? "",
    email: customer.email ?? "",
    contactNumber: customer.contactNumber ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    specialDiscountPercentage: customer.specialDiscountPercentage?.toString() ?? "0",
  }
}

function formToPayload(form: CustomerFormState) {
  const specialDiscountPercentage = Number(form.specialDiscountPercentage)

  return {
    name: form.name.trim(),
    company: form.company.trim(),
    email: form.email.trim(),
    contactNumber: form.contactNumber.trim(),
    address: form.address.trim(),
    notes: form.notes.trim() || null,
    specialDiscountPercentage: Number.isFinite(specialDiscountPercentage)
      ? specialDiscountPercentage
      : 0,
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Separator />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams({ from: "/customers_/$id" })
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CustomerFormState>({
    name: "",
    company: "",
    email: "",
    contactNumber: "",
    address: "",
    notes: "",
    specialDiscountPercentage: "0",
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const fetchCustomer = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${id}`, { credentials: "include" })
      if (!response.ok) {
        if (response.status === 404) throw new Error("Customer not found")
        throw new Error("Failed to fetch customer")
      }
      const data = (await response.json()) as Customer
      setCustomer(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch customer")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchCustomer()
  }, [fetchCustomer])

  function startEditing() {
    if (!customer) return
    setForm(customerToForm(customer))
    setSaveError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setSaveError(null)
  }

  async function saveCustomer() {
    if (!customer) return

    const payload = formToPayload(form)
    if (!payload.name || !payload.company || !payload.email) {
      setSaveError("Name, company, and email are required")
      return
    }
    if (payload.specialDiscountPercentage < 0 || payload.specialDiscountPercentage > 100) {
      setSaveError("Special discount must be between 0 and 100")
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const response = await fetch(`${API_BASE}/${customer._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(responsePayload?.error ?? "Unable to save customer")
      }

      setCustomer(responsePayload as Customer)
      setEditing(false)
      toast.success("Customer updated successfully")
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save customer")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveCustomer() {
    if (!customer) return

    setArchiving(true)
    try {
      const response = await fetch(`${API_BASE}/${customer._id}/archive`, {
        method: "PATCH",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Unable to archive customer")
      }

      setArchiveConfirmOpen(false)
      toast.success("Customer archived")
      void navigate({ to: "/customers" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to archive customer")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <TooltipProvider>
      <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Customers", href: "/customers" },
            { label: customer?.name ?? "Customer" },
          ]}
        />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-6 lg:p-8">
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
              <Link to="/customers">
                <ArrowLeftIcon className="size-4" />
                Back to Customers
              </Link>
            </Button>

            {loading ? (
              <DetailSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-12 text-center">
                <AlertCircleIcon className="size-8 text-destructive" />
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{error}</h2>
                  <p className="text-sm text-muted-foreground">
                    The customer could not be loaded. It may have been deleted or you may not have access.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void fetchCustomer()}>
                    Try Again
                  </Button>
                  <Button onClick={() => void navigate({ to: "/customers" })}>
                    Back to Customers
                  </Button>
                </div>
              </div>
            ) : customer && !editing ? (
              <div className="space-y-6 animate-in fade-in-0 duration-300">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                      <UsersIcon className="size-6 text-primary" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
                      <p className="text-sm text-muted-foreground">{customer.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={startEditing}>
                          <Edit3Icon className="size-4" />
                          Edit
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit customer details</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setArchiveConfirmOpen(true)}>
                          <ArchiveIcon className="size-4" />
                          Archive
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archive this customer</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <Separator />

                {/* Contact info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-card p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <MailIcon className="size-3.5" />
                      Email
                    </div>
                    <CopyableText value={customer.email} label="Email copied">
                      <a href={`mailto:${customer.email}`} className="mt-2 block text-sm font-medium text-primary hover:underline">
                        {customer.email || "-"}
                      </a>
                    </CopyableText>
                  </div>
                  <div className="rounded-xl border bg-card p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <PhoneIcon className="size-3.5" />
                      Contact Number
                    </div>
                    <CopyableText value={customer.contactNumber} label="Phone copied">
                      <p className="mt-2 text-sm font-medium">{customer.contactNumber || "-"}</p>
                    </CopyableText>
                  </div>
                </div>

                {/* Address */}
                <div className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {customer.address || "No address saved"}
                  </p>
                </div>

                {/* Discount and notes */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-card p-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Special Discount</p>
                    <p className="mt-2 text-2xl font-bold">{customer.specialDiscountPercentage ?? 0}%</p>
                  </div>
                  <div className="rounded-xl border bg-card p-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {customer.notes || "No notes saved"}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">
                        Created <span className="font-medium text-foreground/70">{formatRelativeTime(customer.createdAt)}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatDateTime(customer.createdAt)}</TooltipContent>
                  </Tooltip>
                  <span className="text-border">·</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">
                        Updated <span className="font-medium text-foreground/70">{formatRelativeTime(customer.updatedAt)}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatDateTime(customer.updatedAt)}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : customer && editing ? (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-semibold tracking-tight">Edit Customer</h1>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                      <XIcon className="size-4" />
                      Cancel
                    </Button>
                    <Button onClick={() => void saveCustomer()} disabled={saving}>
                      {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon className="size-4" />}
                      Save Changes
                    </Button>
                  </div>
                </div>

                <Separator />

                {saveError && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {saveError}
                  </div>
                )}

                <div className="space-y-5 rounded-2xl border bg-card p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="company">Company</Label>
                      <Input id="company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contactNumber">Contact number</Label>
                      <Input id="contactNumber" value={form.contactNumber} onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <textarea
                      id="address"
                      rows={4}
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="Customer billing or office address"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="specialDiscountPercentage">Special discount percentage</Label>
                      <Input
                        id="specialDiscountPercentage"
                        type="number"
                        min="0"
                        max="100"
                        value={form.specialDiscountPercentage}
                        onChange={(e) => setForm((f) => ({ ...f, specialDiscountPercentage: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      rows={4}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="Pricing preferences, follow-up context, or internal notes"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </AppLayout>

      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive <span className="font-medium text-foreground">{customer?.name}</span>? They will no longer appear in your customer list or search results.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveCustomer} disabled={archiving}>
              {archiving && <Spinner data-icon="inline-start" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
