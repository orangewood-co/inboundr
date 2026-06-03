import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react"
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk"

import { Thread } from "@/components/assistant-ui/thread"
import { ChatHeaderActions } from "@/components/assistant-ui/thread-list"
import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { chatApiUrl, chatThreadListAdapter } from "@/lib/chat-api"

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

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatRuntimeProvider>
        <SiteHeader actions={<ChatHeaderActions />} />
        <Thread />
      </ChatRuntimeProvider>
    </AppLayout>
  )
}
