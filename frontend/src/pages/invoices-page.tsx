import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CopyIcon,
  DownloadIcon,
  LoaderIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const INVOICE_API = `${API_ORIGIN}/api/v1/invoices`
const CUSTOMER_API = `${API_ORIGIN}/api/v1/customers`
const PRODUCT_API = `${API_ORIGIN}/api/v1/products`
const PAGE_LIMIT = 20

type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "written_off"

interface Customer {
  _id: string
  name: string
  company: string
  email: string
  contactNumber: string
  address: string
  specialDiscountPercentage: number
}

interface Product {
  id: number
  productdescription: string
  productcode: string
  unitprice: number | string | null
  hsncode: string | null
  gstrate: number | string | null
  unit: string | null
}

interface InvoiceLineItem {
  productId: number | null
  description: string
  productCode: string
  hsnCode: string
  unit: string
  quantity: number
  unitPrice: number
  discountPercentage: number
  gstRate: number
  taxableAmount?: number
  taxAmount?: number
  totalAmount?: number
}

interface Invoice {
  _id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string | null
  paymentTerms: string
  poNumber: string
  notes: string
  termsAndConditions: string
  customerId: string | null
  customerSnapshot: {
    name: string
    company: string
    email: string
    contactNumber: string
    billingAddress: string
    shippingAddress: string
  }
  organizationSnapshot: {
    name: string
    email: string
    phoneNumber: string
    address: string
    logoUrl: string
    website: string
    primaryColor: string
  }
  lineItems: InvoiceLineItem[]
  payments: Array<{ amount: number; date: string; method: string; reference: string; notes: string }>
  totals: {
    subtotal: number
    discountTotal: number
    taxableTotal: number
    taxTotal: number
    grandTotal: number
    paidTotal: number
    balanceDue: number
  }
  recurring: {
    enabled: boolean
    frequency: string | null
    startDate: string | null
    endDate: string | null
    nextRunDate: string | null
    autoSend: boolean
  }
  sentAt: string | null
  viewedAt: string | null
  createdAt: string
  updatedAt: string
}

interface InvoicesResponse {
  invoices: Invoice[]
  total: number
  page: number
  totalPages: number
}

interface InvoiceStats {
  totalInvoiced: number
  outstanding: number
  overdue: number
  paidThisMonth: number
  countByStatus: Record<string, number>
}

type InvoiceFormState = {
  customerId: string
  customerName: string
  customerCompany: string
  customerEmail: string
  customerPhone: string
  billingAddress: string
  shippingAddress: string
  issueDate: string
  dueDate: string
  paymentTerms: string
  poNumber: string
  notes: string
  termsAndConditions: string
  template: "professional" | "compact" | "modern"
  recurringEnabled: boolean
  recurringFrequency: "monthly" | "quarterly" | "yearly"
  recurringStartDate: string
  recurringEndDate: string
  recurringAutoSend: boolean
  lineItems: InvoiceLineItem[]
}

const statusOptions = ["all", "draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "written_off"]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(): InvoiceLineItem {
  return {
    productId: null,
    description: "",
    productCode: "",
    hsnCode: "",
    unit: "",
    quantity: 1,
    unitPrice: 0,
    discountPercentage: 0,
    gstRate: 18,
  }
}

function emptyForm(): InvoiceFormState {
  return {
    customerId: "",
    customerName: "",
    customerCompany: "",
    customerEmail: "",
    customerPhone: "",
    billingAddress: "",
    shippingAddress: "",
    issueDate: today(),
    dueDate: "",
    paymentTerms: "Due on receipt",
    poNumber: "",
    notes: "Thank you for your business.",
    termsAndConditions: "",
    template: "professional",
    recurringEnabled: false,
    recurringFrequency: "monthly",
    recurringStartDate: today(),
    recurringEndDate: "",
    recurringAutoSend: false,
    lineItems: [emptyLine()],
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function labelStatus(status: string) {
  return status.replaceAll("_", " ")
}

function statusVariant(status: InvoiceStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default"
  if (status === "overdue" || status === "cancelled" || status === "written_off") return "destructive"
  if (status === "draft") return "outline"
  return "secondary"
}

function calculatePreviewTotals(items: InvoiceLineItem[]) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)
  const taxableTotal = items.reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0)
    return sum + gross * (1 - Number(item.discountPercentage || 0) / 100)
  }, 0)
  const taxTotal = items.reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0)
    const taxable = gross * (1 - Number(item.discountPercentage || 0) / 100)
    return sum + taxable * (Number(item.gstRate || 0) / 100)
  }, 0)
  return {
    subtotal,
    discountTotal: subtotal - taxableTotal,
    taxableTotal,
    taxTotal,
    grandTotal: taxableTotal + taxTotal,
  }
}

function formToPayload(form: InvoiceFormState) {
  return {
    customerId: form.customerId || null,
    customerSnapshot: {
      name: form.customerName,
      company: form.customerCompany,
      email: form.customerEmail,
      contactNumber: form.customerPhone,
      billingAddress: form.billingAddress,
      shippingAddress: form.shippingAddress,
    },
    issueDate: form.issueDate,
    dueDate: form.dueDate || null,
    paymentTerms: form.paymentTerms,
    poNumber: form.poNumber,
    notes: form.notes,
    termsAndConditions: form.termsAndConditions,
    template: form.template,
    lineItems: form.lineItems,
    recurring: {
      enabled: form.recurringEnabled,
      frequency: form.recurringEnabled ? form.recurringFrequency : null,
      startDate: form.recurringEnabled ? form.recurringStartDate : null,
      endDate: form.recurringEnabled && form.recurringEndDate ? form.recurringEndDate : null,
      nextRunDate: form.recurringEnabled ? form.recurringStartDate : null,
      autoSend: form.recurringAutoSend,
    },
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [form, setForm] = useState<InvoiceFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT), status })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const response = await fetch(`${INVOICE_API}?${params}`, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch invoices")
      const data = (await response.json()) as InvoicesResponse
      setInvoices(data.invoices)
      setTotal(data.total)
      setTotalPages(Math.max(1, data.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch invoices")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, status])

  const fetchStats = useCallback(async () => {
    const response = await fetch(`${INVOICE_API}/stats`, { credentials: "include" })
    if (response.ok) setStats((await response.json()) as InvoiceStats)
  }, [])

  const fetchLookups = useCallback(async () => {
    const [customerResponse, productResponse] = await Promise.all([
      fetch(`${CUSTOMER_API}?limit=50`, { credentials: "include" }),
      fetch(`${PRODUCT_API}?limit=50`, { credentials: "include" }),
    ])
    if (customerResponse.ok) {
      const data = await customerResponse.json()
      setCustomers(data.customers ?? [])
    }
    if (productResponse.ok) {
      const data = await productResponse.json()
      setProducts(data.products ?? [])
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    void fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    void fetchStats()
    void fetchLookups()
  }, [fetchLookups, fetchStats])

  const previewTotals = useMemo(() => calculatePreviewTotals(form.lineItems), [form.lineItems])

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item._id === customerId)
    setForm((current) => ({
      ...current,
      customerId,
      customerName: customer?.name ?? "",
      customerCompany: customer?.company ?? "",
      customerEmail: customer?.email ?? "",
      customerPhone: customer?.contactNumber ?? "",
      billingAddress: customer?.address ?? "",
      shippingAddress: customer?.address ?? "",
      lineItems: current.lineItems.map((line) => ({
        ...line,
        discountPercentage: customer?.specialDiscountPercentage ?? line.discountPercentage,
      })),
    }))
  }

  function selectProduct(lineIndex: number, productId: string) {
    const product = products.find((item) => String(item.id) === productId)
    if (!product) return
    updateLine(lineIndex, {
      productId: product.id,
      description: product.productdescription ?? "",
      productCode: product.productcode ?? "",
      unitPrice: Number(product.unitprice ?? 0),
      hsnCode: product.hsncode ?? "",
      gstRate: Number(product.gstrate ?? 0),
      unit: product.unit ?? "",
    })
  }

  function updateLine(lineIndex: number, patch: Partial<InvoiceLineItem>) {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((line, index) => (index === lineIndex ? { ...line, ...patch } : line)),
    }))
  }

  async function createInvoice() {
    if (!form.customerName && !form.customerCompany) {
      toast.error("Add a customer before saving the invoice")
      return
    }
    if (!form.lineItems.some((item) => item.description && Number(item.quantity) > 0)) {
      toast.error("Add at least one invoice line item")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(INVOICE_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Unable to create invoice")
      toast.success("Invoice created")
      setBuilderOpen(false)
      setForm(emptyForm())
      await Promise.all([fetchInvoices(), fetchStats()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create invoice")
    } finally {
      setSaving(false)
    }
  }

  async function runInvoiceAction(invoice: Invoice, action: string, init?: RequestInit) {
    setActionLoading(`${invoice._id}:${action}`)
    try {
      const response = await fetch(`${INVOICE_API}/${invoice._id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        ...init,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Invoice action failed")
      toast.success("Invoice updated")
      setSelectedInvoice(payload)
      await Promise.all([fetchInvoices(), fetchStats()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice action failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function recordPayment() {
    if (!selectedInvoice) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount")
      return
    }
    await runInvoiceAction(selectedInvoice, "payments", {
      body: JSON.stringify({ amount, method: "bank_transfer", date: today() }),
    })
    setPaymentAmount("")
  }

  function openPreview(invoice: Invoice) {
    window.open(`${INVOICE_API}/${invoice._id}/preview`, "_blank", "noopener,noreferrer")
  }

  function downloadPdf(invoice: Invoice) {
    window.open(`${INVOICE_API}/${invoice._id}/pdf`, "_blank", "noopener,noreferrer")
  }

  async function copyShareLink(invoice: Invoice) {
    const url = `${INVOICE_API}/${invoice._id}/preview`
    await navigator.clipboard.writeText(url)
    toast.success("Invoice preview link copied")
  }

  function exportCsv() {
    const header = ["Invoice", "Customer", "Status", "Issue date", "Due date", "Grand total", "Paid", "Balance"]
    const rows = invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customerSnapshot.company || invoice.customerSnapshot.name,
      invoice.status,
      formatDate(invoice.issueDate),
      formatDate(invoice.dueDate),
      invoice.totals.grandTotal,
      invoice.totals.paidTotal,
      invoice.totals.balanceDue,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "invoices.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      <AppLayout>
          <SiteHeader />
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ReceiptTextIcon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Invoices</h2>
                {!loading && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                    {total.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={invoices.length === 0}>
                  <DownloadIcon className="size-4" />
                  Export CSV
                </Button>
                <Button size="sm" onClick={() => setBuilderOpen(true)}>
                  <PlusIcon className="size-4" />
                  New invoice
                </Button>
              </div>
            </div>

            <div className="grid gap-3 border-b p-4 md:grid-cols-4">
              <StatCard label="Total invoiced" value={formatMoney(stats?.totalInvoiced ?? 0)} />
              <StatCard label="Outstanding" value={formatMoney(stats?.outstanding ?? 0)} />
              <StatCard label="Overdue" value={formatMoney(stats?.overdue ?? 0)} tone="danger" />
              <StatCard label="Paid this month" value={formatMoney(stats?.paidThisMonth ?? 0)} />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <div className="relative min-w-72 flex-1">
                <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number, customer, PO..." className="pl-10" />
              </div>
              <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1) }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "all" ? "All invoices" : labelStatus(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => { void fetchInvoices(); void fetchStats() }} disabled={loading}>
                    <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <AlertCircleIcon className="size-5 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={() => void fetchInvoices()}>Try again</Button>
              </div>
            ) : loading ? (
              <div className="divide-y">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 px-5 py-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <ReceiptTextIcon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">No invoices yet</h3>
                <p className="max-w-md text-sm text-muted-foreground">Create a draft invoice, preview it, then send or download it for your customer.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-2.5">Invoice</th>
                      <th className="px-5 py-2.5">Customer</th>
                      <th className="px-5 py-2.5">Due</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Total</th>
                      <th className="px-5 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice._id}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                        onClick={() => { setSelectedInvoice(invoice); setDetailOpen(true) }}
                      >
                        <td className="px-5 py-3.5 align-top font-medium">
                          {invoice.invoiceNumber}
                          <div className="text-xs font-normal text-muted-foreground">Issued {formatDate(invoice.issueDate)}</div>
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <div className="font-medium">{invoice.customerSnapshot.company || invoice.customerSnapshot.name || "Walk-in customer"}</div>
                          <div className="text-xs text-muted-foreground">{invoice.customerSnapshot.email || "-"}</div>
                        </td>
                        <td className="px-5 py-3.5 align-top">{formatDate(invoice.dueDate)}</td>
                        <td className="px-5 py-3.5 align-top">
                          <Badge variant={statusVariant(invoice.status)} className="capitalize">{labelStatus(invoice.status)}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right align-top font-medium">{formatMoney(invoice.totals.grandTotal)}</td>
                        <td className="px-5 py-3.5 text-right align-top">{formatMoney(invoice.totals.balanceDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">Page <span className="font-semibold text-foreground">{page}</span> of <span className="font-semibold text-foreground">{totalPages}</span></p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>Next</Button>
              </div>
            </div>
          </div>
      </AppLayout>

        <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-5xl">
            <SheetHeader className="px-5 pt-5">
              <SheetTitle>Create manual invoice</SheetTitle>
            </SheetHeader>
            <Separator />
            <InvoiceBuilder
              form={form}
              customers={customers}
              products={products}
              previewTotals={previewTotals}
              onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
              onSelectCustomer={selectCustomer}
              onSelectProduct={selectProduct}
              onUpdateLine={updateLine}
              onAddLine={() => setForm((current) => ({ ...current, lineItems: [...current.lineItems, emptyLine()] }))}
              onRemoveLine={(index) => setForm((current) => ({ ...current, lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index) }))}
            />
            <SheetFooter className="border-t bg-muted/30">
              <Button onClick={createInvoice} disabled={saving}>
                {saving && <LoaderIcon className="size-4 animate-spin" />}
                Save draft
              </Button>
              <Button variant="outline" onClick={() => setBuilderOpen(false)} disabled={saving}>Cancel</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
            {selectedInvoice && (
              <>
                <SheetHeader className="px-5 pt-5">
                  <SheetTitle className="flex items-center gap-2">
                    {selectedInvoice.invoiceNumber}
                    <Badge variant={statusVariant(selectedInvoice.status)} className="capitalize">{labelStatus(selectedInvoice.status)}</Badge>
                  </SheetTitle>
                </SheetHeader>
                <Separator />
                <InvoiceDetail invoice={selectedInvoice} paymentAmount={paymentAmount} onPaymentAmountChange={setPaymentAmount} />
                <SheetFooter className="flex-wrap border-t bg-muted/30">
                  <Button onClick={() => void runInvoiceAction(selectedInvoice, "send")} disabled={actionLoading !== null || selectedInvoice.status !== "draft"}>
                    <SendIcon className="size-4" />
                    Send
                  </Button>
                  <Button variant="outline" onClick={() => openPreview(selectedInvoice)}>
                    Preview
                  </Button>
                  <Button variant="outline" onClick={() => downloadPdf(selectedInvoice)}>
                    <DownloadIcon className="size-4" />
                    Download PDF
                  </Button>
                  <Button variant="outline" onClick={() => void copyShareLink(selectedInvoice)}>
                    <CopyIcon className="size-4" />
                    Copy link
                  </Button>
                  <Button variant="outline" onClick={() => void recordPayment()} disabled={actionLoading !== null || !paymentAmount}>
                    Record payment
                  </Button>
                  <Button variant="outline" onClick={() => void runInvoiceAction(selectedInvoice, "duplicate")} disabled={actionLoading !== null}>
                    Duplicate
                  </Button>
                  <Button variant="outline" onClick={() => void runInvoiceAction(selectedInvoice, "cancel")} disabled={actionLoading !== null || selectedInvoice.status === "cancelled"}>
                    Cancel
                  </Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>
    </TooltipProvider>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", tone === "danger" && "text-destructive")}>{value}</p>
    </div>
  )
}

function InvoiceBuilder({
  form,
  customers,
  products,
  previewTotals,
  onChange,
  onSelectCustomer,
  onSelectProduct,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
}: {
  form: InvoiceFormState
  customers: Customer[]
  products: Product[]
  previewTotals: ReturnType<typeof calculatePreviewTotals>
  onChange: (patch: Partial<InvoiceFormState>) => void
  onSelectCustomer: (customerId: string) => void
  onSelectProduct: (lineIndex: number, productId: string) => void
  onUpdateLine: (lineIndex: number, patch: Partial<InvoiceLineItem>) => void
  onAddLine: () => void
  onRemoveLine: (lineIndex: number) => void
}) {
  return (
    <div className="grid gap-6 px-5 pb-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-2">
          <Label>Customer</Label>
          <Select value={form.customerId || "manual"} onValueChange={(value) => value === "manual" ? onChange({ customerId: "" }) : onSelectCustomer(value)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual customer</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer._id} value={customer._id}>{customer.company || customer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="Customer name" value={form.customerName} onChange={(value) => onChange({ customerName: value })} />
        <Field label="Company" value={form.customerCompany} onChange={(value) => onChange({ customerCompany: value })} />
        <Field label="Email" value={form.customerEmail} onChange={(value) => onChange({ customerEmail: value })} />
        <Field label="Phone" value={form.customerPhone} onChange={(value) => onChange({ customerPhone: value })} />
        <Field label="PO/reference" value={form.poNumber} onChange={(value) => onChange({ poNumber: value })} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextArea label="Billing address" value={form.billingAddress} onChange={(value) => onChange({ billingAddress: value })} />
        <TextArea label="Shipping address" value={form.shippingAddress} onChange={(value) => onChange({ shippingAddress: value })} />
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <Field label="Issue date" type="date" value={form.issueDate} onChange={(value) => onChange({ issueDate: value })} />
        <Field label="Due date" type="date" value={form.dueDate} onChange={(value) => onChange({ dueDate: value })} />
        <Field label="Payment terms" value={form.paymentTerms} onChange={(value) => onChange({ paymentTerms: value })} />
        <div className="grid gap-2">
          <Label>Template</Label>
          <Select value={form.template} onValueChange={(value) => onChange({ template: value as InvoiceFormState["template"] })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="modern">Modern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Line items</p>
          <Button variant="outline" size="sm" onClick={onAddLine}>Add line</Button>
        </div>
        <div className="divide-y">
          {form.lineItems.map((line, index) => (
            <div key={index} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1fr_.6fr_.7fr_.6fr_.6fr_auto]">
              <div className="grid gap-2">
                <Label>Product</Label>
                <Select value={line.productId ? String(line.productId) : "manual"} onValueChange={(value) => value !== "manual" && onSelectProduct(index, value)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual item</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>{product.productdescription}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Description" value={line.description} onChange={(value) => onUpdateLine(index, { description: value })} />
              <Field label="Qty" type="number" value={String(line.quantity)} onChange={(value) => onUpdateLine(index, { quantity: Number(value) })} />
              <Field label="Rate" type="number" value={String(line.unitPrice)} onChange={(value) => onUpdateLine(index, { unitPrice: Number(value) })} />
              <Field label="Disc %" type="number" value={String(line.discountPercentage)} onChange={(value) => onUpdateLine(index, { discountPercentage: Number(value) })} />
              <Field label="GST %" type="number" value={String(line.gstRate)} onChange={(value) => onUpdateLine(index, { gstRate: Number(value) })} />
              <Button variant="ghost" className="self-end" onClick={() => onRemoveLine(index)} disabled={form.lineItems.length <= 1}>Remove</Button>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextArea label="Notes" value={form.notes} onChange={(value) => onChange({ notes: value })} />
        <TextArea label="Terms and conditions" value={form.termsAndConditions} onChange={(value) => onChange({ termsAndConditions: value })} />
      </div>
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.recurringEnabled} onChange={(event) => onChange({ recurringEnabled: event.target.checked })} />
            Make this recurring
          </label>
          {form.recurringEnabled && (
            <>
              <Select value={form.recurringFrequency} onValueChange={(value) => onChange({ recurringFrequency: value as InvoiceFormState["recurringFrequency"] })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Field label="Start" type="date" value={form.recurringStartDate} onChange={(value) => onChange({ recurringStartDate: value })} />
              <Field label="End" type="date" value={form.recurringEndDate} onChange={(value) => onChange({ recurringEndDate: value })} />
            </>
          )}
        </div>
      </div>
      <div className="ml-auto w-full max-w-sm rounded-xl border p-4 text-sm">
        <TotalRow label="Subtotal" value={previewTotals.subtotal} />
        <TotalRow label="Discount" value={previewTotals.discountTotal} />
        <TotalRow label="Taxable" value={previewTotals.taxableTotal} />
        <TotalRow label="GST" value={previewTotals.taxTotal} />
        <Separator className="my-2" />
        <TotalRow label="Grand total" value={previewTotals.grandTotal} strong />
      </div>
    </div>
  )
}

function InvoiceDetail({
  invoice,
  paymentAmount,
  onPaymentAmountChange,
}: {
  invoice: Invoice
  paymentAmount: string
  onPaymentAmountChange: (value: string) => void
}) {
  return (
    <div className="grid gap-6 px-5 pb-5 text-sm">
      <div className="grid gap-4 rounded-xl border p-4 lg:grid-cols-3">
        <div><p className="text-xs uppercase text-muted-foreground">Customer</p><p className="font-semibold">{invoice.customerSnapshot.company || invoice.customerSnapshot.name}</p><p className="text-muted-foreground">{invoice.customerSnapshot.email}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">Due date</p><p className="font-semibold">{formatDate(invoice.dueDate)}</p><p className="text-muted-foreground">{invoice.paymentTerms}</p></div>
        <div><p className="text-xs uppercase text-muted-foreground">Balance due</p><p className="text-xl font-semibold">{formatMoney(invoice.totals.balanceDue)}</p><p className="text-muted-foreground">Paid {formatMoney(invoice.totals.paidTotal)}</p></div>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full min-w-[720px]">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2">Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST</th><th className="pr-4 text-right">Total</th></tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-3 font-medium">{line.description}</td>
                <td>{line.hsnCode || "-"}</td>
                <td>{line.quantity}</td>
                <td>{formatMoney(line.unitPrice)}</td>
                <td>{line.gstRate}%</td>
                <td className="pr-4 text-right font-medium">{formatMoney(line.totalAmount ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ml-auto w-full max-w-sm rounded-xl border p-4">
        <TotalRow label="Subtotal" value={invoice.totals.subtotal} />
        <TotalRow label="Discount" value={invoice.totals.discountTotal} />
        <TotalRow label="GST" value={invoice.totals.taxTotal} />
        <Separator className="my-2" />
        <TotalRow label="Grand total" value={invoice.totals.grandTotal} strong />
        <TotalRow label="Balance" value={invoice.totals.balanceDue} strong />
      </div>
      <div className="grid gap-3 rounded-xl border p-4">
        <Label htmlFor="paymentAmount">Record manual payment</Label>
        <Input id="paymentAmount" type="number" min="0" value={paymentAmount} onChange={(event) => onPaymentAmountChange(event.target.value)} placeholder="Amount received" />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </div>
  )
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between py-1", strong && "text-base font-semibold")}>
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  )
}
