import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { BellRingIcon, Building2Icon, CrownIcon, MailIcon, PlusIcon, RefreshCwIcon, SearchIcon, SendIcon, ShieldAlertIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { ProBadge } from "@/components/pro-badge"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_ORIGIN } from "@/lib/env"
import { formatDate, formatDateTime } from "@/lib/format"

interface Plan {
  slug: string
  name: string
  description: string
  features: string[]
}

interface AdminOrganization {
  _id: string
  name: string
  status: "active" | "suspended"
  isPro: boolean
  memberCount: number
  owner: { name: string; email: string } | null
  entitlements: {
    planSlug: string
    effectiveFeatures: string[]
  }
  pendingInviteCount: number
  createdAt: string
}

interface AdminSummary {
  total: number
  active: number
  suspended: number
  pendingOwner: number
  pendingInvites: number
}

interface AdminUserMembership {
  _id: string
  organizationId: string
  userId: string
  role: "owner" | "admin" | "member"
  createdAt: string
  organization: {
    _id: string
    name: string
    status: "active" | "suspended"
    ownerUserId: string
  } | null
}

interface AdminUser {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean | null
  lastSignInAt: string | null
  createdAt: string
  memberships: AdminUserMembership[]
}

interface AdminNotificationMember {
  _id: string
  userId: string
  role: "owner" | "admin" | "member"
  user: { id: string; name: string; email: string } | null
}

interface AdminUsersPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AdminUsersSummary {
  total: number
  matching: number
  withMemberships: number
  withoutMemberships: number
}

const emptySummary: AdminSummary = {
  total: 0,
  active: 0,
  suspended: 0,
  pendingOwner: 0,
  pendingInvites: 0,
}

const emptyUsersSummary: AdminUsersSummary = {
  total: 0,
  matching: 0,
  withMemberships: 0,
  withoutMemberships: 0,
}

const emptyUsersPagination: AdminUsersPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
}

function formatLastSignIn(value?: string | null) {
  const formatted = formatDateTime(value)
  return formatted === "-" ? "Never recorded" : formatted
}

function getInitials(value?: string | null) {
  const fallback = value?.trim() || "User"
  return fallback
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
}

function directImageUrl(value?: string | null) {
  const source = value?.trim() ?? ""
  return /^https?:\/\//i.test(source) || source.startsWith("data:") || source.startsWith("blob:") ? source : undefined
}

function isCanonicalOwnerMembership(membership: AdminUserMembership) {
  return Boolean(membership.organization && membership.organization.ownerUserId === membership.userId)
}

function planLabel(plans: Plan[], slug: string) {
  return plans.find((plan) => plan.slug === slug)?.name ?? slug.replaceAll("_", " ")
}

function featureLabel(feature: string) {
  if (feature === "rfq") return "RFQ"
  return feature.charAt(0).toUpperCase() + feature.slice(1)
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  )
}

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const [usersSummary, setUsersSummary] = useState<AdminUsersSummary>(emptyUsersSummary)
  const [usersPagination, setUsersPagination] = useState<AdminUsersPagination>(emptyUsersPagination)
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [search, setSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [userPage, setUserPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [name, setName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [planSlug, setPlanSlug] = useState("all_features")
  const [membershipOrganizationId, setMembershipOrganizationId] = useState("")
  const [membershipRole, setMembershipRole] = useState<"admin" | "member">("member")
  const [membershipBusy, setMembershipBusy] = useState<string | null>(null)
  const [moveMembership, setMoveMembership] = useState<AdminUserMembership | null>(null)
  const [moveOrganizationId, setMoveOrganizationId] = useState("")
  const [moveRole, setMoveRole] = useState<"admin" | "member">("member")
  const [sampleOrganizationId, setSampleOrganizationId] = useState("")
  const [sampleMembers, setSampleMembers] = useState<AdminNotificationMember[]>([])
  const [sampleRecipientUserId, setSampleRecipientUserId] = useState("")
  const [sampleTitle, setSampleTitle] = useState("Sample Notification")
  const [sampleBody, setSampleBody] = useState("This is a sample in-app notification from Super Admin.")
  const [sampleActionUrl, setSampleActionUrl] = useState("/")
  const [sampleMembersLoading, setSampleMembersLoading] = useState(false)
  const [sampleSending, setSampleSending] = useState(false)

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.slug !== "all_features"), [plans])
  const membershipOrganizationOptions = useMemo(
    () => organizations.filter((organization) => !selectedUser?.memberships.some((membership) => membership.organizationId === organization._id)),
    [organizations, selectedUser?.memberships]
  )
  const moveOrganizationOptions = useMemo(
    () => organizations.filter((organization) => organization._id !== moveMembership?.organizationId),
    [moveMembership?.organizationId, organizations]
  )
  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return organizations.filter((organization) => {
      const matchesSearch = !query ||
        organization.name.toLowerCase().includes(query) ||
        (organization.owner?.email ?? "").toLowerCase().includes(query)
      const matchesStatus = statusFilter === "all" || organization.status === statusFilter
      const matchesPlan = planFilter === "all" || organization.entitlements.planSlug === planFilter
      return matchesSearch && matchesStatus && matchesPlan
    })
  }, [organizations, planFilter, search, statusFilter])

  function syncSelectedUser(nextUsers: AdminUser[]) {
    if (!selectedUser) return
    const nextSelectedUser = nextUsers.find((user) => user.id === selectedUser.id)
    if (nextSelectedUser) setSelectedUser(nextSelectedUser)
  }

  function updateUserMemberships(userId: string, updater: (memberships: AdminUserMembership[]) => AdminUserMembership[]) {
    setUsers((current) => {
      const next = current.map((user) =>
        user.id === userId ? { ...user, memberships: updater(user.memberships) } : user
      )
      return next
    })
    setSelectedUser((current) =>
      current && current.id === userId ? { ...current, memberships: updater(current.memberships) } : current
    )
  }

  async function loadUsers(page = userPage, query = userSearch) {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(usersPagination.limit),
      })
      if (query.trim()) params.set("q", query.trim())
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/users?${params.toString()}`, { credentials: "include" })
      if (!response.ok) throw new Error("Failed to load users")
      const data = await response.json()
      const nextUsers = data.users ?? []
      setUsers(nextUsers)
      setUsersPagination(data.pagination ?? emptyUsersPagination)
      setUsersSummary(data.summary ?? emptyUsersSummary)
      syncSelectedUser(nextUsers)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const [orgResponse, planResponse] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/admin/organizations`, { credentials: "include" }),
        fetch(`${API_ORIGIN}/api/v1/admin/plans`, { credentials: "include" }),
      ])
      if (!orgResponse.ok || !planResponse.ok) throw new Error("Failed to load admin data")
      const [orgData, planData] = await Promise.all([orgResponse.json(), planResponse.json()])
      const nextOrganizations = orgData.organizations ?? []
      setOrganizations(nextOrganizations)
      setSummary(orgData.summary ?? emptySummary)
      setPlans(planData.plans ?? [])
      setPlanSlug((planData.plans?.[0]?.slug as string | undefined) ?? "all_features")
      setSampleOrganizationId((current) => current || nextOrganizations[0]?._id || "")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard")
    } finally {
      setLoading(false)
    }
  }

  async function loadSampleMembers(organizationId: string) {
    if (!organizationId) {
      setSampleMembers([])
      setSampleRecipientUserId("")
      return
    }

    setSampleMembersLoading(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${organizationId}`, { credentials: "include" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to load organization members")
      const nextMembers: AdminNotificationMember[] = data.members ?? []
      setSampleMembers(nextMembers)
      setSampleRecipientUserId((current) =>
        nextMembers.some((member) => member.userId === current) ? current : nextMembers[0]?.userId ?? ""
      )
    } catch (error) {
      setSampleMembers([])
      setSampleRecipientUserId("")
      toast.error(error instanceof Error ? error.message : "Failed to load notification recipients")
    } finally {
      setSampleMembersLoading(false)
    }
  }

  async function sendSampleNotification(event: React.FormEvent) {
    event.preventDefault()
    if (!sampleOrganizationId || !sampleRecipientUserId) return

    setSampleSending(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/notifications/sample`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: sampleOrganizationId,
          recipientUserId: sampleRecipientUserId,
          title: sampleTitle,
          body: sampleBody,
          actionUrl: sampleActionUrl,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to send sample notification")
      toast.success(data.message ?? "Sample notification sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send sample notification")
    } finally {
      setSampleSending(false)
    }
  }

  async function createOrganization(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ownerEmail, planSlug }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create organization")
      }
      setName("")
      setOwnerEmail("")
      setCreateOpen(false)
      toast.success(ownerEmail ? "Organization created and owner invited" : "Organization created")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization")
    } finally {
      setCreating(false)
    }
  }

  async function addMembership() {
    if (!selectedUser || !membershipOrganizationId) return
    setMembershipBusy("add")
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/users/${encodeURIComponent(selectedUser.id)}/memberships`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: membershipOrganizationId, role: membershipRole }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to add membership")
      }
      const data = await response.json()
      updateUserMemberships(selectedUser.id, (memberships) => [...memberships, data.member])
      setMembershipOrganizationId("")
      setMembershipRole("member")
      toast.success("Membership added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add membership")
    } finally {
      setMembershipBusy(null)
    }
  }

  async function updateMembershipRole(membership: AdminUserMembership, role: "admin" | "member") {
    if (!selectedUser) return
    setMembershipBusy(membership._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${membership.organizationId}/members/${membership._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to update membership")
      }
      updateUserMemberships(selectedUser.id, (memberships) =>
        memberships.map((item) => item._id === membership._id ? { ...item, role } : item)
      )
      toast.success("Membership updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update membership")
    } finally {
      setMembershipBusy(null)
    }
  }

  async function removeMembership(membership: AdminUserMembership) {
    if (!selectedUser) return
    setMembershipBusy(membership._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${membership.organizationId}/members/${membership._id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to remove membership")
      }
      updateUserMemberships(selectedUser.id, (memberships) => memberships.filter((item) => item._id !== membership._id))
      toast.success("Membership removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove membership")
    } finally {
      setMembershipBusy(null)
    }
  }

  function openMoveMembership(membership: AdminUserMembership) {
    setMoveMembership(membership)
    setMoveRole(membership.role === "admin" ? "admin" : "member")
    setMoveOrganizationId(organizations.find((organization) => organization._id !== membership.organizationId)?._id ?? "")
  }

  async function moveSelectedMembership() {
    if (!selectedUser || !moveMembership || !moveOrganizationId) return
    setMembershipBusy(moveMembership._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${moveMembership.organizationId}/members/${moveMembership._id}/move`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOrganizationId: moveOrganizationId, role: moveRole }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to move membership")
      }
      const data = await response.json()
      updateUserMemberships(selectedUser.id, (memberships) =>
        memberships.map((item) => item._id === moveMembership._id ? data.member : item)
      )
      setMoveMembership(null)
      setMoveOrganizationId("")
      setMoveRole("member")
      toast.success("Membership moved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move membership")
    } finally {
      setMembershipBusy(null)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    void loadSampleMembers(sampleOrganizationId)
  }, [sampleOrganizationId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadUsers(userPage, userSearch)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [userPage, userSearch])

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Super Admin" }]} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <PageHeader
            title="Super Admin"
            description="Create production organizations, invite owners, and assign feature access through plans and overrides."
            actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { void load(); void loadUsers() }}>
                <RefreshCwIcon className="mr-2 size-4" />
                Refresh
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusIcon className="mr-2 size-4" />
                    New Organization
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                      Create a tenant and optionally send an owner invitation.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={createOrganization} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization name</Label>
                      <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-email">Owner email</Label>
                      <Input id="owner-email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="founder@company.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select value={planSlug} onValueChange={setPlanSlug}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {(visiblePlans.length ? visiblePlans : plans).map((plan) => (
                            <SelectItem key={plan.slug} value={plan.slug}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" type="submit" disabled={creating}>
                      {creating ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-2 size-4" />}
                      Create and Invite
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            }
          />

          <section className="grid gap-4 md:grid-cols-5">
            <StatCard title="Organizations" value={summary.total} icon={Building2Icon} />
            <StatCard title="Active" value={summary.active} icon={UsersIcon} />
            <StatCard title="Suspended" value={summary.suspended} icon={ShieldAlertIcon} />
            <StatCard title="Pending Owners" value={summary.pendingOwner} icon={CrownIcon} />
            <StatCard title="Pending Invites" value={summary.pendingInvites} icon={MailIcon} />
          </section>

          <section className="rounded-2xl border bg-background p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <BellRingIcon className="size-4" />
                  </div>
                  <h2 className="font-semibold">Send Sample Notification</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Send an in-app notification to an organization member to validate the notification pipeline.
                </p>
              </div>
              <form onSubmit={sendSampleNotification} className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={sampleOrganizationId} onValueChange={setSampleOrganizationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((organization) => (
                        <SelectItem key={organization._id} value={organization._id}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Select
                    value={sampleRecipientUserId}
                    onValueChange={setSampleRecipientUserId}
                    disabled={sampleMembersLoading || sampleMembers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={sampleMembersLoading ? "Loading members" : "Select member"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleMembers.map((member) => (
                        <SelectItem key={member._id} value={member.userId}>
                          {member.user?.email || member.user?.name || member.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sample-title">Title</Label>
                  <Input
                    id="sample-title"
                    value={sampleTitle}
                    onChange={(event) => setSampleTitle(event.target.value)}
                    placeholder="Sample Notification"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sample-action-url">Action URL</Label>
                  <Input
                    id="sample-action-url"
                    value={sampleActionUrl}
                    onChange={(event) => setSampleActionUrl(event.target.value)}
                    placeholder="/"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="sample-body">Body</Label>
                  <Input
                    id="sample-body"
                    value={sampleBody}
                    onChange={(event) => setSampleBody(event.target.value)}
                    placeholder="Write a short message"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 lg:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    {sampleMembers.length === 0 && !sampleMembersLoading
                      ? "Select an organization with at least one member."
                      : "The selected recipient should see this in the bell immediately."}
                  </p>
                  <Button
                    type="submit"
                    disabled={!sampleOrganizationId || !sampleRecipientUserId || sampleSending}
                  >
                    {sampleSending ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-2 size-4" />}
                    Send Sample
                  </Button>
                </div>
              </form>
            </div>
          </section>

          <Tabs defaultValue="organizations" className="gap-4">
            <TabsList>
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
            </TabsList>

            <TabsContent value="organizations" className="mt-0">
              <section className="rounded-2xl border bg-background">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold">Organizations</h2>
                    <p className="text-sm text-muted-foreground">Filter tenants by owner, status, and plan.</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_150px_170px]">
                    <div className="relative">
                      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or owner" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Plans</SelectItem>
                        {plans.map((plan) => (
                          <SelectItem key={plan.slug} value={plan.slug}>{plan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                {loading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5">Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Features</TableHead>
                        <TableHead>People</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrganizations.map((organization) => (
                        <TableRow key={organization._id}>
                          <TableCell className="pl-5">
                            <div className="flex items-center gap-2">
                              <Link className="font-medium hover:underline" to="/admin/organizations/$id" params={{ id: organization._id }}>
                                {organization.name}
                              </Link>
                              {organization.isPro && <ProBadge />}
                            </div>
                            <div className="text-xs text-muted-foreground">{organization.owner?.email ?? "Owner pending"}</div>
                          </TableCell>
                          <TableCell className="capitalize">{planLabel(plans, organization.entitlements.planSlug)}</TableCell>
                          <TableCell>
                            <div className="flex max-w-72 flex-wrap gap-1">
                              {organization.entitlements.effectiveFeatures.map((feature) => (
                                <Badge key={feature} variant="secondary">{featureLabel(feature)}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{organization.memberCount} members</div>
                            <div className="text-xs text-muted-foreground">{organization.pendingInviteCount} invites</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={organization.status === "active" ? "default" : "destructive"} className="capitalize">{organization.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(organization.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </section>
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <section className="rounded-2xl border bg-background">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold">Users</h2>
                    <p className="text-sm text-muted-foreground">
                      {usersSummary.matching} matching users · {usersSummary.withMemberships} with memberships
                    </p>
                  </div>
                  <div className="relative w-full max-w-sm">
                    <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={userSearch}
                      onChange={(event) => {
                        setUserPage(1)
                        setUserSearch(event.target.value)
                      }}
                      placeholder="Search name, email, or ID"
                    />
                  </div>
                </div>
                <Separator />
                {usersLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-5">User</TableHead>
                          <TableHead>Memberships</TableHead>
                          <TableHead>Last Signed In</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="pl-5">
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={directImageUrl(user.image)} alt={user.name || user.email || "User"} />
                                  <AvatarFallback>{getInitials(user.name || user.email)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{user.name || user.email || user.id}</div>
                                  <div className="text-xs text-muted-foreground">{user.email || user.id}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-80 flex-wrap gap-1">
                                {user.memberships.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No memberships</span>
                                ) : user.memberships.slice(0, 3).map((membership) => (
                                  <Badge key={membership._id} variant="secondary">
                                    {membership.organization?.name ?? "Unknown Organization"}
                                  </Badge>
                                ))}
                                {user.memberships.length > 3 && (
                                  <Badge variant="outline">+{user.memberships.length - 3}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatLastSignIn(user.lastSignInAt)}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                                Manage Memberships
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {usersPagination.page} of {usersPagination.totalPages} · {usersPagination.total} users
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                          disabled={usersPagination.page <= 1 || usersLoading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage((page) => Math.min(usersPagination.totalPages, page + 1))}
                          disabled={usersPagination.page >= usersPagination.totalPages || usersLoading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null)
          setMoveMembership(null)
          setMembershipOrganizationId("")
          setMembershipRole("member")
        }
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Memberships</DialogTitle>
            <DialogDescription>
              Manage organization access for {selectedUser?.email || selectedUser?.id || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedUser?.memberships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No Memberships
                      </TableCell>
                    </TableRow>
                  ) : selectedUser?.memberships.map((membership) => (
                    <TableRow key={membership._id}>
                      <TableCell>
                        <div className="font-medium">{membership.organization?.name ?? "Unknown Organization"}</div>
                        <div className="text-xs text-muted-foreground">{membership.organizationId}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={membership.organization?.status === "suspended" ? "destructive" : "default"} className="capitalize">
                          {membership.organization?.status ?? "active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {membership.role === "owner" ? (
                          <Badge>Owner</Badge>
                        ) : (
                          <Select
                            value={membership.role}
                            onValueChange={(role) => void updateMembershipRole(membership, role as "admin" | "member")}
                            disabled={membershipBusy === membership._id}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openMoveMembership(membership)}
                            disabled={isCanonicalOwnerMembership(membership) || membershipBusy === membership._id}
                          >
                            Move User
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void removeMembership(membership)}
                            disabled={isCanonicalOwnerMembership(membership) || membershipBusy === membership._id}
                          >
                            Remove Member
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Add to Organization</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add this user to an existing organization with a selected role.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <Select value={membershipOrganizationId} onValueChange={setMembershipOrganizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {membershipOrganizationOptions.map((organization) => (
                      <SelectItem key={organization._id} value={organization._id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={membershipRole} onValueChange={(role) => setMembershipRole(role as "admin" | "member")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => void addMembership()} disabled={!membershipOrganizationId || membershipBusy === "add"}>
                  {membershipBusy === "add" && <Spinner data-icon="inline-start" />}
                  Add Membership
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveMembership)} onOpenChange={(open) => !open && setMoveMembership(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move User</DialogTitle>
            <DialogDescription>
              Move this membership to another organization. Owner memberships cannot be moved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Target organization</Label>
              <Select value={moveOrganizationId} onValueChange={setMoveOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {moveOrganizationOptions.map((organization) => (
                    <SelectItem key={organization._id} value={organization._id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target role</Label>
              <Select value={moveRole} onValueChange={(role) => setMoveRole(role as "admin" | "member")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveMembership(null)} disabled={Boolean(membershipBusy)}>
              Cancel
            </Button>
            <Button onClick={() => void moveSelectedMembership()} disabled={!moveOrganizationId || Boolean(membershipBusy)}>
              {membershipBusy && <Spinner data-icon="inline-start" />}
              Move User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
