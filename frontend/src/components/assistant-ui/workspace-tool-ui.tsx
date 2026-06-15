import { useEffect, useRef, useState } from "react"
import { makeAssistantToolUI } from "@assistant-ui/react"
import {
  AlertCircleIcon,
  BoxIcon,
  Building2Icon,
  FileTextIcon,
  HashIcon,
  IndianRupeeIcon,
  MailIcon,
  PhoneIcon,
  SendIcon,
  TagIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatMoney } from "@/lib/format"
import {
  useChatArtifact,
  type CustomerArtifact,
  type ProductArtifact,
} from "@/lib/invoice-artifact"

type ProductSummary = ProductArtifact["product"] & {
  score?: number
  matchReasons?: string[]
}

type SearchProductsResult = {
  query: string
  status: "matched" | "ambiguous" | "no_match"
  matches: ProductSummary[]
}

type ProductMutationResult =
  | { status: "created"; product: ProductSummary }
  | { status: "invalid"; error: string }

type CustomerSummary = CustomerArtifact["customer"]

type SearchCustomersResult = {
  query: string
  matches: CustomerSummary[]
}

type SendInvoiceInput = {
  invoiceId: string
}

type SendInvoiceResult =
  | { status: "manual_send_required"; invoiceNumber: string; message: string }
  | { status: "not_found"; error: string }

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

function EmptyToolResult({
  icon: Icon,
  label,
}: {
  icon: typeof BoxIcon
  label: string
}) {
  return (
    <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      {label}
    </div>
  )
}

function useSawRunning(statusType: string) {
  const [sawRunning] = useState(statusType === "running")
  return sawRunning
}

function ProductCard({
  product,
  autoOpen = false,
}: {
  product: ProductSummary
  autoOpen?: boolean
}) {
  const openArtifact = useChatArtifact((state) => state.open)
  const autoOpened = useRef(false)

  useEffect(() => {
    if (!autoOpen || autoOpened.current) return
    autoOpened.current = true
    openArtifact({ type: "product", product })
  }, [autoOpen, openArtifact, product])

  return (
    <button
      type="button"
      onClick={() => openArtifact({ type: "product", product })}
      className="group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BoxIcon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {product.description || product.code || "Product"}
          </span>
          {product.isTopSeller ? (
            <Badge variant="secondary">Top Seller</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {product.brand || "No brand"}
          {product.code ? ` · ${product.code}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <IndianRupeeIcon className="size-3" />
            {product.price == null
              ? "Price pending"
              : formatMoney(product.price)}
          </span>
          {product.gstRate == null ? null : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <TagIcon className="size-3" />
              GST {product.gstRate}%
            </span>
          )}
          {product.hsnCode ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <HashIcon className="size-3" />
              HSN {product.hsnCode}
            </span>
          ) : null}
        </div>
        {product.matchReasons?.length ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {product.matchReasons.join(" · ")}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 pt-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Preview
      </span>
    </button>
  )
}

function SearchProductsResults({ result }: { result: SearchProductsResult }) {
  if (result.matches.length === 0) {
    return (
      <EmptyToolResult icon={BoxIcon} label="No matching products found." />
    )
  }

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <BoxIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Products</span>
        <Badge
          variant={result.status === "matched" ? "default" : "secondary"}
          className="capitalize"
        >
          {result.status.replace("_", " ")}
        </Badge>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tabular-nums">
          {result.matches.length}
        </span>
      </div>
      <ul className="divide-y">
        {result.matches.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function CustomerCard({ customer }: { customer: CustomerSummary }) {
  const openArtifact = useChatArtifact((state) => state.open)

  return (
    <button
      type="button"
      onClick={() => openArtifact({ type: "customer", customer })}
      className="group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Building2Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {customer.name || customer.company || "Customer"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {customer.company || "No company"}
        </p>
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
          {customer.email ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MailIcon className="size-3 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </span>
          ) : null}
          {customer.contactNumber ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <PhoneIcon className="size-3 shrink-0" />
              <span className="truncate">{customer.contactNumber}</span>
            </span>
          ) : null}
        </div>
      </div>
      <span className="shrink-0 pt-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Preview
      </span>
    </button>
  )
}

function SearchCustomersResults({ result }: { result: SearchCustomersResult }) {
  if (result.matches.length === 0) {
    return (
      <EmptyToolResult
        icon={Building2Icon}
        label="No matching customers found."
      />
    )
  }

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Building2Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Customers</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tabular-nums">
          {result.matches.length}
        </span>
      </div>
      <ul className="divide-y">
        {result.matches.map((customer) => (
          <li key={customer.id}>
            <CustomerCard customer={customer} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function AddProductResultCard({
  result,
  statusType,
}: {
  result: ProductMutationResult | undefined
  statusType: string
}) {
  const ranLive = useSawRunning(statusType)

  if (statusType === "running")
    return <ToolPendingCard label="Adding product..." />
  if (!result) return null
  if ("error" in result) return <ToolErrorNote message={result.error} />

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <BoxIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Product Created</span>
      </div>
      <ProductCard product={result.product} autoOpen={ranLive} />
    </div>
  )
}

function SendInvoiceResultCard({
  args,
  result,
  statusType,
}: {
  args: SendInvoiceInput
  result: SendInvoiceResult | undefined
  statusType: string
}) {
  const openArtifact = useChatArtifact((state) => state.open)

  if (statusType === "running")
    return <ToolPendingCard label="Checking invoice..." />
  if (!result) return null
  if ("error" in result) return <ToolErrorNote message={result.error} />

  return (
    <div className="w-full max-w-md rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SendIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Manual Send Required</p>
          <p className="truncate text-xs text-muted-foreground">
            {result.invoiceNumber}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{result.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            openArtifact({
              type: "invoice",
              invoiceId: args.invoiceId,
              invoiceNumber: result.invoiceNumber,
            })
          }
        >
          <FileTextIcon className="size-4" />
          Preview Invoice
        </Button>
        <Button size="sm" asChild>
          <a href={`/invoices/${args.invoiceId}`}>Open Invoice</a>
        </Button>
      </div>
    </div>
  )
}

const SearchProductsToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  SearchProductsResult
>({
  toolName: "searchProducts",
  render: ({ result, status }) => {
    if (status.type === "running")
      return <ToolPendingCard label="Searching products..." />
    if (!result) return null
    return <SearchProductsResults result={result} />
  },
})

const AddProductToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  ProductMutationResult
>({
  toolName: "addProduct",
  render: ({ result, status }) => (
    <AddProductResultCard result={result} statusType={status.type} />
  ),
})

const SearchCustomersToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  SearchCustomersResult
>({
  toolName: "searchCustomers",
  render: ({ result, status }) => {
    if (status.type === "running")
      return <ToolPendingCard label="Searching customers..." />
    if (!result) return null
    return <SearchCustomersResults result={result} />
  },
})

const SendInvoiceToolUI = makeAssistantToolUI<
  SendInvoiceInput,
  SendInvoiceResult
>({
  toolName: "sendInvoice",
  render: ({ args, result, status }) => (
    <SendInvoiceResultCard
      args={args}
      result={result}
      statusType={status.type}
    />
  ),
})

export function WorkspaceToolUIs() {
  return (
    <>
      <SearchProductsToolUI />
      <AddProductToolUI />
      <SearchCustomersToolUI />
      <SendInvoiceToolUI />
    </>
  )
}
