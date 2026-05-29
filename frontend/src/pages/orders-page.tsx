import { useCallback, useEffect, useState } from "react"
import { AlertCircleIcon, CheckCircle2Icon, ClipboardListIcon, PackageIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/rfq`

interface RFQEmail {
  _id: string
  subject: string
  from: string
  date: string
  snippet: string | null
  status: string
}

interface RFQCustomer {
  name: string
  company: string
  email: string
  contactNumber: string | null
  address: string | null
}

interface RFQSavedQuoteProduct {
  queryName: string
  quantity: number
  productId: number
  brand: string | null
  description: string | null
  code: string | null
  price: number | null
  hsnCode: string | null
  gstRate: number | null
}

interface DraftRFQ {
  _id: string
  emailId: RFQEmail
  customer: RFQCustomer | null
  savedQuoteProducts: RFQSavedQuoteProduct[]
  draftSavedAt: string | null
  createdAt: string
}

interface DraftsResponse {
  rfqs: DraftRFQ[]
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+)>$/)
  if (match) return { name: match[1].trim(), email: match[2] }
  return { name: from, email: from }
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function productSummary(products: RFQSavedQuoteProduct[]): string {
  if (products.length === 0) return "No saved products"
  return products
    .slice(0, 3)
    .map((product) => `${product.queryName} x ${product.quantity}`)
    .join(", ")
}

export function OrdersPage() {
  const [drafts, setDrafts] = useState<DraftRFQ[]>([])
  const [quoteNumbers, setQuoteNumbers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/drafts`, { credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DraftsResponse = await res.json()
      setDrafts(data.rfqs)
    } catch (err: any) {
      setError(err.message || "Failed to load draft RFQs")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchDrafts()
  }

  const handleMarkProcessed = async (rfqId: string) => {
    const quoteNumber = quoteNumbers[rfqId]?.trim()
    if (!quoteNumber) {
      toast.error("Enter a quote number first")
      return
    }

    setProcessingId(rfqId)
    try {
      const res = await fetch(`${API_BASE}/${rfqId}/quote-number`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteNumber }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      setDrafts((current) => current.filter((draft) => draft._id !== rfqId))
      setQuoteNumbers((current) => {
        const next = { ...current }
        delete next[rfqId]
        return next
      })
      toast.success("RFQ marked processed")
    } catch (err) {
      toast.error("Failed to mark RFQ processed")
      console.error("Failed to mark RFQ processed:", err)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AppLayout>
      <SiteHeader />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ClipboardListIcon className="size-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">Orders</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Review draft RFQs and enter quote numbers when they are ready to process.
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCwIcon className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Draft RFQs</p>
                <p className="text-xs text-muted-foreground">
                  {loading ? "Loading drafts..." : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <AlertCircleIcon className="size-6 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Retry
                </Button>
              </div>
            ) : drafts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <div className="rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/30 p-5">
                  <CheckCircle2Icon className="size-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium">No draft RFQs</p>
                  <p className="text-xs text-muted-foreground">
                    Saved RFQ selections will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Saved</TableHead>
                    <TableHead className="w-64">Quote Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((draft) => {
                    const sender = parseSender(draft.emailId.from)
                    const customerName = draft.customer?.company || draft.customer?.name || sender.name
                    const products = draft.savedQuoteProducts ?? []
                    return (
                      <TableRow key={draft._id}>
                        <TableCell>
                          <div className="font-medium">{customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {draft.customer?.email || sender.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-72 truncate font-medium">
                            {draft.emailId.subject || "(no subject)"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {draft.emailId.snippet}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <PackageIcon className="size-3.5 text-muted-foreground" />
                            {products.length} product{products.length === 1 ? "" : "s"}
                          </div>
                          <div className="max-w-72 truncate text-xs text-muted-foreground">
                            {productSummary(products)}
                            {products.length > 3 ? `, +${products.length - 3} more` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFullDate(draft.draftSavedAt || draft.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Input
                              value={quoteNumbers[draft._id] ?? ""}
                              onChange={(event) =>
                                setQuoteNumbers((current) => ({
                                  ...current,
                                  [draft._id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  handleMarkProcessed(draft._id)
                                }
                              }}
                              placeholder="Enter quote no."
                            />
                            <Button
                              className="shrink-0"
                              onClick={() => handleMarkProcessed(draft._id)}
                              disabled={processingId === draft._id}
                            >
                              {processingId === draft._id && <Spinner data-icon="inline-start" />}
                              Mark Processed
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  )
}

export default OrdersPage
