import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { copyToClipboard } from "@/lib/utils"

export function CopyButton({
  value,
  label,
  className = "",
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 ${className}`}
      onClick={(e) => {
        e.stopPropagation()
        copyToClipboard(value, label)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <CheckIcon className="size-3 text-success" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  )
}

export function CopyableText({
  value,
  label,
  children,
  className = "",
}: {
  value: string
  label?: string
  children: React.ReactNode
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  return (
    <span className={`group/copy inline-flex items-center gap-1 ${className}`}>
      {children}
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-muted-foreground/40 opacity-0 transition-all hover:text-foreground group-hover/copy:opacity-100 focus-visible:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(value, label)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? (
          <CheckIcon className="size-3 text-success" />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </button>
    </span>
  )
}
