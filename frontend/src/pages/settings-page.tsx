import { type CSSProperties, useCallback, useEffect, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { setActiveOrganizationId } from "@/lib/organization-context"
import {
  Building2Icon,
  CameraIcon,
  EllipsisVerticalIcon,
  KeyIcon,
  LifeBuoyIcon,
  MailIcon,
  PlusIcon,
  ShieldIcon,
  SmartphoneIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

// ─── Mock Data ───────────────────────────────────────────────

const MOCK_PUBLIC_APIS = [
  { name: "Public Data API", created: "Sep 6, 2024 2:08 am", status: "active" as const },
  { name: "Product Info API", created: "Sep 12, 2024 2:07 pm", status: "active" as const },
  { name: "User Data API", created: "Aug 20, 2024 7:59 am", status: "revoked" as const },
]

const MOCK_PRIVATE_APIS = [
  { name: "Internal Service Key", created: "Oct 1, 2024 9:30 am", status: "active" as const },
  { name: "Staging Environment", created: "Nov 15, 2024 4:12 pm", status: "active" as const },
]

const MOCK_SESSIONS = [
  { device: "Chrome on Windows", location: "New Delhi, IN", lastActive: "Just now", current: true },
  { device: "Safari on iPhone", location: "Mumbai, IN", lastActive: "2 hours ago", current: false },
  { device: "Firefox on macOS", location: "Bangalore, IN", lastActive: "3 days ago", current: false },
]

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
    pricing: string
    defaultTerms: string
  }
}

type OrganizationFormState = Omit<Organization, "_id">

type OrganizationRole = "owner" | "admin" | "member"

interface OrganizationMember {
  _id: string
  userId: string
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
    <div className="rounded-xl border bg-background">
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

function StatusBadge({ status }: { status: "active" | "revoked" }) {
  return status === "active" ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      Revoke
    </span>
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

function ApiTable({ items }: { items: typeof MOCK_PUBLIC_APIS }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              API Name
            </th>
            <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date of Creation
            </th>
            <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b last:border-0 transition-colors hover:bg-muted/30">
              <td className="px-5 py-3.5 font-medium">{item.name}</td>
              <td className="px-5 py-3.5 text-muted-foreground">{item.created}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-3 py-3.5">
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <EllipsisVerticalIcon className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab Content ─────────────────────────────────────────────

function OrganizationTab() {
  const [form, setForm] = useState<OrganizationFormState>(emptyOrganizationForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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

  const saveOrganization = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save organization")
      setMessage("Organization settings saved")
    } catch (err: any) {
      setError(err.message || "Failed to save organization")
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
              {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{message}</div>}

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

              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" value={form.logoUrl} onChange={(event) => updateForm("logoUrl", event.target.value)} placeholder="https://example.com/logo.png" />
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
                  <Input id="primaryColor" value={form.preferences.primaryColor} onChange={(event) => updatePreference("primaryColor", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="theme">Theme</Label>
                  <select
                    id="theme"
                    value={form.preferences.theme}
                    onChange={(event) => updatePreference("theme", event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricing">Pricing currency</Label>
                  <Input id="pricing" value={form.preferences.pricing} onChange={(event) => updatePreference("pricing", event.target.value)} />
                </div>
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
                  {saving ? "Saving..." : "Save Organization"}
                </Button>
              </div>
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  )
}

function ProfileTab() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Profile"
        description="Manage your public profile information."
      />

      <SettingsCard title="Personal Information" description="Update your name and contact details.">
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              T
            </div>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CameraIcon className="size-3.5" />
                Change Avatar
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>

          <Separator />

          <div className="max-w-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue="Tushar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue="Gaurav" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="tushar@btsa.dev" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                rows={3}
                defaultValue="Building tools for smarter business operations."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex">
            <Button>Save Changes</Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

function AccountTab() {
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
    } catch (err: any) {
      setGmailError(err.message || "Failed to disconnect Gmail")
    } finally {
      setDisconnectingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account"
        description="Manage your account security and preferences."
      />

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
            <MailIcon className="size-4" />
            {connecting ? "Connecting..." : "Connect Gmail"}
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
                  {disconnectingId === account._id ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Change Password" description="Update your password to keep your account secure.">
        <div className="space-y-4 p-5">
          <div className="max-w-lg space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" placeholder="Enter current password" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" placeholder="Enter new password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" placeholder="Confirm new password" />
              </div>
            </div>
          </div>
          <div className="flex">
            <Button>Update Password</Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Two-Factor Authentication" description="Add an extra layer of security to your account.">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <ShieldIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Authenticator App</p>
              <p className="text-xs text-muted-foreground">Use an authenticator app to generate one-time codes.</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Enable
          </Button>
        </div>
        <Separator />
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <SmartphoneIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">SMS Recovery</p>
              <p className="text-xs text-muted-foreground">Use your phone number as a backup for 2FA.</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Set Up
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Active Sessions" description="Devices currently signed in to your account.">
        <div className="divide-y">
          {MOCK_SESSIONS.map((session, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <SmartphoneIcon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {session.device}
                    {session.current && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.location} &middot; {session.lastActive}
                  </p>
                </div>
              </div>
              {!session.current && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Danger Zone" description="Irreversible and destructive actions.">
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <p className="text-sm font-medium text-destructive">Delete Account</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <Button variant="destructive" size="sm" className="gap-1.5">
            <Trash2Icon className="size-3.5" />
            Delete Account
          </Button>
        </div>
      </SettingsCard>
    </div>
  )
}

function AnalyticsTab() {
  const stats = [
    { label: "Total Page Views", value: "24,521", change: "+12.3%", up: true },
    { label: "Active Sessions", value: "1,432", change: "+5.7%", up: true },
    { label: "Bounce Rate", value: "32.8%", change: "-2.1%", up: false },
    { label: "Avg. Session Duration", value: "4m 32s", change: "+0.8%", up: true },
  ]

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analytics"
        description="Monitor usage and performance metrics for your workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-background px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className={`mt-1 text-xs font-medium ${stat.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {stat.change} from last month
            </p>
          </div>
        ))}
      </div>

      <SettingsCard title="Usage Over Time" description="Requests and data transfer for the last 30 days.">
        <div className="flex h-52 items-center justify-center px-5 py-5">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30">
              <svg className="size-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Chart visualization</p>
            <p className="text-xs text-muted-foreground/60">Connect an analytics provider to view data.</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Top Endpoints" description="Most frequently accessed API endpoints.">
        <div className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Endpoint</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Requests</th>
                <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg. Latency</th>
              </tr>
            </thead>
            <tbody>
              {[
                { endpoint: "/api/v1/products", requests: "12,847", latency: "45ms" },
                { endpoint: "/api/v1/rfq", requests: "8,321", latency: "120ms" },
                { endpoint: "/api/v1/users", requests: "5,102", latency: "32ms" },
                { endpoint: "/api/v1/emails", requests: "3,756", latency: "89ms" },
              ].map((row) => (
                <tr key={row.endpoint} className="border-b last:border-0 transition-colors hover:bg-muted/30">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium">{row.endpoint}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{row.requests}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  )
}

function ApiTab() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="API Settings"
        description="Configure your API settings. Add, remove or edit existing API keys."
        action={
          <Button variant="outline" className="gap-1.5">
            <LifeBuoyIcon className="size-4" />
            Contact support
          </Button>
        }
      />

      <SettingsCard
        title="Public API Settings"
        description="Manage and configure access to the Public API."
        action={
          <Button size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            New
          </Button>
        }
      >
        <ApiTable items={MOCK_PUBLIC_APIS} />
      </SettingsCard>

      <SettingsCard
        title="Private API Settings"
        description="Manage and configure access to the Private API."
        action={
          <Button size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            New
          </Button>
        }
      >
        <ApiTable items={MOCK_PRIVATE_APIS} />
      </SettingsCard>

      <SettingsCard title="API Usage" description="Current billing period usage.">
        <div className="space-y-3 px-5 py-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Requests this month</span>
            <span className="font-semibold tabular-nums">18,432 / 50,000</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[37%] rounded-full bg-primary transition-all" />
          </div>
          <p className="text-xs text-muted-foreground">
            37% of your monthly quota used. Resets on June 1, 2025.
          </p>
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
      await fetchMembers()
    } catch (err: any) {
      setError(err.message || "Failed to send invitation")
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
    } catch (err: any) {
      setError(err.message || "Failed to cancel invitation")
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
    } catch (err: any) {
      setError(err.message || "Failed to remove member")
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
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as OrganizationRole)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button className="gap-1.5" onClick={inviteMember} disabled={submitting || !email.trim()}>
            <PlusIcon className="size-4" />
            {submitting ? "Sending..." : "Invite"}
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
                  {member.userId.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.userId}</p>
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
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--header-height": "4rem",
          "--sidebar-width": "18rem",
        } as CSSProperties
      }
    >
      <AppSidebar collapsible="icon" variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl px-6 py-8 lg:px-8">
            <Tabs defaultValue="profile">
              <TabsList className="mb-6">
                <TabsTrigger value="organization" className="gap-1.5">
                  <Building2Icon className="size-3.5" />
                  Organization
                </TabsTrigger>
                <TabsTrigger value="profile" className="gap-1.5">
                  <UserIcon className="size-3.5" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="account" className="gap-1.5">
                  <KeyIcon className="size-3.5" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-1.5">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="api" className="gap-1.5">
                  API
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

              <TabsContent value="organization">
                <OrganizationTab />
              </TabsContent>
              <TabsContent value="profile">
                <ProfileTab />
              </TabsContent>
              <TabsContent value="account">
                <AccountTab />
              </TabsContent>
              <TabsContent value="analytics">
                <AnalyticsTab />
              </TabsContent>
              <TabsContent value="api">
                <ApiTab />
              </TabsContent>
              <TabsContent value="members">
                <MembersTab />
              </TabsContent>
              <TabsContent value="notifications">
                <NotificationsTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ─── Notifications Tab ───────────────────────────────────────

interface DigestPreferences {
  enabled: boolean
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
  const [prefs, setPrefs] = useState<DigestPreferences>({
    enabled: false,
    sections: { emailVolume: true, rfqBreakdown: true, productRequests: true, matchQuality: true },
    sendHourUtc: 8,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/digest/preferences`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setPrefs({
          enabled: data.enabled ?? false,
          sections: {
            emailVolume: data.sections?.emailVolume ?? true,
            rfqBreakdown: data.sections?.rfqBreakdown ?? true,
            productRequests: data.sections?.productRequests ?? true,
            matchQuality: data.sections?.matchQuality ?? true,
          },
          sendHourUtc: data.sendHourUtc ?? 8,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`${API_ORIGIN}/api/v1/digest/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    setTestSent(false)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/digest/test`, {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) {
        setTestSent(true)
        setTimeout(() => setTestSent(false), 4000)
      }
    } catch {
      // silently fail
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
        description="Configure how and when you receive updates from Inboundr."
      />

      <SettingsCard
        title="Daily Stats Digest"
        description="Receive a summary of your organization's activity every day."
        action={
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, enabled: checked }))}
          />
        }
      >
        <div className="space-y-4 px-5 py-4">
          <p className="text-[13px] text-muted-foreground">
            Choose which sections to include in your daily email. The digest is sent at{" "}
            <strong>{prefs.sendHourUtc.toString().padStart(2, "0")}:00 UTC</strong> each day.
          </p>

          <div className="space-y-3">
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved" : "Save preferences"}
            </Button>
            <Button variant="outline" onClick={handleSendTest} disabled={sendingTest}>
              {sendingTest ? "Sending..." : testSent ? "Sent!" : "Send test email"}
            </Button>
            {saved && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Preferences updated
              </span>
            )}
            {testSent && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                Check your inbox
              </span>
            )}
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

export default SettingsPage
