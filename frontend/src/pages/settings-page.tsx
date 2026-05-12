import { type CSSProperties, useCallback, useEffect, useState } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
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

const MOCK_MEMBERS = [
  { name: "Tushar Gaurav", email: "tushar@btsa.dev", role: "Owner" as const, avatar: "T" },
  { name: "Priya Sharma", email: "priya@btsa.dev", role: "Admin" as const, avatar: "P" },
  { name: "Rahul Verma", email: "rahul@btsa.dev", role: "Member" as const, avatar: "R" },
  { name: "Ananya Patel", email: "ananya@btsa.dev", role: "Member" as const, avatar: "A" },
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
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Members"
        description="Manage your team members and their roles."
        action={
          <Button className="gap-1.5">
            <PlusIcon className="size-4" />
            Invite Member
          </Button>
        }
      />

      <SettingsCard title="Team Members" description={`${MOCK_MEMBERS.length} members in your workspace.`}>
        <div className="divide-y">
          {MOCK_MEMBERS.map((member) => (
            <div key={member.email} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {member.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={member.role} />
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                  <EllipsisVerticalIcon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Pending Invitations" description="Invitations that haven't been accepted yet.">
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
              </TabsList>

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
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default SettingsPage
