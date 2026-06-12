import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react"
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk"
import { DownloadIcon, ExternalLinkIcon, FileTextIcon, XIcon } from "lucide-react"

import { InvoiceToolUIs } from "@/components/assistant-ui/invoice-tool-ui"
import { Thread } from "@/components/assistant-ui/thread"
import { ChatHeaderActions } from "@/components/assistant-ui/thread-list"
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
import { useInvoiceArtifact, type InvoiceArtifact } from "@/lib/invoice-artifact"

function ChatRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    adapter: chatThreadListAdapter,
    runtimeHook: () =>
      useChatRuntime({
        transport: new AssistantChatTransport({
          api: chatApiUrl,
          credentials: "include",
        }),
      }),
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}

function InvoiceArtifactPanel({ artifact }: { artifact: InvoiceArtifact }) {
  const close = useInvoiceArtifact((state) => state.close)
  const pdfUrl = `${API_ORIGIN}/api/v1/invoices/${artifact.invoiceId}/pdf`

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">{artifact.invoiceNumber}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Close"
            aria-label="Close invoice preview"
            onClick={close}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <iframe
        key={artifact.invoiceId}
        title={`Invoice ${artifact.invoiceNumber}`}
        src={`${pdfUrl}?inline=1`}
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  )
}

function ChatContent() {
  const artifact = useInvoiceArtifact((state) => state.artifact)

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
        id="invoice-artifact"
        defaultSize="45%"
        minSize="25%"
        maxSize="65%"
        className="flex min-h-0 flex-col"
      >
        <InvoiceArtifactPanel artifact={artifact} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatRuntimeProvider>
        <InvoiceToolUIs />
        <SiteHeader actions={<ChatHeaderActions />} />
        <ChatContent />
      </ChatRuntimeProvider>
    </AppLayout>
  )
}
