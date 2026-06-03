import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react"
import { MessageSquarePlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ChatHeaderActions() {
  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <MessageSquarePlusIcon className="size-4" />
            <span className="hidden sm:inline">Chats</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-1.5">
          <ThreadList />
        </DropdownMenuContent>
      </DropdownMenu>

      <ThreadListPrimitive.New asChild>
        <Button type="button" size="sm" className="gap-2">
          <MessageSquarePlusIcon className="size-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </ThreadListPrimitive.New>
    </div>
  )
}

export function ThreadList({ className }: { className?: string }) {
  return (
    <ThreadListPrimitive.Root className={cn("flex flex-col gap-1", className)}>
      <ThreadListPrimitive.New asChild>
        <Button type="button" variant="ghost" className="justify-start gap-2">
          <MessageSquarePlusIcon className="size-4" />
          New Chat
        </Button>
      </ThreadListPrimitive.New>

      <div className="max-h-72 min-h-0 flex-1 overflow-y-auto">
        <ThreadListPrimitive.Items>
          {() => <ThreadListItem />}
        </ThreadListPrimitive.Items>
      </div>
    </ThreadListPrimitive.Root>
  )
}

function ThreadListItem() {
  return (
    <ThreadListItemPrimitive.Root className="group flex items-center gap-1 rounded-lg data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger asChild>
        <button
          type="button"
          className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <ThreadListItemPrimitive.Title fallback="New Chat" />
        </button>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Delete asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Delete chat"
          className="mr-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2Icon className="size-3" />
        </Button>
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  )
}
