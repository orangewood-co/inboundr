import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  BotIcon,
  PhoneIcon,
  PhoneIncomingIcon,
  RefreshCwIcon,
  Settings2Icon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { ListSkeleton } from "@/components/list-states"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

import { API_ORIGIN } from "@/lib/env"
import { formatDateTime } from "@/lib/format"

const API_BASE = `${API_ORIGIN}/api/v1/calls`

type TranscriptEntry = {
  role: "user" | "assistant"
  text: string
  at: string
}

type CallExtraction = {
  callerName: string
  company: string
  email: string
  inquiry: string
  followUpRequired: boolean
} | null

type CallSummary = {
  _id: string
  callerNumber: string
  dialedNumber: string
  status: "in_progress" | "completed" | "failed"
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  summary: string
  extraction: CallExtraction
  hasRecording: boolean
  customerId: string | null
}

type CallDetail = CallSummary & { transcript: TranscriptEntry[] }

function formatDuration(seconds: number | null) {
  if (seconds == null) return "-"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function callerLabel(call: CallSummary) {
  return call.extraction?.callerName || call.callerNumber || "Unknown caller"
}

function statusBadge(status: CallSummary["status"]) {
  if (status === "in_progress") return <Badge>In progress</Badge>
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  return null
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}?limit=50`, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to fetch calls")
      const data = (await response.json()) as { calls: CallSummary[] }
      setCalls(data.calls)
    } catch {
      toast.error("Failed to load calls")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCalls()
  }, [fetchCalls])

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Calls" }]} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <PageHeader
            title="Calls"
            description="Inbound calls answered by your AI voice agent."
            actions={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void fetchCalls()}>
                  <RefreshCwIcon className="size-4" />
                  Refresh
                </Button>
                <Button asChild>
                  <Link to="/calls/settings">
                    <Settings2Icon className="size-4" />
                    Agent Settings
                  </Link>
                </Button>
              </div>
            }
          />

          {loading ? (
            <ListSkeleton rows={6} columns={3} className="mt-6 rounded-2xl border" />
          ) : calls.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed p-14 text-center">
              <PhoneIncomingIcon className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-4 text-lg font-semibold">No Calls Yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Once your phone number is live, every call your AI agent answers will appear here with a transcript and summary.
              </p>
              <Button className="mt-5" variant="outline" asChild>
                <Link to="/calls/settings">
                  <Settings2Icon className="size-4" />
                  Set Up the Agent
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-5 divide-y rounded-xl border bg-card">
              {calls.map((call) => (
                <div
                  key={call._id}
                  className="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-muted/40"
                  onClick={() => setSelectedCallId(call._id)}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                    <PhoneIncomingIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{callerLabel(call)}</p>
                      {statusBadge(call.status)}
                      {call.extraction?.followUpRequired && (
                        <Badge variant="secondary">Follow up</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {call.summary || call.extraction?.inquiry || call.callerNumber}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm text-muted-foreground">{formatDuration(call.durationSeconds)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(call.startedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <CallDetailSheet callId={selectedCallId} onClose={() => setSelectedCallId(null)} />
    </AppLayout>
  )
}

function CallDetailSheet({ callId, onClose }: { callId: string | null; onClose: () => void }) {
  const [call, setCall] = useState<CallDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!callId) {
      setCall(null)
      setRecordingUrl(null)
      return
    }

    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/${callId}`, { credentials: "include" })
        if (!response.ok) throw new Error("Failed to fetch call")
        const data = (await response.json()) as { call: CallDetail }
        if (cancelled) return
        setCall(data.call)

        if (data.call.hasRecording) {
          const recordingResponse = await fetch(`${API_BASE}/${callId}/recording`, { credentials: "include" })
          if (recordingResponse.ok && !cancelled) {
            const recording = (await recordingResponse.json()) as { url: string }
            setRecordingUrl(recording.url)
          }
        }
      } catch {
        if (!cancelled) toast.error("Failed to load call details")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [callId])

  return (
    <Sheet open={Boolean(callId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{call ? callerLabel(call) : "Call Details"}</SheetTitle>
          <SheetDescription>
            {call ? `${call.callerNumber || "Unknown number"} · ${formatDateTime(call.startedAt)} · ${formatDuration(call.durationSeconds)}` : "Loading call details"}
          </SheetDescription>
        </SheetHeader>

        {loading || !call ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            {recordingUrl && (
              <div>
                <h3 className="text-sm font-semibold">Recording</h3>
                <audio controls preload="none" src={recordingUrl} className="mt-2 w-full" />
              </div>
            )}

            {call.summary && (
              <div>
                <h3 className="text-sm font-semibold">Summary</h3>
                <p className="mt-1 text-sm text-muted-foreground">{call.summary}</p>
              </div>
            )}

            {call.extraction && (
              <div>
                <h3 className="text-sm font-semibold">Lead Details</h3>
                <div className="mt-2 grid gap-2 rounded-xl border p-4 text-sm">
                  <DetailRow label="Name" value={call.extraction.callerName} />
                  <DetailRow label="Company" value={call.extraction.company} />
                  <DetailRow label="Email" value={call.extraction.email} />
                  <DetailRow label="Inquiry" value={call.extraction.inquiry} />
                  <DetailRow label="Follow-up needed" value={call.extraction.followUpRequired ? "Yes" : "No"} />
                  {call.customerId && (
                    <div className="pt-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/customers/$id" params={{ id: call.customerId }}>
                          <UserIcon className="size-4" />
                          View Customer
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold">Transcript</h3>
              {call.transcript.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No transcript was captured for this call.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {call.transcript.map((entry, index) => (
                    <div key={index} className={`flex gap-2 ${entry.role === "assistant" ? "" : "flex-row-reverse"}`}>
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted/50">
                        {entry.role === "assistant" ? (
                          <BotIcon className="size-3.5 text-muted-foreground" />
                        ) : (
                          <PhoneIcon className="size-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          entry.role === "assistant" ? "bg-muted/60" : "bg-primary/10"
                        }`}
                      >
                        {entry.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "-"}</span>
    </div>
  )
}
