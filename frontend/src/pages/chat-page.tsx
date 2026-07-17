import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react"
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk"
import {
  BoxIcon,
  Building2Icon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HashIcon,
  IndianRupeeIcon,
  MailIcon,
  PhoneIcon,
  TagIcon,
  XIcon,
} from "lucide-react"

import { InvoiceToolUIs } from "@/components/assistant-ui/invoice-tool-ui"
import { KnowledgeToolUIs } from "@/components/assistant-ui/knowledge-tool-ui"
import { Thread } from "@/components/assistant-ui/thread"
import { ChatHeaderActions } from "@/components/assistant-ui/thread-list"
import { WorkspaceToolUIs } from "@/components/assistant-ui/workspace-tool-ui"
import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { chatApiUrl, chatThreadListAdapter } from "@/lib/chat-api"
import { openDownload } from "@/lib/downloads"
import { API_ORIGIN } from "@/lib/env"
import { formatMoney } from "@/lib/format"
import {
  useChatArtifact,
  type ChatArtifact,
  type CustomerArtifact,
  type InvoiceArtifact,
  type ProductArtifact,
} from "@/lib/invoice-artifact"

function useInboundrChatRuntime() {
  return useChatRuntime({
    transport: new AssistantChatTransport({
      api: chatApiUrl,
      credentials: "include",
    }),
  })
}

function ChatRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    adapter: chatThreadListAdapter,
    runtimeHook: useInboundrChatRuntime,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value)
}

function PanelValue({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HashIcon
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value || "-"}</div>
    </div>
  )
}

function ArtifactPanelHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileTextIcon
  title: string
  children?: React.ReactNode
}) {
  const close = useChatArtifact((state) => state.close)

  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="truncate text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Close"
          aria-label="Close preview"
          onClick={close}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function InvoiceArtifactPanel({ artifact }: { artifact: InvoiceArtifact }) {
  const pdfUrl = `${API_ORIGIN}/api/v1/invoices/${artifact.invoiceId}/pdf`

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ArtifactPanelHeader icon={FileTextIcon} title={artifact.invoiceNumber}>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Open in new tab"
          aria-label="Open PDF in new tab"
          onClick={() => openDownload(`${pdfUrl}?inline=1`)}
        >
          <ExternalLinkIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Download PDF"
          aria-label="Download PDF"
          onClick={() => openDownload(pdfUrl)}
        >
          <DownloadIcon className="size-4" />
        </Button>
      </ArtifactPanelHeader>
      <iframe
        key={artifact.invoiceId}
        title={`Invoice ${artifact.invoiceNumber}`}
        src={`${pdfUrl}?inline=1`}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  )
}

function ProductArtifactPanel({ artifact }: { artifact: ProductArtifact }) {
  const { product } = artifact
  const productUrl = `/products?search=${encodeURIComponent(product.code || product.description || product.brand || String(product.id))}`
  const summary = [
    product.description,
    product.code ? `Code: ${product.code}` : null,
    product.price == null ? null : `Price: ${formatMoney(product.price)}`,
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ArtifactPanelHeader
        icon={BoxIcon}
        title={product.description || product.code || "Product"}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Copy Summary"
          aria-label="Copy product summary"
          onClick={() => copyText(summary)}
        >
          <CopyIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Open Product"
          aria-label="Open product"
          asChild
        >
          <a href={productUrl}>
            <ExternalLinkIcon className="size-4" />
          </a>
        </Button>
      </ArtifactPanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-5 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Product
              </p>
              <h3 className="mt-1 text-base leading-6 font-semibold">
                {product.description || "Untitled product"}
              </h3>
            </div>
            {product.isTopSeller ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Top Seller
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {product.brand || "No brand specified"}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PanelValue icon={HashIcon} label="Code" value={product.code} />
          <PanelValue
            icon={IndianRupeeIcon}
            label="Unit Price"
            value={
              product.price == null
                ? "Price pending"
                : formatMoney(product.price)
            }
          />
          <PanelValue icon={TagIcon} label={`${product.tax?.label ?? "Tax"} Code`} value={product.tax?.code ?? product.hsnCode} />
          <PanelValue
            icon={TagIcon}
            label={`${product.tax?.label ?? "Tax"} Rate`}
            value={(product.tax?.rate ?? product.gstRate) == null ? "-" : `${product.tax?.rate ?? product.gstRate}%`}
          />
          {(product.defaultAdjustments ?? []).map((adjustment) => (
            <PanelValue
              key={adjustment.id}
              icon={IndianRupeeIcon}
              label={adjustment.label}
              value={formatMoney(adjustment.value)}
            />
          ))}
          <PanelValue
            icon={ExternalLinkIcon}
            label="Product Link"
            value={
              product.link ? (
                <a
                  className="break-all text-primary underline-offset-4 hover:underline"
                  href={product.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {product.link}
                </a>
              ) : (
                "-"
              )
            }
          />
        </div>
      </div>
    </div>
  )
}

function CustomerArtifactPanel({ artifact }: { artifact: CustomerArtifact }) {
  const { customer } = artifact
  const customerUrl = `/customers/${customer.id}`
  const summary = [
    customer.name,
    customer.company,
    customer.email,
    customer.contactNumber,
    customer.address,
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ArtifactPanelHeader
        icon={Building2Icon}
        title={customer.name || customer.company || "Customer"}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Copy Summary"
          aria-label="Copy customer summary"
          onClick={() => copyText(summary)}
        >
          <CopyIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Open Customer"
          aria-label="Open customer"
          asChild
        >
          <a href={customerUrl}>
            <ExternalLinkIcon className="size-4" />
          </a>
        </Button>
      </ArtifactPanelHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-5 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Customer
          </p>
          <h3 className="mt-1 text-base leading-6 font-semibold">
            {customer.name || "Unnamed customer"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {customer.company || "No company specified"}
          </p>
        </div>
        <div className="grid gap-3">
          <PanelValue
            icon={MailIcon}
            label="Email"
            value={
              customer.email ? (
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={`mailto:${customer.email}`}
                >
                  {customer.email}
                </a>
              ) : (
                "-"
              )
            }
          />
          <PanelValue
            icon={PhoneIcon}
            label="Contact Number"
            value={customer.contactNumber || "-"}
          />
          <PanelValue
            icon={Building2Icon}
            label="Address"
            value={
              <span className="whitespace-pre-wrap">
                {customer.address || "-"}
              </span>
            }
          />
        </div>
      </div>
    </div>
  )
}

function ChatArtifactPanel({ artifact }: { artifact: ChatArtifact }) {
  if (artifact.type === "invoice")
    return <InvoiceArtifactPanel artifact={artifact} />
  if (artifact.type === "product")
    return <ProductArtifactPanel artifact={artifact} />
  return <CustomerArtifactPanel artifact={artifact} />
}

function ChatContent() {
  const artifact = useChatArtifact((state) => state.artifact)

  if (!artifact) return <Thread />

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel
        id="chat-thread"
        defaultSize="55%"
        minSize="30%"
        className="flex min-h-0 flex-col"
      >
        <Thread />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="chat-artifact"
        defaultSize="45%"
        minSize="25%"
        maxSize="65%"
        className="flex min-h-0 flex-col"
      >
        <ChatArtifactPanel artifact={artifact} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatRuntimeProvider>
        <InvoiceToolUIs />
        <WorkspaceToolUIs />
        <KnowledgeToolUIs />
        <SiteHeader actions={<ChatHeaderActions />} />
        <ChatContent />
      </ChatRuntimeProvider>
    </AppLayout>
  )
}
