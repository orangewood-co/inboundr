import { makeAssistantToolUI } from "@assistant-ui/react"
import { FileTextIcon, LibraryIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"

type KnowledgeMatch = {
  fileName: string
  nodeId: string
  score: number
  snippet: string
}

type SearchKnowledgeBaseResult = {
  query: string
  matchCount: number
  matches: KnowledgeMatch[]
}

function ToolPendingCard({ label }: { label: string }) {
  return (
    <div className="flex w-full max-w-md items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <Spinner className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}

function SearchKnowledgeBaseResults({
  result,
}: {
  result: SearchKnowledgeBaseResult
}) {
  if (result.matches.length === 0) {
    return (
      <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
        <LibraryIcon className="size-4 shrink-0" />
        No matching documents in your chat context.
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <LibraryIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Document Sources</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tabular-nums">
          {result.matches.length}
        </span>
      </div>
      <ul className="divide-y">
        {result.matches.map((match, index) => (
          <li key={`${match.nodeId}-${index}`} className="px-3 py-3">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium" title={match.fileName}>
                {match.fileName}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {Math.round(match.score * 100)}%
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">
              {match.snippet}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SearchKnowledgeBaseToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  SearchKnowledgeBaseResult
>({
  toolName: "searchKnowledgeBase",
  render: ({ result, status }) => {
    if (status.type === "running")
      return <ToolPendingCard label="Searching your documents..." />
    if (!result) return null
    return <SearchKnowledgeBaseResults result={result} />
  },
})

export function KnowledgeToolUIs() {
  return <SearchKnowledgeBaseToolUI />
}
