import { useMemo, type PropsWithChildren } from "react"
import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react"
import { createAssistantStream } from "assistant-stream"

import { API_ORIGIN } from "@/lib/env"

const CHAT_API = `${API_ORIGIN}/api/v1/chat`

type ChatThreadDto = {
  id: string
  title?: string
  status: "regular" | "archived"
  createdAt: string
  updatedAt: string
}

type ChatMessageRow = {
  id: string
  parent_id: string | null
  format: string
  content: Record<string, unknown>
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${CHAT_API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Chat API request failed: ${response.status}`)
  }

  return response
}

export const chatApiUrl = CHAT_API

export const chatThreadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const rows = (await apiFetch("/threads").then((response) => response.json())) as ChatThreadDto[]
    return {
      threads: rows.map((thread) => ({
        remoteId: thread.id,
        status: thread.status,
        title: thread.title,
        custom: {
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        },
      })),
    }
  },
  async initialize() {
    const { id } = (await apiFetch("/threads", { method: "POST" }).then((response) => response.json())) as {
      id: string
    }
    return { remoteId: id }
  },
  async rename(remoteId, title) {
    await apiFetch(`/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    })
  },
  async archive(remoteId) {
    await apiFetch(`/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    })
  },
  async unarchive(remoteId) {
    await apiFetch(`/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "regular" }),
    })
  },
  async delete(remoteId) {
    await apiFetch(`/threads/${remoteId}`, { method: "DELETE" })
  },
  async fetch(remoteId) {
    const thread = (await apiFetch(`/threads/${remoteId}`).then((response) => response.json())) as ChatThreadDto
    return {
      remoteId: thread.id,
      status: thread.status,
      title: thread.title,
      custom: {
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    }
  },
  async generateTitle(remoteId, messages) {
    return createAssistantStream(async (controller) => {
      const { title } = (await apiFetch(`/threads/${remoteId}/title`, {
        method: "POST",
        body: JSON.stringify({ messages }),
      }).then((response) => response.json())) as { title: string }
      controller.appendText(title)
    })
  },
  unstable_Provider({ children }: PropsWithChildren) {
    const aui = useAui()
    const history = useMemo<ThreadHistoryAdapter>(
      () => ({
        async load() {
          return { messages: [] }
        },
        async append() {},
        withFormat: (format) => ({
          async load() {
            const { remoteId } = aui.threadListItem().getState()
            if (!remoteId) return { messages: [] }

            const rows = (await apiFetch(`/threads/${remoteId}/messages`).then((response) =>
              response.json()
            )) as ChatMessageRow[]

            return {
              messages: rows.map((row) =>
                format.decode({
                  id: row.id,
                  parent_id: row.parent_id,
                  format: row.format,
                  content: row.content,
                })
              ),
            }
          },
          async append(item) {
            const { remoteId } = await aui.threadListItem().initialize()
            await apiFetch(`/threads/${remoteId}/messages`, {
              method: "POST",
              body: JSON.stringify({
                id: format.getId(item.message),
                parent_id: item.parentId,
                format: format.format,
                content: format.encode(item),
              }),
            })
          },
        }),
      }),
      [aui]
    )

    return <RuntimeAdapterProvider adapters={{ history }}>{children}</RuntimeAdapterProvider>
  },
}
