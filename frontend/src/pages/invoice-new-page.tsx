import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, Link, useSearch } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  PlusIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const INVOICE_API = `${API_ORIGIN}/api/v1/invoices`
const CUSTOMER_API = `${API_ORIGIN}/api/v1/customers`
const PRODUCT_API = `${API_ORIGIN}/api/v1/products`

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
  return { subtotal, discountTotal: subtotal - taxableTotal, taxableTotal, taxTotal, grandTotal: taxableTotal + taxTotal }
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

export default function InvoiceNewPage() {
  const navigate = useNavigate()
  const searchParams = useSearch({ from: "/invoices/new" })
  const editId = searchParams.edit

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<InvoiceFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

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

  const fetchInvoiceForEdit = useCallback(async () => {
    if (!editId) return
    setLoadingEdit(true)
    try {
      const response = await fetch(`${INVOICE_API}/${editId}`, { credentials: "include" })
      if (!response.ok) throw new Error("Unable to fetch invoice for editing")
      const invoice = await response.json()
      setForm({
        customerId: invoice.customerId || "",
        customerName: invoice.customerSnapshot?.name || "",
        customerCompany: invoice.customerSnapshot?.company || "",
        customerEmail: invoice.customerSnapshot?.email || "",
        customerPhone: invoice.customerSnapshot?.contactNumber || "",
        billingAddress: invoice.customerSnapshot?.billingAddress || "",
        shippingAddress: invoice.customerSnapshot?.shippingAddress || "",
        issueDate: invoice.issueDate?.slice(0, 10) || today(),
        dueDate: invoice.dueDate?.slice(0, 10) || "",
        paymentTerms: invoice.paymentTerms || "Due on receipt",
        poNumber: invoice.poNumber || "",
        notes: invoice.notes || "",
        termsAndConditions: invoice.termsAndConditions || "",
        template: invoice.template || "professional",
        recurringEnabled: invoice.recurring?.enabled || false,
        recurringFrequency: invoice.recurring?.frequency || "monthly",
        recurringStartDate: invoice.recurring?.startDate?.slice(0, 10) || today(),
        recurringEndDate: invoice.recurring?.endDate?.slice(0, 10) || "",
        recurringAutoSend: invoice.recurring?.autoSend || false,
        lineItems: invoice.lineItems?.length > 0
          ? invoice.lineItems.map((item: InvoiceLineItem) => ({
              productId: item.productId,
              description: item.description || "",
              productCode: item.productCode || "",
              hsnCode: item.hsnCode || "",
              unit: item.unit || "",
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
              discountPercentage: item.discountPercentage ?? 0,
              gstRate: item.gstRate ?? 18,
            }))
          : [emptyLine()],
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load invoice")
    } finally {
      setLoadingEdit(false)
    }
  }, [editId])

  useEffect(() => {
    void fetchLookups()
    void fetchInvoiceForEdit()
  }, [fetchLookups, fetchInvoiceForEdit])

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

  async function saveInvoice(andSend = false) {
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
      const isEdit = !!editId
      const url = isEdit ? `${INVOICE_API}/${editId}` : INVOICE_API
      const method = isEdit ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "Unable to save invoice")

      const invoiceId = payload._id

      if (andSend) {
        const sendResponse = await fetch(`${INVOICE_API}/${invoiceId}/send`, {
          method: "POST",
          credentials: "include",
        })
        if (sendResponse.ok) {
          toast.success("Invoice saved and sent")
        } else {
          toast.success("Invoice saved (sending failed)")
        }
      } else {
        toast.success(isEdit ? "Invoice updated" : "Invoice created")
      }

      void navigate({ to: "/invoices/$id", params: { id: invoiceId } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save invoice")
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New Invoice" }]} />
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: editId ? "Edit Invoice" : "New Invoice" }]} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="size-8" asChild>
              <Link to="/invoices">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">
              {editId ? "Edit Invoice" : "New Invoice"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void saveInvoice(false)} disabled={saving}>
              {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
              Save draft
            </Button>
            <Button size="sm" onClick={() => void saveInvoice(true)} disabled={saving}>
              {saving ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
              Save & Send
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* Customer section */}
          <div className="rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Customer</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label className="text-xs">Select customer</Label>
                <Select
                  value={form.customerId || "manual"}
                  onValueChange={(value) => value === "manual" ? setForm((c) => ({ ...c, customerId: "" })) : selectCustomer(value)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual entry</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer._id} value={customer._id}>
                        {customer.company || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField label="Name" value={form.customerName} onChange={(v) => setForm((c) => ({ ...c, customerName: v }))} />
              <FormField label="Company" value={form.customerCompany} onChange={(v) => setForm((c) => ({ ...c, customerCompany: v }))} />
              <FormField label="Email" value={form.customerEmail} onChange={(v) => setForm((c) => ({ ...c, customerEmail: v }))} />
              <FormField label="Phone" value={form.customerPhone} onChange={(v) => setForm((c) => ({ ...c, customerPhone: v }))} />
              <FormField label="PO / Reference" value={form.poNumber} onChange={(v) => setForm((c) => ({ ...c, poNumber: v }))} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FormTextArea label="Billing address" value={form.billingAddress} onChange={(v) => setForm((c) => ({ ...c, billingAddress: v }))} />
              <FormTextArea label="Shipping address" value={form.shippingAddress} onChange={(v) => setForm((c) => ({ ...c, shippingAddress: v }))} />
            </div>
          </div>

          {/* Invoice details */}
          <div className="rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Invoice Details</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              <FormField label="Issue date" type="date" value={form.issueDate} onChange={(v) => setForm((c) => ({ ...c, issueDate: v }))} />
              <FormField label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm((c) => ({ ...c, dueDate: v }))} />
              <FormField label="Payment terms" value={form.paymentTerms} onChange={(v) => setForm((c) => ({ ...c, paymentTerms: v }))} />
              <div className="grid gap-2">
                <Label className="text-xs">Template</Label>
                <Select value={form.template} onValueChange={(v) => setForm((c) => ({ ...c, template: v as InvoiceFormState["template"] }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-sm font-semibold">Line Items</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForm((c) => ({ ...c, lineItems: [...c.lineItems, emptyLine()] }))}
              >
                <PlusIcon className="size-3.5" />
                Add item
              </Button>
            </div>
            <div className="divide-y">
              {form.lineItems.map((line, index) => (
                <div key={index} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1fr_.5fr_.7fr_.5fr_.5fr_auto]">
                  <div className="grid gap-2">
                    <Label className="text-xs">Product</Label>
                    <Select
                      value={line.productId ? String(line.productId) : "manual"}
                      onValueChange={(v) => v !== "manual" && selectProduct(index, v)}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual item</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.productdescription}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormField label="Description" value={line.description} onChange={(v) => updateLine(index, { description: v })} />
                  <FormField label="Qty" type="number" value={String(line.quantity)} onChange={(v) => updateLine(index, { quantity: Number(v) })} />
                  <FormField label="Rate" type="number" value={String(line.unitPrice)} onChange={(v) => updateLine(index, { unitPrice: Number(v) })} />
                  <FormField label="Disc %" type="number" value={String(line.discountPercentage)} onChange={(v) => updateLine(index, { discountPercentage: Number(v) })} />
                  <FormField label="GST %" type="number" value={String(line.gstRate)} onChange={(v) => updateLine(index, { gstRate: Number(v) })} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5 size-8 text-destructive hover:text-destructive"
                    onClick={() => setForm((c) => ({ ...c, lineItems: c.lineItems.filter((_, i) => i !== index) }))}
                    disabled={form.lineItems.length <= 1}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes + Totals */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-4">
              <FormTextArea label="Notes (visible to customer)" value={form.notes} onChange={(v) => setForm((c) => ({ ...c, notes: v }))} />
              <FormTextArea label="Terms & Conditions" value={form.termsAndConditions} onChange={(v) => setForm((c) => ({ ...c, termsAndConditions: v }))} />
            </div>
            <div className="self-start rounded-xl border p-5">
              <h2 className="text-sm font-semibold">Totals Preview</h2>
              <div className="mt-4 grid gap-2 text-sm">
                <TotalRow label="Subtotal" value={previewTotals.subtotal} />
                {previewTotals.discountTotal > 0 && (
                  <TotalRow label="Discount" value={previewTotals.discountTotal} negative />
                )}
                <TotalRow label="Taxable" value={previewTotals.taxableTotal} />
                <TotalRow label="GST" value={previewTotals.taxTotal} />
                <Separator className="my-1" />
                <TotalRow label="Grand Total" value={previewTotals.grandTotal} strong />
              </div>
            </div>
          </div>

          {/* Recurring */}
          <div className="rounded-xl border bg-muted/30 p-5">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.recurringEnabled}
                onChange={(e) => setForm((c) => ({ ...c, recurringEnabled: e.target.checked }))}
                className="size-4 rounded border-input"
              />
              Make this a recurring invoice
            </label>
            {form.recurringEnabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="grid gap-2">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={form.recurringFrequency} onValueChange={(v) => setForm((c) => ({ ...c, recurringFrequency: v as InvoiceFormState["recurringFrequency"] }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FormField label="Start date" type="date" value={form.recurringStartDate} onChange={(v) => setForm((c) => ({ ...c, recurringStartDate: v }))} />
                <FormField label="End date (optional)" type="date" value={form.recurringEndDate} onChange={(v) => setForm((c) => ({ ...c, recurringEndDate: v }))} />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.recurringAutoSend}
                      onChange={(e) => setForm((c) => ({ ...c, recurringAutoSend: e.target.checked }))}
                      className="size-4 rounded border-input"
                    />
                    Auto-send
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button variant="outline" asChild>
              <Link to="/invoices">Cancel</Link>
            </Button>
            <Button variant="outline" onClick={() => void saveInvoice(false)} disabled={saving}>
              {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
              Save draft
            </Button>
            <Button onClick={() => void saveInvoice(true)} disabled={saving}>
              {saving ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <SendIcon className="size-3.5" />
              )}
              Save & Send
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function FormField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FormTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </div>
  )
}

function TotalRow({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn("flex justify-between py-1", strong && "text-base font-semibold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className={cn(negative && "text-green-600")}>{negative ? `-${formatMoney(value)}` : formatMoney(value)}</span>
    </div>
  )
}
