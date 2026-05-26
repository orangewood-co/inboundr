import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { MailPlusIcon, SaveIcon } from "lucide-react"
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
}

export default function AdminOrganizationPage() {
  const { id } = useParams({ from: "/admin/organizations/$id" })
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [loading, setLoading] = useState(true)

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
      if (!response.ok) throw new Error("Failed to send invitation")
      setInviteEmail("")
      toast.success("Invitation sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation")
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  if (loading || !organization) {
    return (
      <AppLayout>
        <SiteHeader title="Organization Admin" />
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <SiteHeader title={organization.name} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto grid max-w-5xl gap-6">
          <section className="rounded-2xl border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
                <p className="text-sm text-muted-foreground">Manage plan, entitlements, and invitations.</p>
              </div>
              <Badge>{organization.status}</Badge>
            </div>
            <Separator className="my-5" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={organization.status} onValueChange={(status: "active" | "suspended") => setOrganization({ ...organization, status })}>
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
          </section>

          <section className="rounded-2xl border bg-background p-5">
            <h2 className="font-semibold">Feature access</h2>
            <p className="text-sm text-muted-foreground">Overrides are saved per organization and enforced by the backend.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {features.map((feature) => {
                const planFeatures = plans.find((plan) => plan.slug === organization.entitlements.planSlug)?.features ?? []
                const enabled = (planFeatures.includes(feature.key) || organization.entitlements.enabledFeatures.includes(feature.key)) &&
                  !organization.entitlements.disabledFeatures.includes(feature.key)
                return (
                  <label key={feature.key} className="flex cursor-pointer gap-3 rounded-xl border p-4">
                    <Checkbox checked={enabled} onCheckedChange={(checked) => setFeatureEnabled(feature.key, checked === true)} />
                    <span>
                      <span className="block text-sm font-medium">{feature.label}</span>
                      <span className="text-xs text-muted-foreground">{feature.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          <form onSubmit={invite} className="rounded-2xl border bg-background p-5">
            <h2 className="font-semibold">Invite user</h2>
            <p className="text-sm text-muted-foreground">Send an invite into this organization.</p>
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
        </div>
      </main>
    </AppLayout>
  )
}
