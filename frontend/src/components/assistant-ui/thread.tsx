import { useRef } from "react"
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useComposerRuntime,
} from "@assistant-ui/react"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FilePlus2Icon,
  FileTextIcon,
  MicIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Share2Icon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
} from "lucide-react"

import { MarkdownText } from "@/components/assistant-ui/markdown-text"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function Thread({ className }: { className?: string }) {
  return (
    <ThreadPrimitive.Root
      className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}
    >
      <AuiIf condition={(state) => state.thread.isEmpty}>
        <EmptyState />
      </AuiIf>

      <AuiIf condition={(state) => !state.thread.isEmpty}>
        <ThreadPrimitive.Viewport
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          autoScroll
        >
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
            <ThreadPrimitive.Messages>
              {({ message }) => {
                if (message.composer.isEditing) return <UserEditComposer />
                if (message.role === "user") return <UserMessage />
                return <AssistantMessage />
              }}
            </ThreadPrimitive.Messages>
            <div className="min-h-4 grow" />
          </div>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 bg-background">
            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              <Composer />
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Inboundr can make mistakes. Check important info.
              </p>
            </div>
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </AuiIf>
    </ThreadPrimitive.Root>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Where should we begin?
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          Ask anything about your workspace, or start a conversation.
        </p>
      </div>
      <div className="w-full">
        <Composer />
      </div>
    </div>
  )
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex flex-col gap-1 rounded-2xl border border-input bg-card p-2 shadow-sm">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Ask anything"
        className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <ComposerPrimitive.AddAttachment asChild>
            <button
              type="button"
              aria-label="Add attachment"
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon className="size-5" />
            </button>
          </ComposerPrimitive.AddAttachment>
          <ToolsMenu />
        </div>
        <PrimaryAction />
      </div>
    </ComposerPrimitive.Root>
  )
}

const TOOLS = [
  {
    icon: SearchIcon,
    label: "Search Products",
    prompt: "Search the product catalog for ",
  },
  {
    icon: PackagePlusIcon,
    label: "Add Product",
    prompt:
      "Add a new product with brand, product code, description, unit price, GST rate, and HSN code: ",
  },
  {
    icon: Building2Icon,
    label: "Find Customer",
    prompt: "Find the customer named ",
  },
  {
    icon: FilePlus2Icon,
    label: "Create Invoice",
    prompt: "Create a draft invoice for ",
  },
  {
    icon: FileTextIcon,
    label: "Find Invoice",
    prompt: "Find invoices for ",
  },
]

function ToolsMenu() {
  const composer = useComposerRuntime()
  const triggerRef = useRef<HTMLButtonElement>(null)

  function applyPrompt(prompt: string) {
    composer.setText(prompt)
    requestAnimationFrame(() => {
      const textarea = triggerRef.current
        ?.closest("form")
        ?.querySelector<HTMLTextAreaElement>('textarea[name="input"]')
      if (!textarea) return
      textarea.focus({ preventScroll: true })
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
        >
          <span>Tools</span>
          <ChevronDownIcon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {TOOLS.map((tool) => (
          <DropdownMenuItem
            key={tool.label}
            className="gap-2.5"
            onSelect={() => applyPrompt(tool.prompt)}
          >
            <tool.icon className="size-4 text-muted-foreground" />
            {tool.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PrimaryAction() {
  return (
    <>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <button
            type="button"
            aria-label="Stop response"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <SquareIcon className="size-4 fill-current" />
          </button>
        </ComposerPrimitive.Cancel>
      </AuiIf>

      <AuiIf
        condition={(state) =>
          !state.thread.isRunning && !state.composer.isEmpty
        }
      >
        <ComposerPrimitive.Send asChild>
          <button
            type="submit"
            aria-label="Send message"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowUpIcon className="size-5" />
          </button>
        </ComposerPrimitive.Send>
      </AuiIf>

      <AuiIf
        condition={(state) => !state.thread.isRunning && state.composer.isEmpty}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Dictate"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MicIcon className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Voice mode"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <AudioLinesIcon className="size-5" />
          </button>
        </div>
      </AuiIf>
    </>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="group/message flex flex-col items-end gap-1">
      <div className="max-w-[80%] rounded-3xl bg-muted px-4 py-2.5 text-sm text-foreground">
        <MessagePrimitive.Parts>
          {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
        </MessagePrimitive.Parts>
      </div>
      <div className="flex items-center gap-1 pr-1 text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
        <BranchPicker />
        <ActionBarPrimitive.Root hideWhenRunning>
          <CopyButton />
          <ActionBarPrimitive.Edit asChild>
            <ActionButton label="Edit message">
              <PencilIcon className="size-4" />
            </ActionButton>
          </ActionBarPrimitive.Edit>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  )
}

function UserEditComposer() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="w-full max-w-xl">
        <ComposerPrimitive.Root className="rounded-3xl bg-muted p-3">
          <ComposerPrimitive.Input
            rows={3}
            autoFocus
            className="max-h-48 min-h-20 w-full resize-none bg-transparent px-1 py-1 text-sm text-foreground outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <ComposerPrimitive.Cancel asChild>
              <button
                type="button"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                Cancel
              </button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Send
              </button>
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group/message flex w-full flex-col gap-1">
      <div className="max-w-none text-sm leading-7 text-foreground">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") return <MarkdownText />
            if (part.type === "tool-call") return part.toolUI ?? null
            return null
          }}
        </MessagePrimitive.Parts>
        <AuiIf
          condition={(s) =>
            s.message.status?.type === "running" && s.message.parts.length === 0
          }
        >
          <LoadingIndicator />
        </AuiIf>
      </div>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <ActionBarPrimitive.Root hideWhenRunning>
          <CopyButton />
        </ActionBarPrimitive.Root>
        <DecorativeButton label="Good response">
          <ThumbsUpIcon className="size-4" />
        </DecorativeButton>
        <DecorativeButton label="Bad response">
          <ThumbsDownIcon className="size-4" />
        </DecorativeButton>
        <DecorativeButton label="Read aloud">
          <Volume2Icon className="size-4" />
        </DecorativeButton>
        <DecorativeButton label="Share">
          <Share2Icon className="size-4" />
        </DecorativeButton>
        <ActionBarPrimitive.Root hideWhenRunning>
          <ActionBarPrimitive.Reload asChild>
            <ActionButton label="Regenerate response">
              <RefreshCwIcon className="size-4" />
            </ActionButton>
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
        <MoreMenu />
        <BranchPicker />
      </div>
    </MessagePrimitive.Root>
  )
}

function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton label="More actions">
          <MoreHorizontalIcon className="size-4" />
        </ActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem className="gap-2.5">
          <PencilIcon className="size-4 text-muted-foreground" />
          Edit in canvas
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5">
          <Share2Icon className="size-4 text-muted-foreground" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActionButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-current transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function DecorativeButton({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <ActionButton label={label} className="hidden sm:flex">
      {children}
    </ActionButton>
  )
}

function LoadingIndicator() {
  return (
    <div
      className="flex items-center py-1"
      role="status"
      aria-label="Generating response"
    >
      <span className="size-3 animate-pulse rounded-full bg-foreground" />
    </div>
  )
}

function CopyButton() {
  return (
    <ActionBarPrimitive.Copy asChild>
      <ActionButton label="Copy" className="group/copy">
        <CopyIcon className="size-4 group-data-[copied]/copy:hidden" />
        <CheckIcon className="hidden size-4 group-data-[copied]/copy:block" />
      </ActionButton>
    </ActionBarPrimitive.Copy>
  )
}

function BranchPicker() {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="flex items-center gap-0.5 text-xs text-current"
    >
      <BranchPickerPrimitive.Previous asChild>
        <ActionButton label="Previous branch" className="size-7">
          <span className="text-base leading-none">‹</span>
        </ActionButton>
      </BranchPickerPrimitive.Previous>
      <span className="tabular-nums">
        <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <ActionButton label="Next branch" className="size-7">
          <span className="text-base leading-none">›</span>
        </ActionButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
