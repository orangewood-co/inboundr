import { useEffect, useRef } from "react"
import { makeAssistantToolUI } from "@assistant-ui/react"
import { AlertCircleIcon, FileTextIcon, ReceiptTextIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useInvoiceArtifact } from "@/lib/invoice-artifact"

type InvoiceSummary = {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string | null
  dueDate: string | null
  poNumber: string
  customerName: string
  customerCompany: string
  customerEmail: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    gstRate: number
    discountPercentage: number
    totalAmount: number
  }>
  totals: {
    subtotal: number
    discountTotal: number
    taxTotal: number
    grandTotal: number
    paidTotal: number
    balanceDue: number
  }
}

type InvoiceMutationResult =
  | { status: "created" | "updated"; invoice: InvoiceSummary }
  | { status: "invalid" | "not_found" | "not_draft"; error: string }

type SearchInvoicesResult = {
  total: number
  invoices: InvoiceSummary[]
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function statusBadgeVariant(status: string) {
  if (status === "paid") return "default" as const
  if (status === "overdue" || status === "cancelled" || status === "written_off") {
    return "destructive" as const
  }
  if (status === "draft") return "outline" as const
  return "secondary" as const
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

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

function InvoiceArtifactCard({
  invoice,
  autoOpen,
}: {
  invoice: InvoiceSummary
  autoOpen: boolean
}) {
  const openArtifact = useInvoiceArtifact((state) => state.open)
  const autoOpened = useRef(false)

  useEffect(() => {
    if (!autoOpen || autoOpened.current) return
    autoOpened.current = true
    openArtifact({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
  }, [autoOpen, invoice.id, invoice.invoiceNumber, openArtifact])

  return (
    <button
      type="button"
      onClick={() =>
        openArtifact({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber })
      }
      className="group flex w-full max-w-md items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileTextIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{invoice.invoiceNumber}</span>
          <Badge variant={statusBadgeVariant(invoice.status)} className="capitalize">
            {statusLabel(invoice.status)}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {invoice.customerName || "No customer"}
          {" · "}
          {money.format(invoice.totals.grandTotal)}
        </p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        View PDF
      </span>
    </button>
  )
}

/**
 * Tracks whether this tool call ran live in the current session (vs being
 * replayed from thread history), so the artifact panel only auto-opens for
 * freshly created invoices.
 */
function useSawRunning(statusType: string) {
  const sawRunning = useRef(false)
  if (statusType === "running") sawRunning.current = true
  return sawRunning.current
}

function InvoiceMutationToolUI({
  statusType,
  result,
  pendingLabel,
}: {
  statusType: string
  result: InvoiceMutationResult | undefined
  pendingLabel: string
}) {
  const ranLive = useSawRunning(statusType)

  if (statusType === "running") return <ToolPendingCard label={pendingLabel} />
  if (!result) return null
  if ("error" in result) return <ToolErrorNote message={result.error} />
  return (
    <InvoiceArtifactCard
      invoice={result.invoice}
      autoOpen={ranLive && result.status === "created"}
    />
  )
}

export const CreateInvoiceToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  InvoiceMutationResult
>({
  toolName: "createInvoice",
  render: ({ result, status }) => (
    <InvoiceMutationToolUI
      statusType={status.type}
      result={result}
      pendingLabel="Creating invoice..."
    />
  ),
})

export const UpdateInvoiceToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  InvoiceMutationResult
>({
  toolName: "updateInvoice",
  render: ({ result, status }) => (
    <InvoiceMutationToolUI
      statusType={status.type}
      result={result}
      pendingLabel="Updating invoice..."
    />
  ),
})

function SearchInvoicesResults({ result }: { result: SearchInvoicesResult }) {
  const openArtifact = useInvoiceArtifact((state) => state.open)

  if (result.invoices.length === 0) {
    return (
      <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
        <ReceiptTextIcon className="size-4 shrink-0" />
        No matching invoices found.
      </div>
    )
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ReceiptTextIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Invoices</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
          {result.total}
        </span>
      </div>
      <ul className="divide-y">
        {result.invoices.map((invoice) => (
          <li key={invoice.id}>
            <button
              type="button"
              onClick={() =>
                openArtifact({
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                })
              }
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{invoice.invoiceNumber}</span>
                  <Badge variant={statusBadgeVariant(invoice.status)} className="capitalize">
                    {statusLabel(invoice.status)}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {invoice.customerName || "No customer"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {money.format(invoice.totals.grandTotal)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const SearchInvoicesToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  SearchInvoicesResult
>({
  toolName: "searchInvoices",
  render: ({ result, status }) => {
    if (status.type === "running") return <ToolPendingCard label="Searching invoices..." />
    if (!result) return null
    return <SearchInvoicesResults result={result} />
  },
})

export function InvoiceToolUIs() {
  return (
    <>
      <CreateInvoiceToolUI />
      <UpdateInvoiceToolUI />
      <SearchInvoicesToolUI />
    </>
  )
}
