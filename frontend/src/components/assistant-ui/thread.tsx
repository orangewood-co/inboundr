import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GlobeIcon,
  ImageIcon,
  LightbulbIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  SquareIcon,
  TelescopeIcon,
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
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-white dark:bg-[#212121]",
        className,
      )}
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

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 bg-white dark:bg-[#212121]">
            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              <Composer />
              <p className="pt-2 text-center text-xs text-[#5d5d5d] dark:text-[#a8a8a8]">
                ChatGPT can make mistakes. Check important info.
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
      <h1 className="text-center text-2xl font-semibold tracking-tight text-[#0d0d0d] sm:text-3xl dark:text-[#ececec]">
        Where should we begin?
      </h1>
      <div className="w-full">
        <Composer />
      </div>
    </div>
  )
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="flex flex-col gap-1 rounded-[28px] border border-[#e5e5e5] bg-white p-2 shadow-sm dark:border-transparent dark:bg-[#303030]">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Ask anything"
        className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] text-[#0d0d0d] outline-none placeholder:text-[#8e8e8e] dark:text-[#ececec] dark:placeholder:text-[#9b9b9b]"
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1">
          <ComposerPrimitive.AddAttachment asChild>
            <button
              type="button"
              aria-label="Add attachment"
              className="flex size-9 items-center justify-center rounded-full text-[#5d5d5d] transition-colors hover:bg-[#0d0d0d]/5 dark:text-[#c5c5c5] dark:hover:bg-white/10"
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
  { icon: GlobeIcon, label: "Search the web" },
  { icon: ImageIcon, label: "Create an image" },
  { icon: TelescopeIcon, label: "Run deep research" },
  { icon: LightbulbIcon, label: "Think longer" },
  { icon: SparklesIcon, label: "Study and learn" },
]

function ToolsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm text-[#5d5d5d] transition-colors hover:bg-[#0d0d0d]/5 sm:flex dark:text-[#c5c5c5] dark:hover:bg-white/10"
        >
          <span>Tools</span>
          <ChevronDownIcon className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {TOOLS.map((tool) => (
          <DropdownMenuItem key={tool.label} className="gap-2.5">
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
            className="flex size-9 items-center justify-center rounded-full bg-[#0d0d0d] text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-[#0d0d0d]"
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
            className="flex size-9 items-center justify-center rounded-full bg-[#0d0d0d] text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-[#0d0d0d]"
          >
            <ArrowUpIcon className="size-5" />
          </button>
        </ComposerPrimitive.Send>
      </AuiIf>

      <AuiIf
        condition={(state) =>
          !state.thread.isRunning && state.composer.isEmpty
        }
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Dictate"
            className="flex size-9 items-center justify-center rounded-full text-[#5d5d5d] transition-colors hover:bg-[#0d0d0d]/5 dark:text-[#c5c5c5] dark:hover:bg-white/10"
          >
            <MicIcon className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Voice mode"
            className="flex size-9 items-center justify-center rounded-full bg-[#ff5d1f] text-white transition-opacity hover:opacity-90"
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
      <div className="max-w-[80%] rounded-3xl bg-[#f4f4f4] px-4 py-2.5 text-[15px] text-[#0d0d0d] dark:bg-[#303030] dark:text-[#ececec]">
        <MessagePrimitive.Parts>
          {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
        </MessagePrimitive.Parts>
      </div>
      <div className="flex items-center gap-1 pr-1 text-[#5d5d5d] opacity-0 transition-opacity group-hover/message:opacity-100 dark:text-[#a8a8a8]">
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
        <ComposerPrimitive.Root className="rounded-3xl bg-[#f4f4f4] p-3 dark:bg-[#303030]">
          <ComposerPrimitive.Input
            rows={3}
            autoFocus
            className="max-h-48 min-h-20 w-full resize-none bg-transparent px-1 py-1 text-[15px] text-[#0d0d0d] outline-none dark:text-[#ececec]"
          />
          <div className="mt-2 flex justify-end gap-2">
            <ComposerPrimitive.Cancel asChild>
              <button
                type="button"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-black/5 dark:text-[#ececec] dark:hover:bg-white/10"
              >
                Cancel
              </button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                className="rounded-full bg-[#0d0d0d] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-[#0d0d0d]"
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
      <div className="max-w-none text-[15px] leading-7 text-[#0d0d0d] dark:text-[#ececec]">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") return <MarkdownText />
            if (part.type === "tool-call") return part.toolUI ?? null
            return null
          }}
        </MessagePrimitive.Parts>
      </div>
      <div className="flex items-center gap-0.5 text-[#5d5d5d] dark:text-[#a8a8a8]">
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
        "flex size-8 items-center justify-center rounded-lg text-current transition-colors hover:bg-foreground/5 dark:hover:bg-white/10",
        className,
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
