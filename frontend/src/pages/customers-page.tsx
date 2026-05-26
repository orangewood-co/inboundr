import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  Edit3Icon,
  EyeIcon,
  RefreshCwIcon,
  SearchIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { CopyableText } from "@/components/copy-button"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/customers`
const PAGE_LIMIT = 20

function getInitialListSearch(): string {
  return new URLSearchParams(window.location.search).get("search") ?? ""
}

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

interface CustomersResponse {
  customers: Customer[]
  total: number
  page: number
  limit: number
  totalPages: number
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

const emptyForm: CustomerFormState = {
  name: "",
  company: "",
  email: "",
  contactNumber: "",
  address: "",
  notes: "",
  specialDiscountPercentage: "0",
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

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.345, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ] as const

  let duration = diffInSeconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" }).format(
        Math.round(duration),
        division.unit
      )
    }
    duration /= division.amount
  }

  return "-"
}

function CustomerTableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_0.8fr_5rem] gap-4 px-5 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <UsersIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          {search ? "No customers match that search" : "No customers identified yet"}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {search
            ? "Try a customer name, company, email, phone number, or address fragment."
            : "Customers identified from RFQs will appear here after they are saved."}
        </p>
      </div>
    </div>
  )
}

function CustomerForm({
  form,
  onChange,
}: {
  form: CustomerFormState
  onChange: (field: keyof CustomerFormState, value: string) => void
}) {
  return (
    <div className="grid gap-5 px-5 pb-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={(event) => onChange("name", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="company">Company</Label>
          <Input id="company" value={form.company} onChange={(event) => onChange("company", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contactNumber">Contact number</Label>
          <Input id="contactNumber" value={form.contactNumber} onChange={(event) => onChange("contactNumber", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="address">Address</Label>
        <textarea
          id="address"
          rows={5}
          value={form.address}
          onChange={(event) => onChange("address", event.target.value)}
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
            onChange={(event) => onChange("specialDiscountPercentage", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={5}
          value={form.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          placeholder="Pricing preferences, follow-up context, or internal notes"
        />
      </div>
    </div>
  )
}

function CustomerDetails({ customer }: { customer: Customer }) {
  return (
    <div className="grid gap-5 px-5 pb-5 text-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</p>
          <p className="font-medium">{customer.name || "-"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</p>
          <p className="font-medium">{customer.company || "-"}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</p>
          <CopyableText value={customer.email} label="Email copied">
            <a className="font-medium text-primary hover:underline" href={`mailto:${customer.email}`}>
              {customer.email || "-"}
            </a>
          </CopyableText>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact number</p>
          <CopyableText value={customer.contactNumber} label="Phone copied">
            <span className="font-medium">{customer.contactNumber || "-"}</span>
          </CopyableText>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</p>
        <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 leading-6">
          {customer.address || "No address saved"}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Special discount</p>
        <p className="font-medium">{customer.specialDiscountPercentage ?? 0}%</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
        <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 leading-6">
          {customer.notes || "No notes saved"}
        </p>
      </div>
    </div>
  )
}

function CustomerMetadata({ customer }: { customer: Customer }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">
            Updated <span className="text-foreground/70">{formatRelativeTime(customer.updatedAt)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatDate(customer.updatedAt)}</TooltipContent>
      </Tooltip>
      <span className="text-border">·</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">
            Created <span className="text-foreground/70">{formatRelativeTime(customer.createdAt)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatDate(customer.createdAt)}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const initialSearch = getInitialListSearch()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch.trim())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<"view" | "edit">("view")
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`${API_BASE}?${params}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Unable to fetch customers")

      const data = (await response.json()) as CustomersResponse
      setCustomers(data.customers)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch customers")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

  const visibleRange = useMemo(() => {
    if (total === 0) return "0"
    const start = (page - 1) * PAGE_LIMIT + 1
    const end = Math.min(page * PAGE_LIMIT, total)
    return `${start}-${end}`
  }, [page, total])

  function openViewSheet(customer: Customer) {
    setEditingCustomer(customer)
    setSheetMode("view")
    setSaveError(null)
    setSheetOpen(true)
  }

  function openEditSheet(customer: Customer) {
    setEditingCustomer(customer)
    setSheetMode("edit")
    setForm(customerToForm(customer))
    setSaveError(null)
    setSheetOpen(true)
  }

  async function saveCustomer() {
    if (!editingCustomer) return

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
      const response = await fetch(`${API_BASE}/${editingCustomer._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(responsePayload?.error ?? "Unable to save customer")
      }

      setSheetOpen(false)
      toast.success("Customer updated successfully")
      await fetchCustomers()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save customer")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveCustomer() {
    if (!editingCustomer) return

    setArchiving(true)
    try {
      const response = await fetch(`${API_BASE}/${editingCustomer._id}/archive`, {
        method: "PATCH",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? "Unable to archive customer")
      }

      setArchiveConfirmOpen(false)
      setSheetOpen(false)
      toast.success("Customer archived")
      await fetchCustomers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to archive customer")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <TooltipProvider>
    <AppLayout>
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Customers</h2>
              {!loading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                  {total.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => void fetchCustomers()}
                    disabled={loading}
                  >
                    <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (debouncedSearch) params.set("search", debouncedSearch)
                      window.open(`${API_BASE}/export?${params}`, "_blank")
                    }}
                  >
                    <DownloadIcon className="size-4" />
                    Export
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export customers as CSV</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void navigate({ to: "/customers/import" })}
                  >
                    <UploadIcon className="size-4" />
                    Import
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bulk import customers from CSV or Excel</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b px-4 py-3">
            <div className="relative max-w-xl flex-1">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, company, email, phone, address..."
                className="pl-10"
              />
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{visibleRange}</span> of{" "}
              <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span>
            </span>
          </div>

          {error ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <AlertCircleIcon className="size-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchCustomers()}>
                Try again
              </Button>
            </div>
          ) : loading ? (
            <CustomerTableSkeleton />
          ) : customers.length === 0 ? (
            <EmptyState search={debouncedSearch} />
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-5 py-2.5">Company</th>
                    <th className="px-5 py-2.5">Email</th>
                    <th className="px-5 py-2.5">Contact</th>
                    <th className="w-20 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="animate-in fade-in-0 duration-300">
                  {customers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="group cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                      onClick={() => void navigate({ to: "/customers/$id", params: { id: customer._id } })}
                    >
                      <td className="px-5 py-3.5 align-top font-medium">
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <button type="button" className="cursor-default text-left font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                              {customer.name || "Unnamed customer"}
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent align="start" className="w-80 space-y-3 text-sm">
                            <p className="font-semibold">{customer.name}</p>
                            {customer.address && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</p>
                                <p className="whitespace-pre-wrap text-xs leading-5">{customer.address}</p>
                              </div>
                            )}
                            {customer.notes && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {customer.notes.length > 100 ? `${customer.notes.slice(0, 100)}…` : customer.notes}
                                </p>
                              </div>
                            )}
                            {customer.specialDiscountPercentage > 0 && (
                              <p className="text-xs">
                                <span className="text-muted-foreground">Discount:</span>{" "}
                                <span className="font-medium">{customer.specialDiscountPercentage}%</span>
                              </p>
                            )}
                            <div className="flex gap-3 border-t pt-2 text-[11px] text-muted-foreground">
                              <span>Updated {formatRelativeTime(customer.updatedAt)}</span>
                              <span>Created {formatRelativeTime(customer.createdAt)}</span>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </td>
                      <td className="px-5 py-3.5 align-top">{customer.company || "-"}</td>
                      <td className="px-5 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <CopyableText value={customer.email} label="Email copied">
                          <a className="font-medium text-primary hover:underline" href={`mailto:${customer.email}`}>
                            {customer.email || "-"}
                          </a>
                        </CopyableText>
                      </td>
                      <td className="px-5 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <CopyableText value={customer.contactNumber} label="Phone copied">
                          <span>{customer.contactNumber || "-"}</span>
                        </CopyableText>
                      </td>
                      <td className="px-3 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => openViewSheet(customer)}>
                                <EyeIcon className="size-4" />
                                <span className="sr-only">Quick view</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Quick view</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => openEditSheet(customer)}>
                                <Edit3Icon className="size-4" />
                                <span className="sr-only">Quick edit</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Quick edit</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
                    <ChevronLeftIcon className="size-4" />
                    Previous
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous page</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                    Next
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next page</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
    </AppLayout>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl">
              {sheetMode === "view" ? "Customer details" : "Edit customer"}
            </SheetTitle>
            {sheetMode === "view" && editingCustomer && (
              <CustomerMetadata customer={editingCustomer} />
            )}
            {sheetMode === "edit" && (
              <SheetDescription>
                Update the shared customer directory entry saved from identified RFQs.
              </SheetDescription>
            )}
          </SheetHeader>
          <Separator />
          {sheetMode === "view" && editingCustomer ? (
            <>
              <CustomerDetails customer={editingCustomer} />
              <SheetFooter className="border-t bg-muted/30">
                <Button onClick={() => openEditSheet(editingCustomer)}>
                  <Edit3Icon className="size-4" />
                  Edit customer
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setArchiveConfirmOpen(true)}>
                  <ArchiveIcon className="size-4" />
                  Archive
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>
                  Close
                </Button>
              </SheetFooter>
            </>
          ) : (
            <>
              <CustomerForm
                form={form}
                onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
              />
              {saveError && (
                <div className="mx-5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveError}
                </div>
              )}
              <SheetFooter className="border-t bg-muted/30">
                <Button onClick={saveCustomer} disabled={saving}>
                  {saving && <Spinner data-icon="inline-start" />}
                  Save changes
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setArchiveConfirmOpen(true)} disabled={saving}>
                  <ArchiveIcon className="size-4" />
                  Archive
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                  Cancel
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Archive customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive <span className="font-medium text-foreground">{editingCustomer?.name}</span>? They will no longer appear in your customer list or search results.
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
