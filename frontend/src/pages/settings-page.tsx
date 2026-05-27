import { useCallback, useEffect, useState } from "react"
import { useSearch } from "@tanstack/react-router"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemePicker } from "@/components/theme-picker"
import { useSession } from "@/lib/auth-client"
import { notifyOrganizationBrandingChanged } from "@/lib/organization-branding"
import { setActiveOrganizationId } from "@/lib/organization-context"
import {
  Building2Icon,
  KeyIcon,
  MailIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

interface GmailAccount {
  _id: string
  emailAddress: string
  scope: string[]
  watchExpiration: string | null
  status: "connected" | "expired" | "revoked" | "error"
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

interface Organization {
  _id: string
  name: string
  defaultContact: {
    name: string
    email: string
    phoneNumber: string
  }
  website: string
  logoUrl: string
  address: string
  preferences: {
    primaryColor: string
    theme: "dark" | "light"
    colorTheme: string
    pricing: string
    defaultTerms: string
  }
}

type OrganizationFormState = Omit<Organization, "_id">

type OrganizationRole = "owner" | "admin" | "member"

interface OrganizationMember {
  _id: string
  userId: string
  userName: string | null
  userEmail: string | null
  role: OrganizationRole
  createdAt: string
}

interface OrganizationInvitation {
  _id: string
  email: string
  role: OrganizationRole
  expiresAt: string
  createdAt: string
}

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: {
    key: string
    url: string | null
  }
}

const emptyOrganizationForm: OrganizationFormState = {
  name: "",
  defaultContact: {
    name: "",
    email: "",
    phoneNumber: "",
  },
  website: "",
  logoUrl: "",
  address: "",
  preferences: {
    primaryColor: "#f5b400",
    theme: "dark",
    colorTheme: "default",
    pricing: "INR",
    defaultTerms: "",
  },
}

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <Separator />
      {children}
    </div>
  )
}

function RoleBadge({ role }: { role: "Owner" | "Admin" | "Member" }) {
  const styles = {
    Owner: "bg-primary/10 text-primary",
    Admin: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Member: "bg-muted text-muted-foreground",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[role]}`}>
      {role}
    </span>
  )
}

function toRoleLabel(role: OrganizationRole): "Owner" | "Admin" | "Member" {
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"
}

function colorInputValue(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#f5b400"
}

function getInitials(value?: string | null) {
  const fallback = value?.trim() || "User"
  const parts = fallback.split(/\s+/).slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "U"
}

async function resolveLogoDisplayUrl(logoUrl: string): Promise<string> {
  const source = logoUrl.trim()
  if (!source || /^https?:\/\//i.test(source)) {
    return source
  }

  const res = await fetch(`${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(source)}`, {
    credentials: "include",
  })
  const data: { url?: string; error?: string } = await res.json().catch(() => ({}))

  if (!res.ok || !data.url) {
    throw new Error(data.error || "Failed to load organization logo")
  }

  return data.url
}

// ─── Tab Content ─────────────────────────────────────────────

function OrganizationTab() {
  const [form, setForm] = useState<OrganizationFormState>(emptyOrganizationForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  const fetchOrganization = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        credentials: "include",
      })
      const data: { organization: Organization } = await res.json()
      if (!res.ok) throw new Error((data as any)?.error || "Failed to load organization")

      setForm({
        name: data.organization.name ?? "",
        defaultContact: {
          name: data.organization.defaultContact?.name ?? "",
          email: data.organization.defaultContact?.email ?? "",
          phoneNumber: data.organization.defaultContact?.phoneNumber ?? "",
        },
        website: data.organization.website ?? "",
        logoUrl: data.organization.logoUrl ?? "",
        address: data.organization.address ?? "",
        preferences: {
          primaryColor: data.organization.preferences?.primaryColor ?? "#f5b400",
          theme: data.organization.preferences?.theme ?? "dark",
          colorTheme: data.organization.preferences?.colorTheme ?? "default",
          pricing: data.organization.preferences?.pricing ?? "INR",
          defaultTerms: data.organization.preferences?.defaultTerms ?? "",
        },
      })
    } catch (err: any) {
      setError(err.message || "Failed to load organization")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    let cancelled = false

    if (!form.logoUrl) {
      setLogoPreviewUrl("")
      return
    }

    void resolveLogoDisplayUrl(form.logoUrl)
      .then((url) => {
        if (!cancelled) setLogoPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setLogoPreviewUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [form.logoUrl])

  const saveOrganization = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save organization")
      toast.success("Organization settings saved")
      notifyOrganizationBrandingChanged()
    } catch (err: any) {
      const message = err.message || "Failed to save organization"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (field: keyof OrganizationFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateContact = (field: keyof OrganizationFormState["defaultContact"], value: string) => {
    setForm((current) => ({
      ...current,
      defaultContact: { ...current.defaultContact, [field]: value },
    }))
  }

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be 2MB or smaller.")
      return
    }

    setUploadingLogo(true)
    setError(null)

    try {
      const presignRes = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "branding",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })
      const presign: PresignedUpload | { error?: string } = await presignRes.json()

      if (!presignRes.ok || !("uploadUrl" in presign)) {
        throw new Error((presign as { error?: string }).error || "Failed to prepare logo upload")
      }

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload logo")
      }

      updateForm("logoUrl", presign.file.key)
      setLogoPreviewUrl(await resolveLogoDisplayUrl(presign.file.key))
      toast.success("Logo uploaded", {
        description: "Save organization settings to publish it.",
      })
    } catch (err: any) {
      const message = err.message || "Failed to upload logo"
      setError(message)
      toast.error(message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const updatePreference = (field: keyof OrganizationFormState["preferences"], value: string) => {
    setForm((current) => ({
      ...current,
      preferences: { ...current.preferences, [field]: value },
    }))
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization"
        description="Customize your organization profile and quotation defaults."
      />

      <SettingsCard
        title="Organization Profile"
        description="These details identify your workspace across customer-facing flows."
      >
        <div className="space-y-5 p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading organization settings...</p>
          ) : (
            <>
              {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="organizationName">Organization name</Label>
                  <Input id="organizationName" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={form.website} onChange={(event) => updateForm("website", event.target.value)} placeholder="https://example.com" />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="organizationLogo">Organization logo</Label>
                <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-lg border bg-background">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt={`${form.name || "Organization"} logo`} className="max-h-16 max-w-28 object-contain" />
                    ) : (
                      <Building2Icon className="size-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      id="organizationLogo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploadingLogo}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void uploadLogo(file)
                        event.target.value = ""
                      }}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG. Max 2MB. Save organization settings after upload.</p>
                    {form.logoUrl && (
                      <Button type="button" variant="outline" size="sm" onClick={() => updateForm("logoUrl", "")}>
                        Remove logo
                      </Button>
                    )}
                  </div>
                  {uploadingLogo && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="organizationAddress">Address</Label>
                <textarea
                  id="organizationAddress"
                  rows={4}
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      {!loading && (
        <>
          <SettingsCard
            title="Default Contact"
            description="Primary person shown for organization-level communication."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="contactName">Name</Label>
                <Input id="contactName" value={form.defaultContact.name} onChange={(event) => updateContact("name", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">Email</Label>
                <Input id="contactEmail" type="email" value={form.defaultContact.email} onChange={(event) => updateContact("email", event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactPhone">Phone number</Label>
                <Input id="contactPhone" value={form.defaultContact.phoneNumber} onChange={(event) => updateContact("phoneNumber", event.target.value)} />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard
            title="Preferences"
            description="Defaults that can be used by quoting and presentation flows."
          >
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="primaryColor">Primary color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={colorInputValue(form.preferences.primaryColor)}
                      onChange={(event) => updatePreference("primaryColor", event.target.value)}
                      className="w-12 p-1"
                    />
                    <Input
                      value={form.preferences.primaryColor}
                      onChange={(event) => updatePreference("primaryColor", event.target.value)}
                      placeholder="#f5b400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="theme">Mode</Label>
                  <Select
                    value={form.preferences.theme}
                    onValueChange={(value) => updatePreference("theme", value)}
                  >
                    <SelectTrigger id="theme" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricing">Pricing currency</Label>
                  <Input id="pricing" value={form.preferences.pricing} onChange={(event) => updatePreference("pricing", event.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Color theme</Label>
                <p className="text-[13px] text-muted-foreground">
                  Sets the default color theme for all users in this organization.
                </p>
                <ThemePicker
                  value={form.preferences.colorTheme}
                  onChange={(name) => updatePreference("colorTheme", name)}
                  className="pt-1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultTerms">Default terms</Label>
                <textarea
                  id="defaultTerms"
                  rows={5}
                  value={form.preferences.defaultTerms}
                  onChange={(event) => updatePreference("defaultTerms", event.target.value)}
                  placeholder="Payment terms, quote validity, delivery terms..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex">
                <Button onClick={saveOrganization} disabled={saving || !form.name.trim()}>
                  {saving && <Spinner data-icon="inline-start" />}
                  Save Organization
                </Button>
              </div>
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  )
}

function AccountTab() {
  const { data: session, isPending: loadingSession } = useSession()
  const [accounts, setAccounts] = useState<GmailAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [gmailError, setGmailError] = useState<string | null>(null)

  const fetchGmailAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setGmailError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/gmail/accounts`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { accounts: GmailAccount[] } = await res.json()
      setAccounts(data.accounts)
    } catch (err: any) {
      setGmailError(err.message || "Failed to load Gmail accounts")
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    fetchGmailAccounts()
  }, [fetchGmailAccounts])

  const handleConnectGmail = async () => {
    setConnecting(true)
    setGmailError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/gmail/connect`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { url: string } = await res.json()
      window.location.href = data.url
    } catch (err: any) {
      setGmailError(err.message || "Failed to start Gmail connection")
      setConnecting(false)
    }
  }

  const handleDisconnectGmail = async (id: string) => {
    setDisconnectingId(id)
    setGmailError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/gmail/accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchGmailAccounts()
      toast.success("Gmail account disconnected")
    } catch (err: any) {
      setGmailError(err.message || "Failed to disconnect Gmail")
      toast.error(err.message || "Failed to disconnect Gmail")
    } finally {
      setDisconnectingId(null)
    }
  }

  const user = session?.user
  const displayName = user?.name || user?.email || "Signed-in user"
  const displayEmail = user?.email || "Email unavailable"
  const initials = getInitials(displayName)

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account"
        description="Your signed-in identity and connected inboxes."
      />

      <SettingsCard
        title="Account Identity"
        description="This information comes from your BTSA login."
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border bg-primary/10 text-xl font-bold text-primary shadow-sm">
              {loadingSession ? <Spinner /> : initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{loadingSession ? "Loading account..." : displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{loadingSession ? "Checking current session" : displayEmail}</p>
            </div>
          </div>
          <div className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            Authenticated
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Connected Gmail"
        description="Authorize Gmail inboxes for RFQ processing and quote replies."
        action={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleConnectGmail}
            disabled={connecting}
          >
            {connecting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <MailIcon className="size-4" />
            )}
            Connect Gmail
          </Button>
        }
      >
        <div className="divide-y">
          {gmailError && (
            <div className="px-5 py-3 text-sm text-destructive">{gmailError}</div>
          )}
          {loadingAccounts ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">
              Loading Gmail accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <MailIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No Gmail account connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect Gmail to process incoming RFQs and send quotes on the same thread.
                </p>
              </div>
            </div>
          ) : (
            accounts.map((account) => (
              <div key={account._id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <MailIcon className="size-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{account.emailAddress}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        account.status === "connected"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {account.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.watchExpiration
                        ? `Watch renews before ${new Date(account.watchExpiration).toLocaleDateString()}`
                        : "Watch will start after Google authorization completes"}
                    </p>
                    {account.errorMessage && (
                      <p className="text-xs text-destructive">{account.errorMessage}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDisconnectGmail(account._id)}
                  disabled={disconnectingId === account._id}
                >
                  {disconnectingId === account._id && <Spinner data-icon="inline-start" />}
                  Disconnect
                </Button>
              </div>
            ))
          )}
        </div>
      </SettingsCard>
    </div>
  )
}

function MembersTab() {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrganizationRole>("member")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/organization/members`, {
          credentials: "include",
        }),
        fetch(`${API_ORIGIN}/api/v1/organization/invitations`, {
          credentials: "include",
        }),
      ])

      const membersData = await membersRes.json()
      if (!membersRes.ok) throw new Error(membersData?.error || "Failed to load members")
      setMembers(membersData.members ?? [])

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json()
        setInvitations(invitationsData.invitations ?? [])
      } else if (invitationsRes.status !== 403) {
        const invitationsData = await invitationsRes.json().catch(() => null)
        throw new Error(invitationsData?.error || "Failed to load invitations")
      }
    } catch (err: any) {
      setError(err.message || "Failed to load organization members")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("inviteToken")
    if (!token) return

    const acceptInvitation = async () => {
      setAccepting(true)
      setError(null)
      setMessage(null)
      try {
        const res = await fetch(`${API_ORIGIN}/api/v1/organization/invitations/accept`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || "Failed to accept invitation")
        if (data?.organizationId) setActiveOrganizationId(String(data.organizationId))
        setMessage("Invitation accepted. You now have access to this organization.")
        window.history.replaceState(null, "", window.location.pathname)
        await fetchMembers()
      } catch (err: any) {
        setError(err.message || "Failed to accept invitation")
      } finally {
        setAccepting(false)
      }
    }

    void acceptInvitation()
  }, [fetchMembers])

  const inviteMember = async () => {
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to send invitation")
      setEmail("")
      setRole("member")
      setMessage("Invitation sent")
      toast.success("Invitation sent")
      await fetchMembers()
    } catch (err: any) {
      setError(err.message || "Failed to send invitation")
      toast.error(err.message || "Failed to send invitation")
    } finally {
      setSubmitting(false)
    }
  }

  const cancelInvitation = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/invitations/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to cancel invitation")
      await fetchMembers()
      toast.success("Invitation cancelled")
    } catch (err: any) {
      setError(err.message || "Failed to cancel invitation")
      toast.error(err.message || "Failed to cancel invitation")
    }
  }

  const removeMember = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/members/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to remove member")
      }
      await fetchMembers()
      toast.success("Member removed")
    } catch (err: any) {
      setError(err.message || "Failed to remove member")
      toast.error(err.message || "Failed to remove member")
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Members"
        description="Manage your team members and their roles."
      />

      {(error || message || accepting) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          error
            ? "border-destructive/20 bg-destructive/10 text-destructive"
            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}>
          {error || (accepting ? "Accepting invitation..." : message)}
        </div>
      )}

      <SettingsCard title="Invite Member" description="Send an email invitation to add a teammate to this organization.">
        <div className="grid gap-3 p-5 sm:grid-cols-[1fr_140px_auto]">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
          />
          <Select
            value={role}
            onValueChange={(value) => setRole(value as OrganizationRole)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-1.5" onClick={inviteMember} disabled={submitting || !email.trim()}>
            {submitting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Invite
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Team Members" description={`${members.length} members in your workspace.`}>
        <div className="divide-y">
          {loading ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">No members found.</div>
          ) : members.map((member) => (
            <div key={member._id} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(member.userName ?? member.userEmail ?? member.userId).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.userName ?? member.userEmail ?? member.userId}</p>
                  {member.userEmail && (
                    <p className="text-xs text-muted-foreground">{member.userEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={toRoleLabel(member.role)} />
                {member.role !== "owner" && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeMember(member._id)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Pending Invitations" description="Invitations that haven't been accepted yet.">
        {invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-8">
            <div className="flex size-12 items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30">
              <MailIcon className="size-5 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">No pending invitations</p>
              <p className="text-xs text-muted-foreground/60">
                Invite team members to collaborate in your workspace.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {invitations.map((invitation) => (
              <div key={invitation._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <RoleBadge role={toRoleLabel(invitation.role)} />
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => cancelInvitation(invitation._id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────

export function SettingsPage() {
  const { tab } = useSearch({ from: "/settings" })
  const activeTab = tab ?? "organization"

  return (
    <AppLayout>
      <SiteHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-5xl px-6 py-8 lg:px-10">
          <div className="mb-7 max-w-2xl">
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Settings</h1>
          </div>

          <Tabs defaultValue={activeTab} key={activeTab}>
            <div className="mb-6 overflow-x-auto">
              <TabsList className="h-auto rounded-2xl bg-muted/60 p-1.5">
                <TabsTrigger value="organization" className="gap-1.5">
                  <Building2Icon className="size-3.5" />
                  Organization
                </TabsTrigger>
                <TabsTrigger value="account" className="gap-1.5">
                  <KeyIcon className="size-3.5" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-1.5">
                  <UsersIcon className="size-3.5" />
                  Members
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-1.5">
                  <MailIcon className="size-3.5" />
                  Notifications
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="max-w-3xl">
              <TabsContent value="organization" className="mt-0">
                <OrganizationTab />
              </TabsContent>
              <TabsContent value="account" className="mt-0">
                <AccountTab />
              </TabsContent>
              <TabsContent value="members" className="mt-0">
                <MembersTab />
              </TabsContent>
              <TabsContent value="notifications" className="mt-0">
                <NotificationsTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Notifications Tab ───────────────────────────────────────

interface DigestPreferences {
  enabled: boolean
  recipientMode: "all_members" | "custom"
  memberRecipientUserIds: string[]
  externalRecipientEmails: string[]
  sendTimeLocal: string
  timezone: string
  sections: {
    emailVolume: boolean
    rfqBreakdown: boolean
    productRequests: boolean
    matchQuality: boolean
  }
  sendHourUtc: number
}

const DIGEST_SECTIONS = [
  { key: "emailVolume" as const, label: "Email Volume", description: "Total received emails, RFQ vs non-RFQ split" },
  { key: "rfqBreakdown" as const, label: "RFQ Breakdown", description: "Processed and failed RFQ counts" },
  { key: "productRequests" as const, label: "Product Requests", description: "Requested line items and top products" },
  { key: "matchQuality" as const, label: "Match Quality", description: "Product search match rate and distribution" },
]

function NotificationsTab() {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const [prefs, setPrefs] = useState<DigestPreferences>({
    enabled: false,
    recipientMode: "all_members",
    memberRecipientUserIds: [],
    externalRecipientEmails: [],
    sendTimeLocal: "08:00",
    timezone: browserTimezone,
    sections: { emailVolume: true, rfqBreakdown: true, productRequests: true, matchQuality: true },
    sendHourUtc: 8,
  })
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [externalEmail, setExternalEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/digest/preferences`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const loadedMembers = data.members ?? []
        setMembers(loadedMembers)
        setPrefs({
          enabled: data.enabled ?? false,
          recipientMode: data.recipientMode ?? "all_members",
          memberRecipientUserIds:
            data.memberRecipientUserIds ?? loadedMembers.map((member: OrganizationMember) => member.userId),
          externalRecipientEmails: data.externalRecipientEmails ?? [],
          sendTimeLocal: data.sendTimeLocal ?? "08:00",
          timezone: data.timezone ?? browserTimezone,
          sections: {
            emailVolume: data.sections?.emailVolume ?? true,
            rfqBreakdown: data.sections?.rfqBreakdown ?? true,
            productRequests: data.sections?.productRequests ?? true,
            matchQuality: data.sections?.matchQuality ?? true,
          },
          sendHourUtc: data.sendHourUtc ?? 8,
        })
      })
      .catch(() => {
        toast.error("Failed to load notification preferences")
      })
      .finally(() => setLoading(false))
  }, [browserTimezone])

  const handleSave = async () => {
    if (prefs.recipientMode === "custom" && prefs.memberRecipientUserIds.length + prefs.externalRecipientEmails.length === 0) {
      toast.error("Select at least one digest recipient")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/digest/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save notification preferences")
      setPrefs((prev) => ({ ...prev, ...data }))
      if (data?.members) setMembers(data.members)
      toast.success("Notification preferences saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save notification preferences")
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/digest/test`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("Failed to send test email")
      }
      toast.success("Test email sent", {
        description: "Check your inbox.",
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email")
    } finally {
      setSendingTest(false)
    }
  }

  const toggleSection = (key: keyof DigestPreferences["sections"]) => {
    setPrefs((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }))
  }

  const selectedMemberIds =
    prefs.recipientMode === "all_members"
      ? members.map((member) => member.userId)
      : prefs.memberRecipientUserIds
  const selectedMemberCount = selectedMemberIds.length
  const totalRecipientCount = selectedMemberCount + prefs.externalRecipientEmails.length
  const selectedMemberSet = new Set(selectedMemberIds)
  const externalEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail.trim())
  const disableSave =
    saving ||
    (prefs.recipientMode === "custom" && totalRecipientCount === 0)
  const [sendHour = "08", sendMinute = "00"] = prefs.sendTimeLocal.split(":")
  const sendHourNumber = Number(sendHour)
  const sendPeriod = sendHourNumber >= 12 ? "PM" : "AM"
  const sendDisplayHour = String(sendHourNumber % 12 || 12).padStart(2, "0")
  const updateSendTime = (next: { hour?: string; minute?: string; period?: string }) => {
    const hour12 = Number(next.hour ?? sendDisplayHour)
    const minute = next.minute ?? sendMinute
    const period = next.period ?? sendPeriod
    const hour24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12
    setPrefs((prev) => ({
      ...prev,
      sendTimeLocal: `${String(hour24).padStart(2, "0")}:${minute}`,
    }))
  }

  const toggleMemberRecipient = (userId: string) => {
    setPrefs((prev) => {
      const selected = new Set(prev.memberRecipientUserIds)
      if (selected.has(userId)) selected.delete(userId)
      else selected.add(userId)
      return { ...prev, memberRecipientUserIds: [...selected] }
    })
  }

  const addExternalEmail = () => {
    const email = externalEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address")
      return
    }
    const memberEmails = new Set(members.map((member) => member.userEmail?.toLowerCase()).filter(Boolean))
    if (prefs.externalRecipientEmails.includes(email) || memberEmails.has(email)) {
      toast.error("That recipient is already included")
      return
    }
    setPrefs((prev) => ({
      ...prev,
      recipientMode: "custom",
      externalRecipientEmails: [...prev.externalRecipientEmails, email],
    }))
    setExternalEmail("")
  }

  const removeExternalEmail = (email: string) => {
    setPrefs((prev) => ({
      ...prev,
      externalRecipientEmails: prev.externalRecipientEmails.filter((item) => item !== email),
    }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notifications"
        description="Control who gets the daily operating digest and when it lands."
      />

      <SettingsCard
        title="Daily Stats Digest"
        description={`${totalRecipientCount} recipient${totalRecipientCount === 1 ? "" : "s"} · ${prefs.sendTimeLocal} ${prefs.timezone}`}
        action={
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, enabled: checked }))}
          />
        }
      >
        <div className="space-y-5 px-5 py-4">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Delivery window</p>
                <p className="text-xs text-muted-foreground">
                  Sent daily at {prefs.sendTimeLocal} in {prefs.timezone}. The backend queues it during hour {prefs.sendHourUtc.toString().padStart(2, "0")}:00 UTC.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Select
                    value={sendDisplayHour}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ hour: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">:</span>
                  <Select
                    value={sendMinute}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ minute: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((minute) => (
                        <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sendPeriod}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ period: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={!prefs.enabled}
                  onClick={() => setPrefs((prev) => ({ ...prev, timezone: browserTimezone }))}
                >
                  Use local zone
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Recipients</p>
              <p className="text-xs text-muted-foreground">
                Send to every workspace member by default, or choose a tighter list and add outside emails.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition-colors ${prefs.recipientMode === "all_members" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                disabled={!prefs.enabled}
                onClick={() => setPrefs((prev) => ({ ...prev, recipientMode: "all_members" }))}
              >
                <p className="text-sm font-semibold">All members</p>
                <p className="mt-1 text-xs text-muted-foreground">{members.length} current workspace members</p>
              </button>
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition-colors ${prefs.recipientMode === "custom" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                disabled={!prefs.enabled}
                onClick={() => setPrefs((prev) => ({
                  ...prev,
                  recipientMode: "custom",
                  memberRecipientUserIds: prev.memberRecipientUserIds.length > 0 ? prev.memberRecipientUserIds : members.map((member) => member.userId),
                }))}
              >
                <p className="text-sm font-semibold">Custom recipients</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalRecipientCount} selected recipients</p>
              </button>
            </div>

            {prefs.recipientMode === "custom" && (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="divide-y rounded-lg border">
                  {members.map((member) => (
                    <label key={member._id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.userName ?? member.userEmail ?? "Unnamed member"}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.userEmail ?? "Email unavailable for this member"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <RoleBadge role={toRoleLabel(member.role)} />
                        <Switch
                          size="sm"
                          checked={selectedMemberSet.has(member.userId)}
                          disabled={!prefs.enabled || !member.userEmail}
                          onCheckedChange={() => toggleMemberRecipient(member.userId)}
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>External recipients</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={externalEmail}
                      disabled={!prefs.enabled}
                      onChange={(event) => setExternalEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addExternalEmail()
                        }
                      }}
                      placeholder="advisor@example.com"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExternalEmail}
                      disabled={!prefs.enabled || !externalEmailIsValid}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Outside recipients receive the digest email but do not get workspace access.
                  </p>
                  {prefs.externalRecipientEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {prefs.externalRecipientEmails.map((email) => (
                        <span key={email} className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
                          {email}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeExternalEmail(email)}
                            aria-label={`Remove ${email}`}
                          >
                            <Trash2Icon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Included sections</p>
              <p className="text-xs text-muted-foreground">Choose which stats should appear in the daily email.</p>
            </div>
            {DIGEST_SECTIONS.map((section) => (
              <label
                key={section.key}
                className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <Switch
                  size="sm"
                  checked={prefs.sections[section.key]}
                  onCheckedChange={() => toggleSection(section.key)}
                  disabled={!prefs.enabled}
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={disableSave}>
              {saving && <Spinner data-icon="inline-start" />}
              Save preferences
            </Button>
            <Button variant="outline" onClick={handleSendTest} disabled={sendingTest}>
              {sendingTest && <Spinner data-icon="inline-start" />}
              Send test email
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

export default SettingsPage
