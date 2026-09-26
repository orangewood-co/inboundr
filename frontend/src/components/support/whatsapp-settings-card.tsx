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
import { API_ORIGIN } from "@/lib/env"
import { formatDateTime } from "@/lib/format"
import { supportWhatsAppSettingsQueryOptions } from "@/lib/queries"
import { queryClient } from "@/lib/query-client"
import { copyToClipboard } from "@/lib/utils"
import { WhatsAppIcon } from "./channel"

type WhatsAppAccount = {
  id: string
  phoneNumberId: string
  wabaId: string | null
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
}

const SETTINGS_URL = `${API_ORIGIN}/api/v1/support/whatsapp/settings`

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
 * messages become support tickets. Rendered inside the Settings → Support tab.
 */
export function WhatsAppSettingsCardContent({ canManage }: { canManage: boolean }) {
  const query = useQuery(supportWhatsAppSettingsQueryOptions)
  const data = (query.data ?? null) as WhatsAppSettingsResponse | null
  const loading = query.isPending
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [editing, setEditing] = useState(false)

  const [phoneNumberId, setPhoneNumberId] = useState("")
  const [wabaId, setWabaId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [appSecret, setAppSecret] = useState("")

  const account = data?.account ?? null
  const showForm = !account || editing

  function setData(next: WhatsAppSettingsResponse) {
    queryClient.setQueryData(supportWhatsAppSettingsQueryOptions.queryKey, next)
  }

  function startEditing() {
    setPhoneNumberId(account?.phoneNumberId ?? "")
    setWabaId(account?.wabaId ?? "")
    setAccessToken("")
    setAppSecret("")
    setEditing(true)
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
      setAccessToken("")
      setAppSecret("")
      setEditing(false)
      void queryClient.invalidateQueries({ queryKey: supportWhatsAppSettingsQueryOptions.queryKey })
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
                Lets Inboundr subscribe to webhooks for you when the token permits it.
              </p>
            </div>
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
