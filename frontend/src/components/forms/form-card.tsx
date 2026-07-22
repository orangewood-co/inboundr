import { useMemo } from "react"
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  FolderIcon,
  LinkIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/forms/sparkline"
import {
  bucketRecentSubmissions,
  type FormFolder,
  type ManagedForm,
} from "@/components/forms/types"

export function FormCard({
  form,
  folders = [],
  folderName,
  onOpen,
  onCopyLink,
  onDuplicate,
  onArchive,
  onMoveToFolder,
}: {
  form: ManagedForm
  folders?: FormFolder[]
  folderName?: string | null
  onOpen: () => void
  onCopyLink: () => void
  onDuplicate: () => void
  onArchive: () => void
  onMoveToFolder?: (folderId: string | null) => void
}) {
  const buckets = useMemo(
    () => bucketRecentSubmissions(form.recentSubmissionDates),
    [form.recentSubmissionDates],
  )
  const recentCount = useMemo(() => buckets.reduce((sum, n) => sum + n, 0), [buckets])
  const isPublished = form.status === "published"
  const newCount = form.newSubmissionCount ?? 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault()
          onOpen()
        }
      }}
      className="group flex cursor-pointer flex-col rounded-xl border bg-card p-5 text-left shadow-xs outline-none transition-all hover:border-muted-foreground/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {/* Status + actions */}
      <div className="flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
              isPublished ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isPublished ? "bg-success" : "bg-muted-foreground/50",
              )}
            />
            {isPublished ? "Live" : "Draft"}
          </span>
          {folderName && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <FolderIcon className="size-3 shrink-0" />
              <span className="truncate">{folderName}</span>
            </span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              <EllipsisIcon className="size-4" />
              <span className="sr-only">Form actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onClick={onOpen}>
              <PencilIcon className="size-4" />
              Open
            </DropdownMenuItem>
            {isPublished && (
              <DropdownMenuItem onClick={onCopyLink}>
                <LinkIcon className="size-4" />
                Copy Link
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <CopyIcon className="size-4" />
              Duplicate
            </DropdownMenuItem>
            {onMoveToFolder && folders.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderIcon className="size-4" />
                  Move to Folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                    {!form.folderId && <CheckIcon className="size-4" />}
                    Unfiled
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder._id}
                      onClick={() => onMoveToFolder(folder._id)}
                    >
                      {form.folderId === folder._id && <CheckIcon className="size-4" />}
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onArchive}>
              <Trash2Icon className="size-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title + description */}
      <p className="mt-2 truncate font-semibold">{form.title || "Untitled"}</p>
      <p className="mt-0.5 line-clamp-2 min-h-8 text-[13px] leading-4 text-muted-foreground">
        {form.description || "No description"}
      </p>

      {/* Activity */}
      <div className="mt-4 flex items-end justify-between gap-4">
        {form.submissionCount > 0 ? (
          <Sparkline
            data={buckets}
            className={cn("h-9 min-w-0 flex-1", recentCount === 0 && "text-muted-foreground/40")}
          />
        ) : (
          <p className="flex h-9 flex-1 items-end pb-0.5 text-xs text-muted-foreground/50">
            No responses yet
          </p>
        )}
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold leading-none tabular-nums tracking-tight">
            {form.submissionCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            response{form.submissionCount !== 1 && "s"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        {newCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {newCount} new
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/60">
            {form.submissionCount > 0 ? "All reviewed" : "—"}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] text-muted-foreground">
              {form.lastSubmissionAt
                ? `Last response ${formatRelativeTime(form.lastSubmissionAt)}`
                : `Updated ${formatRelativeTime(form.updatedAt)}`}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {formatDateTime(form.lastSubmissionAt ?? form.updatedAt)}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
