import { useEffect, useRef, useState } from "react"
import { FileText, RotateCcw } from "lucide-react"
import { useOs } from "../context"

const TRASHED = [
  {
    name: "cold-outreach-strategy.docx",
    meta: "deleted the day we started",
    peek: "Step 1: Buy a list of 10,000 emails. Step 2: 'Hope this finds you well'…",
    restorable: true,
  },
  {
    name: "follow-up-reminder-post-its.zip",
    meta: "replaced by Follow-ups",
    peek: "47 photos of sticky notes that said 'call Steve back'.",
    restorable: false,
  },
  {
    name: "hold-music.mp3",
    meta: "replaced by Calls",
    peek: "Eight minutes of smooth jazz nobody should ever hear again.",
    restorable: false,
  },
]

export default function TrashApp() {
  const { notify } = useOs()
  const [peeking, setPeeking] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const restoreColdOutreach = () => {
    if (restoring) return
    setRestoring(true)
    notify("Restoring cold outreach…", "cold-outreach-strategy.docx (1 of 1)")
    timers.current.push(
      window.setTimeout(() => {
        notify("On second thought, no.", "The file stays deleted. It's for your own good.")
        setRestoring(false)
      }, 2600),
    )
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {TRASHED.map((file) => (
          <div key={file.name} className="border-b border-border">
            <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-surface">
              <button
                type="button"
                onClick={() => setPeeking(peeking === file.name ? null : file.name)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <FileText className="size-4 shrink-0 text-text-dim" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-muted line-through decoration-text-dim">
                  {file.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-text-dim">{file.meta}</span>
              </button>
              {file.restorable && (
                <button
                  type="button"
                  onClick={restoreColdOutreach}
                  disabled={restoring}
                  title="Restore this file"
                  className={`flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] transition-colors duration-150 ${
                    restoring
                      ? "text-text-dim"
                      : "text-text-muted hover:bg-white/[0.08] hover:text-text"
                  }`}
                >
                  <RotateCcw className={`size-3 ${restoring ? "animate-spin" : ""}`} />
                  {restoring ? "restoring…" : "restore"}
                </button>
              )}
            </div>
            {peeking === file.name && (
              <p className="border-t border-border bg-surface px-4 py-3 text-[13px] leading-relaxed text-text-muted">
                {file.peek}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border px-4">
        <span className="font-mono text-[11px] text-text-dim">{TRASHED.length} items · not coming back</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-dim">
          <RotateCcw className="size-3" /> restore is mostly disabled on purpose
        </span>
      </div>
    </div>
  )
}
