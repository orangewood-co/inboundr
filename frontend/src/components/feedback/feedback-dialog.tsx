import { useMemo, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { SendIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  FEEDBACK_MODULE_OPTIONS,
  FEEDBACK_TYPE_OPTIONS,
  getModuleFromPath,
  submitFeedback,
  type FeedbackModule,
  type FeedbackType,
} from "@/lib/feedback"

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const detectedModule = useMemo(() => getModuleFromPath(pathname), [pathname])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <FeedbackDialogForm
          key={detectedModule}
          detectedModule={detectedModule}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  )
}

function FeedbackDialogForm({
  detectedModule,
  onOpenChange,
}: {
  detectedModule: FeedbackModule
  onOpenChange: (open: boolean) => void
}) {
  const [type, setType] = useState<FeedbackType>("feedback")
  const [module, setModule] = useState<FeedbackModule>(detectedModule)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    try {
      await submitFeedback({ type, module, message: message.trim() })
      toast.success("Thanks! Your feedback has been sent.")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send feedback")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Send Feedback</DialogTitle>
        <DialogDescription>
          Share feedback, request a feature, or report a bug. We read every
          submission and will reply to you here.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as FeedbackType)}>
              <SelectTrigger id="feedback-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-module">Module</Label>
            <Select value={module} onValueChange={(value) => setModule(value as FeedbackModule)}>
              <SelectTrigger id="feedback-module">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_MODULE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="feedback-message">Message</Label>
          <textarea
            id="feedback-message"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            placeholder="Tell us what's on your mind..."
            maxLength={5000}
            required
          />
        </div>
        <Button className="w-full" type="submit" disabled={submitting || !message.trim()}>
          {submitting ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-2 size-4" />}
          Send Feedback
        </Button>
      </form>
    </DialogContent>
  )
}
