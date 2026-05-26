import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Building2Icon, CrownIcon, MailIcon, PlusIcon, RefreshCwIcon, SearchIcon, SendIcon, ShieldAlertIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

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

const emptySummary: AdminSummary = {
  total: 0,
  active: 0,
  suspended: 0,
  pendingOwner: 0,
  pendingInvites: 0,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
}

function planLabel(plans: Plan[], slug: string) {
  return plans.find((plan) => plan.slug === slug)?.name ?? slug.replaceAll("_", " ")
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
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [name, setName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [planSlug, setPlanSlug] = useState("all_features")

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.slug !== "all_features"), [plans])
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

  async function load() {
    setLoading(true)
    try {
      const [orgResponse, planResponse] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/admin/organizations`, { credentials: "include" }),
        fetch(`${API_ORIGIN}/api/v1/admin/plans`, { credentials: "include" }),
      ])
      if (!orgResponse.ok || !planResponse.ok) throw new Error("Failed to load admin data")
      const [orgData, planData] = await Promise.all([orgResponse.json(), planResponse.json()])
      setOrganizations(orgData.organizations ?? [])
      setSummary(orgData.summary ?? emptySummary)
      setPlans(planData.plans ?? [])
      setPlanSlug((planData.plans?.[0]?.slug as string | undefined) ?? "all_features")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard")
    } finally {
      setLoading(false)
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

  useEffect(() => {
    void load()
  }, [])

  return (
    <AppLayout>
      <SiteHeader title="Super Admin" />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <section className="overflow-hidden rounded-2xl border bg-background">
            <div className="relative p-6">
              <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_45%)]" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CrownIcon className="size-5" />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight">Control every tenant from one place.</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Create production organizations, invite owners, and assign feature access through plans and overrides.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void load()}>
                    <RefreshCwIcon className="mr-2 size-4" />
                    Refresh
                  </Button>
                  <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <PlusIcon className="mr-2 size-4" />
                        New organization
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create organization</DialogTitle>
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
                          {creating ? <Spinner className="mr-2 size-4" /> : <SendIcon className="mr-2 size-4" />}
                          Create and invite
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-5">
            <StatCard title="Organizations" value={summary.total} icon={Building2Icon} />
            <StatCard title="Active" value={summary.active} icon={UsersIcon} />
            <StatCard title="Suspended" value={summary.suspended} icon={ShieldAlertIcon} />
            <StatCard title="Pending owners" value={summary.pendingOwner} icon={CrownIcon} />
            <StatCard title="Pending invites" value={summary.pendingInvites} icon={MailIcon} />
          </section>

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
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
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
                        <Link className="font-medium hover:underline" to="/admin/organizations/$id" params={{ id: organization._id }}>
                          {organization.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{organization.owner?.email ?? "Owner pending"}</div>
                      </TableCell>
                      <TableCell className="capitalize">{planLabel(plans, organization.entitlements.planSlug)}</TableCell>
                      <TableCell>
                        <div className="flex max-w-72 flex-wrap gap-1">
                          {organization.entitlements.effectiveFeatures.map((feature) => (
                            <Badge key={feature} variant="secondary" className="capitalize">{feature}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{organization.memberCount} members</div>
                        <div className="text-xs text-muted-foreground">{organization.pendingInviteCount} invites</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={organization.status === "active" ? "default" : "destructive"}>{organization.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(organization.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  )
}
