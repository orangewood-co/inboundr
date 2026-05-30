import { type FormEvent, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ChevronDownIcon,
  MailIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/links`
const SHORT_DOMAIN = `${API_ORIGIN.replace(/^https?:\/\//, "")}/l`

function generateCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let code = ""
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function emptyForm() {
  return {
    destinationUrl: "",
    code: "",
    title: "",
    password: "",
    expiresAt: "",
    maxViews: "",
    trackingMode: "standard",
  }
}

export default function LinksCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: string) {
    setForm((cur) => ({ ...cur, [key]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.expiresAt && new Date(form.expiresAt).getTime() <= Date.now()) {
      toast.error("Expiry must be in the future")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          maxViews: form.maxViews ? Number(form.maxViews) : null,
          expiresAt: form.expiresAt || null,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Failed to create link")
      toast.success("Short link created")
      void navigate({ to: "/links" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
        <SiteHeader
          breadcrumbs={[
            { label: "Links", href: "/links" },
            { label: "Create" },
          ]}
        />
        <main className="flex-1 overflow-auto">
          <form onSubmit={handleSubmit} className="mx-auto max-w-2xl p-6 lg:p-8">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">Create a new link</h1>
            </div>

            {/* Link details card */}
            <div className="mt-6 rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Link details</h2>

              {/* Destination URL */}
              <div className="mt-5 grid gap-2">
                <Label htmlFor="destinationUrl">Destination URL</Label>
                <Input
                  id="destinationUrl"
                  required
                  value={form.destinationUrl}
                  onChange={(e) => set("destinationUrl", e.target.value)}
                  placeholder="https://example.com/my-long-url"
                  className="h-11"
                />
              </div>

              {/* Short link domain + back-half */}
              <div className="mt-5 grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label>Short link domain</Label>
                    <Label className="text-muted-foreground">
                      Back-half <span className="text-xs">(optional)</span>
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => set("code", generateCode())}
                  >
                    <SparklesIcon className="size-3.5" />
                    Generate
                  </Button>
                </div>
                <div className="flex items-center gap-0">
                  <div className="flex h-11 items-center rounded-l-md border border-r-0 bg-muted/50 px-3">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {SHORT_DOMAIN}
                    </span>
                  </div>
                  <span className="flex h-11 items-center border-y bg-muted/50 px-1 text-muted-foreground">/</span>
                  <Input
                    value={form.code}
                    onChange={(e) => set("code", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder=""
                    className="h-11 rounded-l-none"
                  />
                </div>
              </div>

              {/* Title */}
              <div className="mt-5 grid gap-2">
                <Label htmlFor="title">
                  Title <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder=""
                  className="h-11"
                />
              </div>
            </div>

            {/* Advanced options */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-4">
              <div className="rounded-xl border bg-card">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4">
                  <h2 className="text-lg font-semibold">Advanced options</h2>
                  <ChevronDownIcon
                    className={`size-5 text-muted-foreground transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="grid gap-5 p-6">
                    {/* Password */}
                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        Password <span className="text-xs text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        placeholder="Require a password to access this link"
                        className="h-11"
                      />
                    </div>

                    {/* Expiry + Max views */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="expiresAt">
                          Expiry <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="expiresAt"
                          type="datetime-local"
                          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                          value={form.expiresAt}
                          onChange={(e) => set("expiresAt", e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="maxViews">
                          Max views <span className="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="maxViews"
                          type="number"
                          min={1}
                          value={form.maxViews}
                          onChange={(e) => set("maxViews", e.target.value)}
                          placeholder="Unlimited"
                          className="h-11"
                        />
                      </div>
                    </div>

                    {/* Precise location */}
                    <label className="flex items-start gap-3 rounded-lg border p-4">
                      <Switch
                        checked={form.trackingMode === "precise_location"}
                        onCheckedChange={(checked) =>
                          setForm((cur) => ({
                            ...cur,
                            trackingMode: checked ? "precise_location" : "standard",
                          }))
                        }
                      />
                      <div className="grid gap-0.5">
                        <span className="text-sm font-medium">Precise location tracking</span>
                        <span className="text-xs text-muted-foreground">
                          Viewers will see a consent screen before being redirected.
                        </span>
                      </div>
                    </label>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Sharing options */}
            <div className="mt-4 rounded-xl border bg-card">
              <div className="px-6 py-4">
                <h2 className="text-lg font-semibold">Sharing options</h2>
              </div>
              <Separator />
              <div className="grid gap-0 divide-y">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                      <MailIcon className="size-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">Send link via email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Coming soon</span>
                    <Switch disabled />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link to="/links">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Create link
              </Button>
            </div>
          </form>
        </main>
    </AppLayout>
  )
}
