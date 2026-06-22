import { useEffect, useMemo, useState } from "react"
import { useParams } from "@tanstack/react-router"
import {
  ArrowRightLeftIcon,
  BanIcon,
  Building2Icon,
  CrownIcon,
  EyeIcon,
  EyeOffIcon,
  MailPlusIcon,
  MoreVerticalIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { ProBadge } from "@/components/pro-badge"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_ORIGIN } from "@/lib/env"
import { formatDate } from "@/lib/format"

interface Feature {
  key: string
  label: string
  description: string
}

interface Plan {
  slug: string
  name: string
  features: string[]
}

interface OrganizationDetail {
  _id: string
  name: string
  status: "active" | "suspended"
  isPro: boolean
  entitlements: {
    planSlug: string
    enabledFeatures: string[]
    disabledFeatures: string[]
    effectiveFeatures: string[]
  }
  owner: { id: string; name: string; email: string } | null
  memberCount: number
  pendingInviteCount: number
  createdAt: string
}

interface OrganizationMember {
  _id: string
  userId: string
  role: "owner" | "admin" | "member"
  user: { name: string; email: string } | null
  createdAt: string
}

interface OrganizationInvitation {
  _id: string
  email: string
  role: "owner" | "admin" | "member"
  expiresAt: string
  createdAt: string
}

interface OrganizationSummary {
  members: number
  admins: number
  owners: number
  pendingInvites: number
}

interface AdminOrganizationOption {
  _id: string
  name: string
  status: "active" | "suspended"
  owner: { name: string; email: string } | null
}

type ConfirmAction =
  | { type: "remove-member"; member: OrganizationMember }
  | { type: "transfer-owner"; member: OrganizationMember }
  | { type: "cancel-invitation"; invitation: OrganizationInvitation }
  | { type: "status"; status: OrganizationDetail["status"] }

function RoleBadge({ role }: { role: OrganizationMember["role"] }) {
  const variant = role === "owner" ? "default" : role === "admin" ? "secondary" : "outline"
  return <Badge variant={variant} className="capitalize">{role}</Badge>
}

function SectionCard({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-background">
      <div className="flex items-start justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <Separator />
      <div className="p-5">{children}</div>
    </section>
  )
}

function SummaryPill({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <div className="truncate text-sm font-semibold">{value}</div>
        </div>
      </div>
    </div>
  )
}

export default function AdminOrganizationPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [organizations, setOrganizations] = useState<AdminOrganizationOption[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [summary, setSummary] = useState<OrganizationSummary>({ members: 0, admins: 0, owners: 0, pendingInvites: 0 })
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [moveTarget, setMoveTarget] = useState<OrganizationMember | null>(null)
  const [moveOrganizationId, setMoveOrganizationId] = useState("")
  const [moveRole, setMoveRole] = useState<Exclude<OrganizationMember["role"], "owner">>("member")
  const [moving, setMoving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [createName, setCreateName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createRole, setCreateRole] = useState("member")
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [loading, setLoading] = useState(true)
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.slug === organization?.entitlements.planSlug),
    [organization?.entitlements.planSlug, plans]
  )
  const targetOrganizations = useMemo(
    () => organizations.filter((item) => item._id !== id),
    [id, organizations]
  )
  const selectedMoveOrganization = useMemo(
    () => targetOrganizations.find((item) => item._id === moveOrganizationId) ?? null,
    [moveOrganizationId, targetOrganizations]
  )

  async function load() {
    setLoading(true)
    try {
      const [detailResponse, plansResponse, organizationsResponse] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}`, { credentials: "include" }),
        fetch(`${API_ORIGIN}/api/v1/admin/plans`, { credentials: "include" }),
        fetch(`${API_ORIGIN}/api/v1/admin/organizations`, { credentials: "include" }),
      ])
      if (!detailResponse.ok || !plansResponse.ok || !organizationsResponse.ok) throw new Error("Failed to load organization")
      const [detailData, planData, organizationsData] = await Promise.all([
        detailResponse.json(),
        plansResponse.json(),
        organizationsResponse.json(),
      ])
      setOrganization(detailData.organization)
      setMembers(detailData.members ?? [])
      setInvitations(detailData.invitations ?? [])
      setSummary(detailData.summary ?? { members: 0, admins: 0, owners: 0, pendingInvites: 0 })
      setPlans(planData.plans ?? [])
      setFeatures(planData.features ?? [])
      setOrganizations(organizationsData.organizations ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load organization")
    } finally {
      setLoading(false)
    }
  }

  function setFeatureEnabled(feature: string, enabled: boolean) {
    if (!organization) return
    setOrganization({
      ...organization,
      entitlements: {
        ...organization.entitlements,
        enabledFeatures: enabled
          ? [...new Set([...organization.entitlements.enabledFeatures, feature])]
          : organization.entitlements.enabledFeatures.filter((item) => item !== feature),
        disabledFeatures: enabled
          ? organization.entitlements.disabledFeatures.filter((item) => item !== feature)
          : [...new Set([...organization.entitlements.disabledFeatures, feature])],
      },
    })
  }

  async function save() {
    if (!organization) return
    setSaving(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organization.name,
          status: organization.status,
          isPro: organization.isPro,
          planSlug: organization.entitlements.planSlug,
          enabledFeatures: organization.entitlements.enabledFeatures,
          disabledFeatures: organization.entitlements.disabledFeatures,
        }),
      })
      if (!response.ok) throw new Error("Failed to save organization")
      toast.success("Organization updated")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save organization")
    } finally {
      setSaving(false)
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/invitations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to send invitation")
      }
      setInviteEmail("")
      toast.success("Invitation sent")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation")
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault()
    setCreatingUser(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          password: createPassword,
          role: createRole,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create account")
      }
      setCreateName("")
      setCreateEmail("")
      setCreatePassword("")
      setCreateRole("member")
      setShowCreatePassword(false)
      toast.success("Account created")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create account")
    } finally {
      setCreatingUser(false)
    }
  }

  async function updateMemberRole(member: OrganizationMember, role: OrganizationMember["role"]) {
    setBusyAction(member._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/members/${member._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to update member")
      }
      toast.success("Member role updated")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member")
    } finally {
      setBusyAction(null)
    }
  }

  async function removeMember(member: OrganizationMember) {
    setBusyAction(member._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/members/${member._id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to remove member")
      }
      toast.success("Member removed")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
    } finally {
      setBusyAction(null)
    }
  }

  async function transferOwner(member: OrganizationMember) {
    setBusyAction(member._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/members/${member._id}/transfer-owner`, {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to transfer owner")
      }
      toast.success("Owner transferred")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer owner")
    } finally {
      setBusyAction(null)
    }
  }

  async function cancelInvitation(invitation: OrganizationInvitation) {
    setBusyAction(invitation._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/invitations/${invitation._id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to cancel invitation")
      }
      toast.success("Invitation cancelled")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel invitation")
    } finally {
      setBusyAction(null)
    }
  }

  async function updateOrganizationStatus(status: OrganizationDetail["status"]) {
    if (!organization) return
    setSaving(true)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error(status === "suspended" ? "Failed to suspend organization" : "Failed to restore organization")
      toast.success(status === "suspended" ? "Organization suspended" : "Organization restored")
      setConfirmAction(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization")
    } finally {
      setSaving(false)
    }
  }

  function openMoveDialog(member: OrganizationMember) {
    setMoveTarget(member)
    setMoveRole(member.role === "admin" ? "admin" : "member")
    setMoveOrganizationId(targetOrganizations[0]?._id ?? "")
  }

  async function moveMember() {
    if (!moveTarget || !moveOrganizationId) return
    setMoving(true)
    setBusyAction(moveTarget._id)
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}/members/${moveTarget._id}/move`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetOrganizationId: moveOrganizationId, role: moveRole }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to move member")
      }
      toast.success("Member moved")
      setMoveTarget(null)
      setMoveOrganizationId("")
      setMoveRole("member")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move member")
    } finally {
      setMoving(false)
      setBusyAction(null)
    }
  }

  async function confirmCurrentAction() {
    const action = confirmAction
    if (!action) return
    if (action.type === "remove-member") await removeMember(action.member)
    if (action.type === "transfer-owner") await transferOwner(action.member)
    if (action.type === "cancel-invitation") await cancelInvitation(action.invitation)
    if (action.type === "status") await updateOrganizationStatus(action.status)
    if (action.type !== "status") setConfirmAction(null)
  }

  function confirmTitle(action: ConfirmAction | null) {
    if (!action) return ""
    if (action.type === "remove-member") return "Remove Member"
    if (action.type === "transfer-owner") return "Transfer Ownership"
    if (action.type === "cancel-invitation") return "Cancel Invitation"
    return action.status === "suspended" ? "Suspend Organization" : "Restore Organization"
  }

  function confirmDescription(action: ConfirmAction | null) {
    if (!action) return ""
    if (action.type === "remove-member") {
      return `Remove ${action.member.user?.email ?? action.member.userId} from this organization?`
    }
    if (action.type === "transfer-owner") {
      return `Transfer organization ownership to ${action.member.user?.email ?? action.member.userId}? The current owner will become an admin.`
    }
    if (action.type === "cancel-invitation") {
      return `Cancel the pending invitation for ${action.invitation.email}?`
    }
    return action.status === "suspended"
      ? "Suspend this organization? Members will lose access until it is restored."
      : "Restore this organization? Members will regain access to enabled features."
  }

  useEffect(() => {
    void load()
  }, [id])

  if (loading || !organization) {
    return (
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Super Admin", href: "/admin" }, { label: "Organization" }]} />
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Super Admin", href: "/admin" }, { label: organization.name }]} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto grid max-w-6xl gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
                {organization.isPro && <ProBadge />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Owner: {organization.owner?.email ?? "Pending owner"} · Created {formatDate(organization.createdAt)}
              </p>
            </div>
            <Badge variant={organization.status === "active" ? "default" : "destructive"} className="w-fit capitalize">
              {organization.status}
            </Badge>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            <SummaryPill title="Members" value={summary.members} icon={UsersIcon} />
            <SummaryPill title="Pending Invites" value={summary.pendingInvites} icon={MailPlusIcon} />
            <SummaryPill title="Plan" value={selectedPlan?.name ?? organization.entitlements.planSlug} icon={Building2Icon} />
            <SummaryPill title="Status" value={<span className="capitalize">{organization.status}</span>} icon={ShieldAlertIcon} />
          </section>

          <SectionCard title="Organization Details" description="Update identity and plan assignment for this tenant.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={organization.entitlements.planSlug} onValueChange={(planSlug) => setOrganization({ ...organization, entitlements: { ...organization.entitlements, planSlug } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => <SelectItem key={plan.slug} value={plan.slug}>{plan.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border p-4 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Pro organization</p>
                  <p className="text-xs text-muted-foreground">Shows a Pro badge across the app. Purely visual — does not change feature access.</p>
                </div>
                <Switch
                  checked={organization.isPro}
                  onCheckedChange={(isPro) => setOrganization({ ...organization, isPro })}
                  aria-label="Pro organization"
                />
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Owner</p>
                <p className="mt-1 text-sm font-medium">{organization.owner?.name || organization.owner?.email || "Pending owner"}</p>
                <p className="text-xs text-muted-foreground">{organization.owner?.email ?? "No owner has accepted the invitation yet."}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Organization Status</p>
                <p className="mt-1 text-sm font-medium capitalize">{organization.status}</p>
                <p className="text-xs text-muted-foreground">
                  {organization.status === "suspended"
                    ? "Access is suspended until this organization is restored."
                    : "Members can access enabled organization features."}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
                Save Changes
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Feature & Module Access"
            description={`Plan defaults from ${selectedPlan?.name ?? "the selected plan"} can be overridden per organization. Employee access can further narrow module availability.`}
            action={
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
                Save Changes
              </Button>
            }
          >
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {features.map((feature) => {
                const planFeatures = selectedPlan?.features ?? []
                const planDefault = planFeatures.includes(feature.key)
                const forcedOn = organization.entitlements.enabledFeatures.includes(feature.key)
                const forcedOff = organization.entitlements.disabledFeatures.includes(feature.key)
                const enabled = (planFeatures.includes(feature.key) || organization.entitlements.enabledFeatures.includes(feature.key)) &&
                  !organization.entitlements.disabledFeatures.includes(feature.key)
                return (
                  <label key={feature.key} className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-xl border p-4">
                    <Checkbox
                      className="mt-0.5"
                      checked={enabled}
                      onCheckedChange={(checked) => setFeatureEnabled(feature.key, checked === true)}
                    />
                    <span className="min-w-0">
                      <span className="flex min-h-5 flex-wrap items-center gap-2 text-sm font-medium leading-5">
                        {feature.label}
                        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
                        {planDefault && <Badge variant="outline">Plan Default</Badge>}
                        {forcedOn && <Badge variant="secondary">Override On</Badge>}
                        {forcedOff && <Badge variant="destructive">Override Off</Badge>}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{feature.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Members" description="Manage roles, move users, or transfer organization ownership.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member._id}>
                    <TableCell>
                      <div className="font-medium">{member.user?.name || member.user?.email || member.userId}</div>
                      <div className="text-xs text-muted-foreground">{member.user?.email ?? member.userId}</div>
                    </TableCell>
                    <TableCell>
                      {member.role === "owner" ? (
                        <RoleBadge role={member.role} />
                      ) : (
                        <Select value={member.role} onValueChange={(role: OrganizationMember["role"]) => void updateMemberRole(member, role)} disabled={busyAction === member._id}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {member.role === "owner" ? (
                        <span className="text-xs text-muted-foreground">Owner actions are restricted</span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Member actions" disabled={busyAction === member._id}>
                              <MoreVerticalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => openMoveDialog(member)}>
                              <ArrowRightLeftIcon />
                              Move User
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setConfirmAction({ type: "transfer-owner", member })}>
                              <CrownIcon />
                              Make Owner
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmAction({ type: "remove-member", member })}>
                              <UserMinusIcon />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard
            title="Create User Account"
            description="Provision a ready-to-use account for this organization. The user is created with a verified email and can sign in immediately with the password you set. No email is sent, so share the password with them directly."
          >
            <form onSubmit={createUser} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-name">Full name</Label>
                  <Input
                    id="create-user-name"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-email">Email</Label>
                  <Input
                    id="create-user-email"
                    type="email"
                    value={createEmail}
                    onChange={(event) => setCreateEmail(event.target.value)}
                    placeholder="jane@company.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="create-user-password"
                      type={showCreatePassword ? "text" : "password"}
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((value) => !value)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={showCreatePassword ? "Hide password" : "Show password"}
                    >
                      {showCreatePassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-user-role">Role</Label>
                  <Select value={createRole} onValueChange={setCreateRole}>
                    <SelectTrigger id="create-user-role" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner" disabled={members.some((member) => member.role === "owner")}>Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={creatingUser}>
                  {creatingUser ? <Spinner className="mr-2 size-4" /> : <UserPlusIcon className="mr-2 size-4" />}
                  Create Account
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Invitations" description="Invite users and cancel pending invitations before they are accepted.">
            <form onSubmit={invite}>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto]">
              <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="user@company.com" required />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">
                <MailPlusIcon className="mr-2 size-4" />
                Invite
              </Button>
            </div>
            </form>
            <Separator className="my-5" />
            {invitations.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No Pending Invitations
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation._id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell><RoleBadge role={invitation.role} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" disabled={busyAction === invitation._id} onClick={() => setConfirmAction({ type: "cancel-invitation", invitation })}>
                          <Trash2Icon className="mr-2 size-3.5" />
                          Cancel Invitation
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="Danger Zone"
            description="Suspend access without deleting organization data. Suspended organizations can be restored later."
          >
            <div className="flex flex-col gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold">
                  {organization.status === "suspended" ? "Restore Organization" : "Suspend Organization"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {organization.status === "suspended"
                    ? "Restore member access and re-enable active organization workflows."
                    : "Suspend this organization instead of deleting it. Data remains available for restoration."}
                </p>
              </div>
              <Button
                variant={organization.status === "suspended" ? "outline" : "destructive"}
                onClick={() => setConfirmAction({ type: "status", status: organization.status === "suspended" ? "active" : "suspended" })}
                disabled={saving}
              >
                {organization.status === "suspended" ? <RotateCcwIcon className="mr-2 size-4" /> : <BanIcon className="mr-2 size-4" />}
                {organization.status === "suspended" ? "Restore Organization" : "Suspend Organization"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </main>
      <Dialog open={Boolean(moveTarget)} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move User</DialogTitle>
            <DialogDescription>
              Move {moveTarget?.user?.email ?? moveTarget?.userId ?? "this user"} to another organization. Owners must be transferred before they can be moved.
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
                  {targetOrganizations.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMoveOrganization && (
                <p className="text-xs text-muted-foreground">
                  Owner: {selectedMoveOrganization.owner?.email ?? "Pending owner"} · Status: {selectedMoveOrganization.status}
                </p>
              )}
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
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moving}>
              Cancel
            </Button>
            <Button onClick={() => void moveMember()} disabled={!moveOrganizationId || moving}>
              {moving && <Spinner className="mr-2 size-4" />}
              Move User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle(confirmAction)}</DialogTitle>
            <DialogDescription>{confirmDescription(confirmAction)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={Boolean(busyAction) || saving}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === "status" && confirmAction.status === "active" ? "default" : "destructive"}
              onClick={() => void confirmCurrentAction()}
              disabled={Boolean(busyAction) || saving}
            >
              {(Boolean(busyAction) || saving) && <Spinner className="mr-2 size-4" />}
              {confirmTitle(confirmAction)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
