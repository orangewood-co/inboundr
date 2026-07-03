import { useEffect, useState } from "react"
import { CheckCircle2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { ResolutionReason } from "./types"

export function ResolveDialog({
  open,
  onOpenChange,
  reasons,
  onResolve,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reasons: ResolutionReason[]
  onResolve: (reasonId: string, note: string) => void
}) {
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setReasonId(null)
      setNote("")
    }
  }, [open])

  function handleResolve() {
    if (!reasonId) return
    onResolve(reasonId, note)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Conversation</DialogTitle>
          <DialogDescription>
            Pick a reason for resolving this conversation. The customer is notified by email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-label="Resolution reason"
            className="flex flex-col gap-1.5"
          >
            {reasons.map((reason) => {
              const selected = reason.id === reasonId
              return (
                <button
                  key={reason.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReasonId(reason.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/[0.06] font-medium"
                      : "hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {selected && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {reason.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolutionNote">Note (optional)</Label>
            <textarea
              id="resolutionNote"
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add context about how this was resolved..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleResolve} disabled={!reasonId} className="gap-1.5">
            <CheckCircle2Icon />
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
