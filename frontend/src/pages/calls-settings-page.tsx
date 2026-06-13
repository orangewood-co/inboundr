import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, PhoneIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

import { API_ORIGIN } from "@/lib/env"

const API_BASE = `${API_ORIGIN}/api/v1/calls`

const TEXTAREA_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"

type AgentConfig = {
  enabled: boolean
  businessName: string
  greeting: string
  businessInfo: string
  extraInstructions: string
}

type AssignedNumber = {
  _id: string
  number: string
  label: string
}

export default function CallsSettingsPage() {
  const [config, setConfig] = useState<AgentConfig>({
    enabled: true,
    businessName: "",
    greeting: "",
    businessInfo: "",
    extraInstructions: "",
  })
  const [phoneNumbers, setPhoneNumbers] = useState<AssignedNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/agent-settings`, { credentials: "include" })
        if (!response.ok) throw new Error("Failed to load agent settings")
        const data = await response.json()
        setConfig(data.config)
        setPhoneNumbers(data.phoneNumbers ?? [])
      } catch {
        toast.error("Failed to load agent settings")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function onChange<Key extends keyof AgentConfig>(key: Key, value: AgentConfig[Key]) {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/agent-settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to save agent settings")
      }
      const data = await response.json()
      setConfig(data.config)
      toast.success("Agent settings saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save agent settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Calls", href: "/calls" }, { label: "Agent Settings" }]} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl p-6 lg:p-8">
          <PageHeader
            title="Agent Settings"
            description="Configure how your AI voice agent answers inbound calls."
            actions={
              <Button variant="outline" asChild>
                <Link to="/calls">
                  <ArrowLeftIcon className="size-4" />
                  Back to Calls
                </Link>
              </Button>
            }
          />

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <section className="rounded-2xl border bg-card p-5">
                <h2 className="font-semibold">Phone Numbers</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Numbers assigned to your organization. Calls to these numbers are answered by the AI agent.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {phoneNumbers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No phone number assigned yet. Contact your platform administrator to get a number for your business.
                    </p>
                  ) : (
                    phoneNumbers.map((entry) => (
                      <Badge key={entry._id} variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                        <PhoneIcon className="size-3.5" />
                        {entry.number}
                        {entry.label ? <span className="text-muted-foreground">· {entry.label}</span> : null}
                      </Badge>
                    ))
                  )}
                </div>
              </section>

              <form onSubmit={save} className="space-y-6 rounded-2xl border bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">Receptionist</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      When disabled, callers hear that the number is unavailable.
                    </p>
                  </div>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => onChange("enabled", checked)}
                    aria-label="Enable the voice agent"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={config.businessName}
                    onChange={(event) => onChange("businessName", event.target.value)}
                    placeholder="How the agent introduces your business"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="greeting">Greeting</Label>
                  <Input
                    id="greeting"
                    value={config.greeting}
                    onChange={(event) => onChange("greeting", event.target.value)}
                    placeholder="Hello! Thanks for calling Acme Instruments. How can I help you today?"
                  />
                  <p className="text-xs text-muted-foreground">
                    Spoken word-for-word when a call connects. Leave empty to let the agent improvise.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="businessInfo">Business information</Label>
                  <textarea
                    id="businessInfo"
                    rows={8}
                    value={config.businessInfo}
                    onChange={(event) => onChange("businessInfo", event.target.value)}
                    className={TEXTAREA_CLASS}
                    placeholder="What you sell, business hours, location, delivery areas, common questions and their answers…"
                  />
                  <p className="text-xs text-muted-foreground">
                    The agent uses this to answer caller questions. The product catalog is searched automatically.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="extraInstructions">Extra instructions (optional)</Label>
                  <textarea
                    id="extraInstructions"
                    rows={4}
                    value={config.extraInstructions}
                    onChange={(event) => onChange("extraInstructions", event.target.value)}
                    className={TEXTAREA_CLASS}
                    placeholder="e.g. Always mention our monsoon discount. Never quote delivery dates."
                  />
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon className="size-4" />}
                  Save Changes
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  )
}
