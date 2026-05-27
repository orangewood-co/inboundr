import { useEffect, useMemo, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { CrownIcon, MailPlusIcon, SaveIcon, ShieldAlertIcon, Trash2Icon, UserMinusIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
}

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

export default function AdminOrganizationPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [summary, setSummary] = useState<OrganizationSummary>({ members: 0, admins: 0, owners: 0, pendingInvites: 0 })
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [loading, setLoading] = useState(true)
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.slug === organization?.entitlements.planSlug),
    [organization?.entitlements.planSlug, plans]
  )

  function setOrganizationStatus(status: "active" | "suspended") {
    if (!organization) return
    if (status === "suspended" && organization.status !== "suspended") {
      const confirmed = window.confirm("Suspend this organization? Members will lose access to gated feature routes.")
      if (!confirmed) return
    }
    setOrganization({ ...organization, status })
  }

  async function load() {
    setLoading(true)
    try {
      const [detailResponse, plansResponse] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/admin/organizations/${id}`, { credentials: "include" }),
        fetch(`${API_ORIGIN}/api/v1/admin/plans`, { credentials: "include" }),
      ])
      if (!detailResponse.ok || !plansResponse.ok) throw new Error("Failed to load organization")
      const [detailData, planData] = await Promise.all([detailResponse.json(), plansResponse.json()])
      setOrganization(detailData.organization)
      setMembers(detailData.members ?? [])
      setInvitations(detailData.invitations ?? [])
      setSummary(detailData.summary ?? { members: 0, admins: 0, owners: 0, pendingInvites: 0 })
      setPlans(planData.plans ?? [])
      setFeatures(planData.features ?? [])
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
    if (!window.confirm(`Remove ${member.user?.email ?? member.userId} from this organization?`)) return
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
    if (!window.confirm(`Transfer organization ownership to ${member.user?.email ?? member.userId}?`)) return
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
    if (!window.confirm(`Cancel invitation for ${invitation.email}?`)) return
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
          <section className="rounded-2xl border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Owner: {organization.owner?.email ?? "Pending owner"} · Created {formatDate(organization.createdAt)}
                </p>
              </div>
              <Badge variant={organization.status === "active" ? "default" : "destructive"}>{organization.status}</Badge>
            </div>
            <Separator className="my-5" />
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border p-4">
                <UsersIcon className="mb-3 size-4 text-muted-foreground" />
                <div className="text-2xl font-semibold">{summary.members}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
              <div className="rounded-xl border p-4">
                <CrownIcon className="mb-3 size-4 text-muted-foreground" />
                <div className="text-2xl font-semibold">{summary.admins}</div>
                <div className="text-xs text-muted-foreground">Admins</div>
              </div>
              <div className="rounded-xl border p-4">
                <MailPlusIcon className="mb-3 size-4 text-muted-foreground" />
                <div className="text-2xl font-semibold">{summary.pendingInvites}</div>
                <div className="text-xs text-muted-foreground">Pending invites</div>
              </div>
              <div className="rounded-xl border p-4">
                <ShieldAlertIcon className="mb-3 size-4 text-muted-foreground" />
                <div className="text-2xl font-semibold capitalize">{organization.status}</div>
                <div className="text-xs text-muted-foreground">Organization status</div>
              </div>
            </div>
          </section>

          <SectionCard title="Organization settings" description="Update identity, status, and the assigned plan.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={organization.status} onValueChange={(status: "active" | "suspended") => setOrganizationStatus(status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
                Save changes
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Feature access" description={`Plan defaults from ${selectedPlan?.name ?? "the selected plan"} can be overridden per organization.`}>
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
                        {planDefault && <Badge variant="outline">Plan default</Badge>}
                        {forcedOn && <Badge variant="secondary">Override on</Badge>}
                        {forcedOff && <Badge variant="destructive">Override off</Badge>}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{feature.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Members" description="Manage roles, remove members, or transfer organization ownership.">
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
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" disabled={member.role === "owner" || busyAction === member._id} onClick={() => void transferOwner(member)}>
                          <CrownIcon className="mr-2 size-3.5" />
                          Make owner
                        </Button>
                        <Button variant="outline" size="sm" disabled={member.role === "owner" || busyAction === member._id} onClick={() => void removeMember(member)}>
                          <UserMinusIcon className="mr-2 size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                No pending invitations.
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
                        <Button variant="outline" size="sm" disabled={busyAction === invitation._id} onClick={() => void cancelInvitation(invitation)}>
                          <Trash2Icon className="mr-2 size-3.5" />
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
      </main>
    </AppLayout>
  )
}
