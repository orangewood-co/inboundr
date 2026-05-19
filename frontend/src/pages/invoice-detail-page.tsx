import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BanIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  FileTextIcon,
  LoaderIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const INVOICE_API = `${API_ORIGIN}/api/v1/invoices`

type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "written_off"

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

interface InvoicePayment {
  amount: number
  date: string
  method: string
  reference: string
  notes: string
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
  payments: InvoicePayment[]
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
  cancelledAt?: string | null
  writtenOffAt?: string | null
  createdAt: string
  updatedAt: string
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

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
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

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    upi: "UPI",
    cheque: "Cheque",
    card: "Card",
    other: "Other",
  }
  return labels[method] || method
}

export default function InvoiceDetailPage() {
  const { id } = useParams({ from: "/invoices/$id" })
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  const fetchInvoice = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${INVOICE_API}/${id}`, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch invoice")
      const data = await response.json()
      setInvoice(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch invoice")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchInvoice()
  }, [fetchInvoice])

  const activity = useMemo(() => {
    if (!invoice) return []
    const events: Array<{ date: string; icon: React.ReactNode; label: string; detail?: string }> = []

    events.push({
      date: invoice.createdAt,
      icon: <FileTextIcon className="size-3.5" />,
      label: "Invoice created",
      detail: `Draft ${invoice.invoiceNumber}`,
    })

    if (invoice.sentAt) {
      events.push({
        date: invoice.sentAt,
        icon: <SendIcon className="size-3.5" />,
        label: "Invoice sent",
        detail: invoice.customerSnapshot.email ? `To ${invoice.customerSnapshot.email}` : undefined,
      })
    }

    if (invoice.viewedAt) {
      events.push({
        date: invoice.viewedAt,
        icon: <EyeIcon className="size-3.5" />,
        label: "Viewed by customer",
      })
    }

    for (const payment of invoice.payments) {
      events.push({
        date: payment.date,
        icon: <CircleDollarSignIcon className="size-3.5" />,
        label: `Payment of ${formatMoney(payment.amount)}`,
        detail: [paymentMethodLabel(payment.method), payment.reference].filter(Boolean).join(" · "),
      })
    }

    if (invoice.cancelledAt) {
      events.push({
        date: invoice.cancelledAt,
        icon: <XCircleIcon className="size-3.5" />,
        label: "Invoice cancelled",
      })
    }

    if (invoice.writtenOffAt) {
      events.push({
        date: invoice.writtenOffAt,
        icon: <BanIcon className="size-3.5" />,
        label: "Invoice written off",
      })
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [invoice])

  async function runAction(action: string, body?: object) {
    if (!invoice) return
    setActionLoading(action)
    try {
      const response = await fetch(`${INVOICE_API}/${invoice._id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Action failed")
      toast.success("Invoice updated")
      setInvoice(payload)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRecordPayment() {
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount")
      return
    }
    await runAction("payments", {
      amount,
      method: paymentMethod,
      reference: paymentReference,
      notes: paymentNotes,
      date: new Date().toISOString().slice(0, 10),
    })
    setPaymentAmount("")
    setPaymentReference("")
    setPaymentNotes("")
  }

  async function handleDuplicate() {
    if (!invoice) return
    setActionLoading("duplicate")
    try {
      const response = await fetch(`${INVOICE_API}/${invoice._id}/duplicate`, {
        method: "POST",
        credentials: "include",
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Duplicate failed")
      toast.success("Invoice duplicated")
      void navigate({ to: "/invoices/$id", params: { id: payload._id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed")
    } finally {
      setActionLoading(null)
    }
  }

  function openPreview() {
    if (!invoice) return
    window.open(`${INVOICE_API}/${invoice._id}/preview`, "_blank", "noopener,noreferrer")
  }

  function downloadPdf() {
    if (!invoice) return
    window.open(`${INVOICE_API}/${invoice._id}/pdf`, "_blank", "noopener,noreferrer")
  }

  async function copyShareLink() {
    if (!invoice) return
    const url = `${INVOICE_API}/${invoice._id}/preview`
    await navigator.clipboard.writeText(url)
    toast.success("Invoice preview link copied")
  }

  if (loading) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Details" }]} />
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </AppLayout>
    )
  }

  if (error || !invoice) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "Details" }]} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <XCircleIcon className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error ?? "Invoice not found"}</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/invoices">Back to invoices</Link>
          </Button>
        </div>
      </AppLayout>
    )
  }

  const isDraft = invoice.status === "draft"
  const isCancellable = invoice.status !== "cancelled" && invoice.status !== "written_off" && invoice.status !== "paid"

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: invoice.invoiceNumber }]} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="size-8" asChild>
              <Link to="/invoices">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <Badge variant={statusVariant(invoice.status)} className="capitalize">
                {labelStatus(invoice.status)}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <Button size="sm" onClick={() => void navigate({ to: "/invoices/new", search: { edit: invoice._id } })}>
                <EditIcon className="size-3.5" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => void runAction("send")}
              disabled={actionLoading !== null || !isDraft}
            >
              {actionLoading === "send" ? <LoaderIcon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
              Send
            </Button>
            <Button variant="outline" size="sm" onClick={openPreview}>
              <EyeIcon className="size-3.5" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPdf}>
              <DownloadIcon className="size-3.5" />
              PDF
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void copyShareLink()}>
                  <CopyIcon className="size-3.5" />
                  Copy share link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDuplicate()} disabled={actionLoading !== null}>
                  <RefreshCwIcon className="size-3.5" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void runAction("write-off")}
                  disabled={actionLoading !== null || !isCancellable}
                  className="text-destructive"
                >
                  <BanIcon className="size-3.5" />
                  Write off
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void runAction("cancel")}
                  disabled={actionLoading !== null || !isCancellable}
                  className="text-destructive"
                >
                  <XCircleIcon className="size-3.5" />
                  Cancel invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</p>
              <p className="mt-2 font-semibold">{invoice.customerSnapshot.company || invoice.customerSnapshot.name}</p>
              {invoice.customerSnapshot.email && (
                <p className="mt-0.5 text-sm text-muted-foreground">{invoice.customerSnapshot.email}</p>
              )}
              {invoice.customerSnapshot.contactNumber && (
                <p className="text-sm text-muted-foreground">{invoice.customerSnapshot.contactNumber}</p>
              )}
              {invoice.customerSnapshot.billingAddress && (
                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line">{invoice.customerSnapshot.billingAddress}</p>
              )}
            </div>

            <div className="rounded-xl border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</p>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span className="font-medium">{formatDate(invoice.issueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Terms</span>
                  <span className="font-medium">{invoice.paymentTerms || "-"}</span>
                </div>
                {invoice.poNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PO #</span>
                    <span className="font-medium">{invoice.poNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(invoice.totals.grandTotal)}</p>
              <div className="mt-2 grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-green-600">{formatMoney(invoice.totals.paidTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={cn("font-semibold", invoice.totals.balanceDue > 0 && "text-destructive")}>
                    {formatMoney(invoice.totals.balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border">
            <div className="border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5 w-8">#</th>
                    <th className="px-5 py-2.5">Description</th>
                    <th className="px-5 py-2.5">HSN</th>
                    <th className="px-5 py-2.5 text-right">Qty</th>
                    <th className="px-5 py-2.5 text-right">Rate</th>
                    <th className="px-5 py-2.5 text-right">Disc %</th>
                    <th className="px-5 py-2.5 text-right">GST %</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((line, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-5 py-3.5 text-muted-foreground">{index + 1}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium">{line.description}</span>
                        {line.productCode && (
                          <span className="ml-2 text-xs text-muted-foreground">{line.productCode}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{line.hsnCode || "-"}</td>
                      <td className="px-5 py-3.5 text-right">{line.quantity} {line.unit}</td>
                      <td className="px-5 py-3.5 text-right">{formatMoney(line.unitPrice)}</td>
                      <td className="px-5 py-3.5 text-right">{line.discountPercentage > 0 ? `${line.discountPercentage}%` : "-"}</td>
                      <td className="px-5 py-3.5 text-right">{line.gstRate}%</td>
                      <td className="px-5 py-3.5 text-right font-medium">{formatMoney(line.totalAmount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals + Payment section side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Totals */}
            <div className="rounded-xl border p-5">
              <h2 className="text-sm font-semibold">Summary</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(invoice.totals.subtotal)}</span>
                </div>
                {invoice.totals.discountTotal > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-green-600">-{formatMoney(invoice.totals.discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Taxable amount</span>
                  <span>{formatMoney(invoice.totals.taxableTotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">GST</span>
                  <span>{formatMoney(invoice.totals.taxTotal)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between py-1 text-base font-semibold">
                  <span>Grand Total</span>
                  <span>{formatMoney(invoice.totals.grandTotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-green-600">{formatMoney(invoice.totals.paidTotal)}</span>
                </div>
                <div className="flex justify-between py-1 text-base font-semibold">
                  <span>Balance Due</span>
                  <span className={cn(invoice.totals.balanceDue > 0 && "text-destructive")}>
                    {formatMoney(invoice.totals.balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Record payment */}
            <div className="rounded-xl border p-5">
              <h2 className="text-sm font-semibold">Record Payment</h2>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Reference / Transaction ID</Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UTR number, cheque no."
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
                <Button
                  onClick={() => void handleRecordPayment()}
                  disabled={actionLoading !== null || !paymentAmount || invoice.status === "paid" || invoice.status === "cancelled"}
                  className="w-full sm:w-auto sm:justify-self-end"
                >
                  {actionLoading === "payments" && <LoaderIcon className="size-3.5 animate-spin" />}
                  <CheckCircle2Icon className="size-3.5" />
                  Record payment
                </Button>
              </div>
            </div>
          </div>

          {/* Payment history + Activity side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Payment history */}
            <div className="rounded-xl border">
              <div className="border-b px-5 py-3">
                <h2 className="text-sm font-semibold">Payment History</h2>
              </div>
              {invoice.payments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <CircleDollarSignIcon className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {invoice.payments.map((payment, index) => (
                    <div key={index} className="flex items-start justify-between gap-4 px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium">{formatMoney(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {paymentMethodLabel(payment.method)}
                          {payment.reference && ` · ${payment.reference}`}
                        </p>
                        {payment.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{payment.notes}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(payment.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity timeline */}
            <div className="rounded-xl border">
              <div className="border-b px-5 py-3">
                <h2 className="text-sm font-semibold">Activity</h2>
              </div>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <ClockIcon className="size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                </div>
              ) : (
                <div className="relative px-5 py-4">
                  <div className="absolute top-4 bottom-4 left-[29px] w-px bg-border" />
                  <div className="grid gap-4">
                    {activity.map((event, index) => (
                      <div key={index} className="relative flex gap-3">
                        <div className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                          {event.icon}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="text-sm font-medium leading-none">{event.label}</p>
                          {event.detail && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(event.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {invoice.notes && (
                <div className="rounded-xl border p-5">
                  <h2 className="text-sm font-semibold">Notes</h2>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div className="rounded-xl border p-5">
                  <h2 className="text-sm font-semibold">Terms & Conditions</h2>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{invoice.termsAndConditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Recurring info */}
          {invoice.recurring.enabled && (
            <div className="rounded-xl border bg-muted/30 p-5">
              <h2 className="text-sm font-semibold">Recurring Schedule</h2>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">Frequency: <span className="font-medium text-foreground capitalize">{invoice.recurring.frequency}</span></span>
                <span className="text-muted-foreground">Start: <span className="font-medium text-foreground">{formatDate(invoice.recurring.startDate)}</span></span>
                {invoice.recurring.endDate && (
                  <span className="text-muted-foreground">End: <span className="font-medium text-foreground">{formatDate(invoice.recurring.endDate)}</span></span>
                )}
                {invoice.recurring.nextRunDate && (
                  <span className="text-muted-foreground">Next: <span className="font-medium text-foreground">{formatDate(invoice.recurring.nextRunDate)}</span></span>
                )}
                <span className="text-muted-foreground">Auto-send: <span className="font-medium text-foreground">{invoice.recurring.autoSend ? "Yes" : "No"}</span></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
