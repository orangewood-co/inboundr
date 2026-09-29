import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, CopyIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { formatDateTime } from "@/lib/format"
import {
  WHATSAPP_SETTINGS_URL,
  invalidateWhatsAppSettings,
  whatsAppSettingsQueryOptions,
} from "@/lib/queries"
import { queryClient } from "@/lib/query-client"
import { copyToClipboard } from "@/lib/utils"
import { WhatsAppIcon } from "@/components/support/channel"

type WhatsAppTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "MISSING"

type WhatsAppTemplate = {
  key: string
  name: string
  description: string
  language: string
  status: WhatsAppTemplateStatus
  rejectedReason: string | null
  updatedAt: string | null
}

type WhatsAppAccount = {
  id: string
  phoneNumberId: string
  wabaId: string | null
  appId: string | null
  templates: WhatsAppTemplate[]
  templatesSyncedAt: string | null
  displayPhoneNumber: string
  verifiedName: string
  enabled: boolean
  status: "connected" | "error" | "disabled"
  errorMessage: string | null
  hasAppSecret: boolean
  lastInboundAt: string | null
  lastOutboundAt: string | null
  updatedAt: string | null
}

type WhatsAppSettingsResponse = {
  account: WhatsAppAccount | null
  webhookUrl: string
  verifyToken: string | null
  platformAppSecretConfigured: boolean
  platformAppIdConfigured: boolean
  sync?: { created: string[]; errors: Array<{ name: string; message: string }> }
}

const SETTINGS_URL = WHATSAPP_SETTINGS_URL
const TEMPLATE_SYNC_URL = `${WHATSAPP_SETTINGS_URL}/templates/sync`

const TEMPLATE_STATUS_META: Record<WhatsAppTemplateStatus, { label: string; className: string }> = {
  APPROVED: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  PENDING: { label: "In review", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  IN_APPEAL: { label: "In appeal", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  REJECTED: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
  PAUSED: { label: "Paused", className: "bg-destructive/15 text-destructive" },
  DISABLED: { label: "Disabled", className: "bg-destructive/15 text-destructive" },
  MISSING: { label: "Not created", className: "bg-muted text-muted-foreground" },
}

function TemplateStatusPill({ status }: { status: WhatsAppTemplateStatus }) {
  const meta = TEMPLATE_STATUS_META[status] ?? TEMPLATE_STATUS_META.MISSING
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => copyToClipboard(value, `${label} copied`)}
          aria-label={`Copy ${label}`}
        >
          <CopyIcon />
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatusBadge({ account }: { account: WhatsAppAccount }) {
  if (!account.enabled || account.status === "disabled") {
    return <Badge variant="secondary">Paused</Badge>
  }
  if (account.status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <TriangleAlertIcon className="size-3" />
        Needs attention
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
      <CheckCircle2Icon className="size-3" />
      Connected
    </Badge>
  )
}

/**
 * Connects a Meta Cloud API number to the organization so inbound WhatsApp
 * messages become support tickets and invoices/reminders can be sent. Rendered
 * inside the Settings → Integrations tab.
 */
export function WhatsAppSettingsCardContent({ canManage }: { canManage: boolean }) {
  const query = useQuery(whatsAppSettingsQueryOptions)
  const data = (query.data ?? null) as WhatsAppSettingsResponse | null
  const loading = query.isPending
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [editing, setEditing] = useState(false)

  const [phoneNumberId, setPhoneNumberId] = useState("")
  const [wabaId, setWabaId] = useState("")
  const [appId, setAppId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [appSecret, setAppSecret] = useState("")

  const account = data?.account ?? null
  const showForm = !account || editing

  function setData(next: WhatsAppSettingsResponse) {
    queryClient.setQueryData(whatsAppSettingsQueryOptions.queryKey, next)
  }

  function startEditing() {
    setPhoneNumberId(account?.phoneNumberId ?? "")
    setWabaId(account?.wabaId ?? "")
    setAppId(account?.appId ?? "")
    setAccessToken("")
    setAppSecret("")
    setEditing(true)
  }

  async function syncTemplates() {
    setSyncing(true)
    try {
      const res = await fetch(TEMPLATE_SYNC_URL, { method: "POST", credentials: "include" })
      const json = (await res.json().catch(() => null)) as WhatsAppSettingsResponse | null
      if (!res.ok || !json) throw new Error((json as { error?: string } | null)?.error || "Template sync failed")
      setData(json)
      const created = json.sync?.created ?? []
      const errors = json.sync?.errors ?? []
      if (errors.length > 0) {
        toast.error(`Could not create ${errors.map((error) => error.name).join(", ")}: ${errors[0].message}`)
      } else if (created.length > 0) {
        toast.success(`Submitted ${created.length} template${created.length === 1 ? "" : "s"} to Meta for review`)
      } else {
        toast.success("Template status refreshed")
      }
    } catch (err) {
      toast.error(errorMessage(err, "Template sync failed"))
    } finally {
      setSyncing(false)
    }
  }

  async function save(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch(SETTINGS_URL, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to save WhatsApp settings")
      setData(json)
      setAccessToken("")
      setAppSecret("")
      setEditing(false)
      return true
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save WhatsApp settings"))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function connect() {
    const ok = await save({
      phoneNumberId: phoneNumberId.trim(),
      wabaId: wabaId.trim(),
      appId: appId.trim(),
      ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
      ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
      enabled: account?.enabled ?? true,
    })
    if (ok) toast.success(account ? "WhatsApp settings updated" : "WhatsApp connected")
  }

  async function toggleEnabled(enabled: boolean) {
    if (!account) return
    const ok = await save({ phoneNumberId: account.phoneNumberId, enabled })
    if (ok) toast.success(enabled ? "WhatsApp inbox resumed" : "WhatsApp inbox paused")
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch(SETTINGS_URL, { method: "DELETE", credentials: "include" })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to disconnect WhatsApp")
      setData(json)
      setPhoneNumberId("")
      setWabaId("")
      setAppId("")
      setAccessToken("")
      setAppSecret("")
      setEditing(false)
      void invalidateWhatsAppSettings()
      setConfirmDisconnect(false)
      toast.success("WhatsApp disconnected")
    } catch (err) {
      toast.error(errorMessage(err, "Failed to disconnect WhatsApp"))
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-5 text-sm text-muted-foreground">Loading WhatsApp settings...</div>
    )
  }
  if (query.isError || !data) {
    return (
      <div className="flex items-center justify-between gap-3 p-5 text-sm text-muted-foreground">
        <span>{errorMessage(query.error, "Failed to load WhatsApp settings")}</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const canSubmit =
    canManage && !saving && phoneNumberId.trim().length >= 5 && (Boolean(account) || accessToken.trim().length > 0)

  return (
    <div className="space-y-5 p-5">
      {account && (
        <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <WhatsAppIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">
                  {account.displayPhoneNumber || account.phoneNumberId}
                </p>
                <StatusBadge account={account} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {account.verifiedName ? `${account.verifiedName} · ` : ""}
                Phone number ID <span className="font-mono">{account.phoneNumberId}</span>
              </p>
              {account.errorMessage && (
                <p className="mt-1 text-xs text-destructive">{account.errorMessage}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {account.lastInboundAt
                  ? `Last message received ${formatDateTime(account.lastInboundAt)}`
                  : "No messages received yet"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor="whatsappEnabled" className="text-xs text-muted-foreground">
              Accept messages
            </Label>
            <Switch
              id="whatsappEnabled"
              checked={account.enabled}
              disabled={!canManage || saving}
              onCheckedChange={(enabled) => void toggleEnabled(enabled)}
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-4">
          {!account && (
            <p className="text-sm text-muted-foreground">
              Connect a WhatsApp Business number through the Meta Cloud API. Customer messages
              open support conversations here, your AI agent can reply automatically, and your
              team answers from the same inbox as live chat and calls.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="whatsappPhoneNumberId">Phone number ID</Label>
              <Input
                id="whatsappPhoneNumberId"
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 106540352242922"
                disabled={!canManage || saving}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Meta Business Suite → WhatsApp → API Setup.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsappWabaId">WhatsApp Business Account ID (optional)</Label>
              <Input
                id="whatsappWabaId"
                value={wabaId}
                onChange={(event) => setWabaId(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 102290129340398"
                disabled={!canManage || saving}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Needed to create and track the message templates used for invoices and
                payment reminders.
              </p>
            </div>
            {!data.platformAppIdConfigured || account?.appId ? (
              <div className="space-y-1.5">
                <Label htmlFor="whatsappAppId">Meta App ID (optional)</Label>
                <Input
                  id="whatsappAppId"
                  value={appId}
                  onChange={(event) => setAppId(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 1264793705777779"
                  disabled={!canManage || saving}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The app your token belongs to. Required for Inboundr to create templates
                  with a PDF attachment on your behalf.
                </p>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsappAccessToken">
              {account ? "New access token (leave blank to keep the current one)" : "Permanent access token"}
            </Label>
            <Input
              id="whatsappAccessToken"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="EAAG…"
              disabled={!canManage || saving}
              autoComplete="off"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Generate a System User token with the{" "}
              <span className="font-mono">whatsapp_business_messaging</span> and{" "}
              <span className="font-mono">whatsapp_business_management</span> permissions. It is
              stored encrypted and validated with Meta before saving.
            </p>
          </div>
          {!data.platformAppSecretConfigured || account?.hasAppSecret ? (
            <div className="space-y-1.5">
              <Label htmlFor="whatsappAppSecret">
                {account?.hasAppSecret ? "New app secret (leave blank to keep the current one)" : "App secret"}
              </Label>
              <Input
                id="whatsappAppSecret"
                type="password"
                value={appSecret}
                onChange={(event) => setAppSecret(event.target.value)}
                placeholder="Meta App → App settings → Basic → App secret"
                disabled={!canManage || saving}
                autoComplete="off"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Used to verify that webhook calls really come from Meta. Required when you use your
                own Meta app.
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button onClick={() => void connect()} disabled={!canSubmit}>
              {saving && <Spinner data-icon="inline-start" />}
              {account ? "Save Changes" : "Connect WhatsApp"}
            </Button>
            {account && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {account && (
        <>
          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Webhook configuration</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                In your Meta app, open WhatsApp → Configuration, set the callback URL and verify
                token below, then subscribe to the <span className="font-mono">messages</span>{" "}
                field.
              </p>
            </div>
            <CopyField label="Callback URL" value={data.webhookUrl} />
            {data.verifyToken && <CopyField label="Verify token" value={data.verifyToken} />}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Meta webhook setup guide
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Message templates</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  WhatsApp only allows business-initiated messages (invoices, payment reminders)
                  through templates approved by Meta. Inboundr creates these on your account;
                  approval usually takes minutes to a few hours.
                </p>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void syncTemplates()}
                  disabled={syncing || !account.wabaId}
                >
                  {syncing && <Spinner data-icon="inline-start" />}
                  {account.templates.some((template) => template.status === "MISSING")
                    ? "Create & Sync Templates"
                    : "Refresh Status"}
                </Button>
              )}
            </div>
            {!account.wabaId && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Add your WhatsApp Business Account ID under Update Credentials to enable templates.
              </p>
            )}
            <div className="divide-y rounded-lg border">
              {account.templates.map((template) => (
                <div key={template.name} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{template.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
                    {template.rejectedReason && template.status !== "APPROVED" && (
                      <p className="mt-1 text-xs text-destructive">{template.rejectedReason}</p>
                    )}
                  </div>
                  <TemplateStatusPill status={template.status} />
                </div>
              ))}
            </div>
            {account.templatesSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last checked {formatDateTime(account.templatesSyncedAt)}
              </p>
            )}
          </div>

          {canManage && !editing && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={startEditing}>
                  Update Credentials
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect
                </Button>
              </div>
              {account.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last saved {formatDateTime(account.updatedAt)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!canManage && !account && (
        <p className="text-xs text-muted-foreground">
          Only organization owners and admins can connect WhatsApp.
        </p>
      )}

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect WhatsApp</DialogTitle>
            <DialogDescription>
              New WhatsApp messages will no longer create conversations and agents will not be
              able to reply to existing WhatsApp tickets. Existing conversations stay in the inbox.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void disconnect()} disabled={disconnecting}>
              {disconnecting && <Spinner data-icon="inline-start" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
