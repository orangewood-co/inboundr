import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Building2Icon, CrownIcon, RefreshCwIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  createdAt: string
}

export default function AdminPage() {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [planSlug, setPlanSlug] = useState("all_features")

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.slug !== "all_features"), [plans])

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
                <Button variant="outline" onClick={() => void load()}>
                  <RefreshCwIcon className="mr-2 size-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form onSubmit={createOrganization} className="rounded-2xl border bg-background p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Building2Icon className="size-4" />
                </div>
                <div>
                  <h2 className="font-semibold">New organization</h2>
                  <p className="text-sm text-muted-foreground">Create a tenant and optionally invite its owner.</p>
                </div>
              </div>
              <Separator className="my-5" />
              <div className="space-y-4">
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
              </div>
            </form>

            <div className="rounded-2xl border bg-background">
              <div className="flex items-center justify-between p-5">
                <div>
                  <h2 className="font-semibold">Organizations</h2>
                  <p className="text-sm text-muted-foreground">Plan, feature, and membership overview.</p>
                </div>
                <Badge variant="secondary">{organizations.length} total</Badge>
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
                      <TableHead>Name</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((organization) => (
                      <TableRow key={organization._id}>
                        <TableCell>
                          <Link className="font-medium hover:underline" to="/admin/organizations/$id" params={{ id: organization._id }}>
                            {organization.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{organization.owner?.email ?? "Owner pending"}</div>
                        </TableCell>
                        <TableCell>{organization.entitlements.planSlug}</TableCell>
                        <TableCell>{organization.entitlements.effectiveFeatures.join(", ")}</TableCell>
                        <TableCell>{organization.memberCount}</TableCell>
                        <TableCell>
                          <Badge variant={organization.status === "active" ? "default" : "secondary"}>{organization.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        </div>
      </main>
    </AppLayout>
  )
}
