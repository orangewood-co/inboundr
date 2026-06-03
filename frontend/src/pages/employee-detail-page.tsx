import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  CameraIcon,
  DownloadIcon,
  ExternalLinkIcon,
  IdCardIcon,
  MapPinIcon,
  LinkIcon,
  MailIcon,
  PhoneIcon,
  SaveIcon,
  SendIcon,
  ShieldCheckIcon,
  UploadIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { AvatarCropDialog, type AvatarCropResult } from "@/components/avatar-crop-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { EmployeeAccessModule } from "@/lib/entitlements"
import { resolveUploadedImageUrl, uploadCroppedEmployeeImage } from "@/lib/uploaded-image"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/employees`
const ORGANIZATION_API = `${API_ORIGIN}/api/v1/organization`

type EmployeeStatus = "active" | "inactive" | "terminated" | "archived"

interface EmployeeTeam {
  _id: string
  name: string
  description: string | null
  defaultModules: EmployeeAccessModule[]
  employeeCount?: number
}

interface Employee {
  _id: string
  organizationMemberId: string | null
  teamId: string | null
  team: EmployeeTeam | null
  employeeCode: string | null
  fullName: string
  email: string
  phone: string | null
  title: string | null
  profileImageUrl: string | null
  status: EmployeeStatus
  startDate: string | null
  socials: {
    linkedinUrl: string | null
    instagramUrl: string | null
  }
  address: {
    line1: string
    line2: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  emergencyContact: {
    name: string
    relationship: string
    phone: string
    email: string
  }
  platformAccess: {
    enabled: boolean
    allowedModules: EmployeeAccessModule[]
    restrictedModules: EmployeeAccessModule[]
    invitedEmail: string | null
    lastInvitedAt: string | null
  }
  createdAt: string
  updatedAt: string
}

interface EmployeeDocument {
  _id: string
  type: "id_card" | "proof_of_employment"
  title: string
  issuedAt: string
  createdAt: string
}

interface OrganizationMember {
  _id: string
  role: "owner" | "admin" | "member"
  userName: string | null
  userEmail: string | null
}

type EmployeeFormState = {
  fullName: string
  email: string
  phone: string
  title: string
  employeeCode: string
  profileImageUrl: string
  teamId: string
  status: EmployeeStatus
  startDate: string
  linkedinUrl: string
  instagramUrl: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressState: string
  addressPostalCode: string
  addressCountry: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  emergencyEmail: string
  accessEnabled: boolean
  allowedModules: EmployeeAccessModule[]
}

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  terminated: "Terminated",
  archived: "Archived",
}

const documentTypes = ["id_card", "proof_of_employment"] as const
const employeePhotoTypes = ["image/png", "image/jpeg", "image/webp"]
const maxEmployeePhotoSourceSize = 10 * 1024 * 1024

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IN"
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function documentTimestamp(document: EmployeeDocument) {
  const issuedAt = new Date(document.issuedAt ?? "").getTime()
  if (Number.isFinite(issuedAt)) return issuedAt
  const createdAt = new Date(document.createdAt ?? "").getTime()
  return Number.isFinite(createdAt) ? createdAt : 0
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

function employeeAddressLines(address?: Employee["address"] | null) {
  if (!address) return []
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ")
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean)
}

function employeeToForm(employee: Employee): EmployeeFormState {
  return {
    fullName: employee.fullName ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    title: employee.title ?? "",
    employeeCode: employee.employeeCode ?? "",
    profileImageUrl: employee.profileImageUrl ?? "",
    teamId: employee.teamId ?? "none",
    status: employee.status ?? "active",
    startDate: employee.startDate ? employee.startDate.slice(0, 10) : "",
    linkedinUrl: employee.socials?.linkedinUrl ?? "",
    instagramUrl: employee.socials?.instagramUrl ?? "",
    addressLine1: employee.address?.line1 ?? "",
    addressLine2: employee.address?.line2 ?? "",
    addressCity: employee.address?.city ?? "",
    addressState: employee.address?.state ?? "",
    addressPostalCode: employee.address?.postalCode ?? "",
    addressCountry: employee.address?.country ?? "",
    emergencyName: employee.emergencyContact?.name ?? "",
    emergencyRelationship: employee.emergencyContact?.relationship ?? "",
    emergencyPhone: employee.emergencyContact?.phone ?? "",
    emergencyEmail: employee.emergencyContact?.email ?? "",
    accessEnabled: employee.platformAccess?.enabled ?? false,
    allowedModules: employee.platformAccess?.allowedModules ?? [],
  }
}

function formToPayload(form: EmployeeFormState) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim() || null,
    title: form.title.trim() || null,
    employeeCode: form.employeeCode.trim() || null,
    profileImageUrl: form.profileImageUrl.trim() || null,
    teamId: form.teamId === "none" ? null : form.teamId,
    status: form.status,
    startDate: form.startDate || null,
    socials: {
      linkedinUrl: form.linkedinUrl.trim() || null,
      instagramUrl: form.instagramUrl.trim() || null,
    },
    address: {
      line1: form.addressLine1.trim(),
      line2: form.addressLine2.trim(),
      city: form.addressCity.trim(),
      state: form.addressState.trim(),
      postalCode: form.addressPostalCode.trim(),
      country: form.addressCountry.trim(),
    },
    emergencyContact: {
      name: form.emergencyName.trim(),
      relationship: form.emergencyRelationship.trim(),
      phone: form.emergencyPhone.trim(),
      email: form.emergencyEmail.trim().toLowerCase(),
    },
    platformAccess: {
      enabled: form.accessEnabled,
      allowedModules: form.allowedModules,
      restrictedModules: [],
    },
  }
}

function toggleModule(
  modules: EmployeeAccessModule[],
  module: EmployeeAccessModule,
  checked: boolean
) {
  if (checked) return [...new Set([...modules, module])]
  return modules.filter((item) => item !== module)
}

function ModuleChecklist({
  modules,
  value,
  onChange,
}: {
  modules: { key: EmployeeAccessModule; label: string }[]
  value: EmployeeAccessModule[]
  onChange: (modules: EmployeeAccessModule[]) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {modules.map((module) => (
        <label
          key={module.key}
          className="flex items-center gap-2 rounded-xl border bg-background/60 px-3 py-2 text-sm"
        >
          <Checkbox
            checked={value.includes(module.key)}
            onCheckedChange={(checked) => onChange(toggleModule(value, module.key, checked === true))}
          />
          <span>{module.label}</span>
        </label>
      ))}
    </div>
  )
}

function EmployeeForm({
  form,
  teams,
  modules,
  photoPreviewUrl,
  uploadingPhoto,
  onChange,
  onUploadPhoto,
  onRemovePhoto,
}: {
  form: EmployeeFormState
  teams: EmployeeTeam[]
  modules: { key: EmployeeAccessModule; label: string }[]
  photoPreviewUrl: string
  uploadingPhoto: boolean
  onChange: <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => void
  onUploadPhoto: (file: File) => void
  onRemovePhoto: () => void
}) {
  return (
    <div className="grid gap-5 rounded-2xl border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input value={form.fullName} onChange={(event) => onChange("fullName", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(event) => onChange("title", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>LinkedIn</Label>
          <Input placeholder="linkedin.com/in/name" value={form.linkedinUrl} onChange={(event) => onChange("linkedinUrl", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Instagram</Label>
          <Input placeholder="instagram.com/name" value={form.instagramUrl} onChange={(event) => onChange("instagramUrl", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Employee ID</Label>
          <Input value={form.employeeCode} onChange={(event) => onChange("employeeCode", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Start date</Label>
          <Input type="date" value={form.startDate} onChange={(event) => onChange("startDate", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(value) => onChange("status", value as EmployeeStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-2">
          <Label>Team</Label>
          <Select value={form.teamId} onValueChange={(value) => onChange("teamId", value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Address</h3>
          <p className="text-sm text-muted-foreground">Optional employee address for HR reference.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Address line 1" value={form.addressLine1} onChange={(event) => onChange("addressLine1", event.target.value)} />
          <Input placeholder="Address line 2" value={form.addressLine2} onChange={(event) => onChange("addressLine2", event.target.value)} />
          <Input placeholder="City" value={form.addressCity} onChange={(event) => onChange("addressCity", event.target.value)} />
          <Input placeholder="State" value={form.addressState} onChange={(event) => onChange("addressState", event.target.value)} />
          <Input placeholder="Postal code" value={form.addressPostalCode} onChange={(event) => onChange("addressPostalCode", event.target.value)} />
          <Input placeholder="Country" value={form.addressCountry} onChange={(event) => onChange("addressCountry", event.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Profile picture</Label>
        <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
          <Avatar className="size-20 rounded-2xl" size="lg">
            <AvatarImage src={photoPreviewUrl || undefined} />
            <AvatarFallback className="rounded-2xl text-2xl font-semibold">
              {initials(form.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Crop to a square before upload.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} asChild>
                <label className="cursor-pointer">
                  <UploadIcon className="size-4" />
                  Upload photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploadingPhoto}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) onUploadPhoto(file)
                      event.target.value = ""
                    }}
                  />
                </label>
              </Button>
              {form.profileImageUrl && (
                <Button type="button" variant="outline" size="sm" onClick={onRemovePhoto}>
                  <XIcon className="size-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          {uploadingPhoto ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner data-icon="inline-start" />
              Uploading
            </div>
          ) : !photoPreviewUrl ? (
            <CameraIcon className="hidden size-5 text-muted-foreground sm:block" />
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Emergency contact</h3>
          <p className="text-sm text-muted-foreground">Stored for HR reference and generated documents.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Name" value={form.emergencyName} onChange={(event) => onChange("emergencyName", event.target.value)} />
          <Input placeholder="Relationship" value={form.emergencyRelationship} onChange={(event) => onChange("emergencyRelationship", event.target.value)} />
          <Input placeholder="Phone" value={form.emergencyPhone} onChange={(event) => onChange("emergencyPhone", event.target.value)} />
          <Input placeholder="Email" value={form.emergencyEmail} onChange={(event) => onChange("emergencyEmail", event.target.value)} />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <label className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4">
          <Checkbox
            checked={form.accessEnabled}
            onCheckedChange={(checked) => onChange("accessEnabled", checked === true)}
          />
          <span>
            <span className="block text-sm font-semibold">Enable Inboundr access</span>
            <span className="block text-sm text-muted-foreground">Only linked or invited employees can use these module permissions.</span>
          </span>
        </label>
        <ModuleChecklist
          modules={modules}
          value={form.allowedModules}
          onChange={(value) => onChange("allowedModules", value)}
        />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 text-muted-foreground">{icon}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

export default function EmployeeDetailPage() {
  const { id } = useParams({ from: "/employees_/$id" })
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [teams, setTeams] = useState<EmployeeTeam[]>([])
  const [modules, setModules] = useState<{ key: EmployeeAccessModule; label: string }[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("")
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<EmployeeDocument | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [form, setForm] = useState<EmployeeFormState | null>(null)

  const effectiveModules = useMemo(() => {
    if (!employee) return []
    return [...new Set([...(employee.team?.defaultModules ?? []), ...(employee.platformAccess.allowedModules ?? [])])]
      .filter((module) => !(employee.platformAccess.restrictedModules ?? []).includes(module))
  }, [employee])

  const currentDocuments = useMemo(() => {
    const byType = new Map<EmployeeDocument["type"], EmployeeDocument>()
    for (const document of documents) {
      const current = byType.get(document.type)
      if (!current || documentTimestamp(document) > documentTimestamp(current)) {
        byType.set(document.type, document)
      }
    }
    return documentTypes.flatMap((type) => {
      const document = byType.get(type)
      return document ? [document] : []
    })
  }, [documents])

  const fetchEmployee = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/${id}`, { credentials: "include" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Failed to fetch employee")
      setEmployee(data)
      setForm(employeeToForm(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employee")
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchReferenceData = useCallback(async () => {
    const [teamsResponse, modulesResponse, membersResponse] = await Promise.all([
      fetch(`${API_BASE}/teams`, { credentials: "include" }),
      fetch(`${API_BASE}/modules`, { credentials: "include" }),
      fetch(`${ORGANIZATION_API}/members`, { credentials: "include" }),
    ])
    if (teamsResponse.ok) setTeams((await teamsResponse.json()).teams ?? [])
    if (modulesResponse.ok) setModules((await modulesResponse.json()).modules ?? [])
    if (membersResponse.ok) setMembers((await membersResponse.json()).members ?? [])
  }, [])

  const fetchDocuments = useCallback(async () => {
    const response = await fetch(`${API_BASE}/${id}/documents`, { credentials: "include" })
    if (!response.ok) return
    const data = await response.json()
    setDocuments(data.documents ?? [])
  }, [id])

  useEffect(() => {
    void fetchEmployee()
    void fetchReferenceData()
    void fetchDocuments()
  }, [fetchEmployee, fetchReferenceData, fetchDocuments])

  useEffect(() => {
    let cancelled = false
    const source = employee?.profileImageUrl?.trim() ?? ""
    if (!source) {
      setPhotoPreviewUrl("")
      return
    }

    void resolveUploadedImageUrl(source)
      .then((url) => {
        if (!cancelled) setPhotoPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPhotoPreviewUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [employee?.profileImageUrl])

  function updateForm<K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current)
  }

  async function uploadProfilePicture(file: File) {
    if (!employeePhotoTypes.includes(file.type)) {
      toast.error("Please choose a PNG, JPG, or WebP image.")
      return
    }
    if (file.size > maxEmployeePhotoSourceSize) {
      toast.error("Profile picture source must be 10MB or smaller.")
      return
    }

    setUploadingPhoto(true)
    try {
      setCropImageSrc(await readFileAsDataUrl(file))
      setCropOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load profile picture")
    } finally {
      setUploadingPhoto(false)
    }
  }

  function handleProfilePictureUploaded(result: AvatarCropResult) {
    updateForm("profileImageUrl", result.key)
    setPhotoPreviewUrl(result.displayUrl)
    toast.success("Profile picture uploaded")
  }

  function documentPdfUrl(document: EmployeeDocument, inline = false) {
    const url = `${API_BASE}/${employee?._id}/documents/${document._id}/pdf`
    return inline ? `${url}?inline=1` : url
  }

  function removeProfilePicture() {
    updateForm("profileImageUrl", "")
    setPhotoPreviewUrl("")
  }

  function cancelEditing() {
    if (employee) setForm(employeeToForm(employee))
    const source = employee?.profileImageUrl?.trim() ?? ""
    if (source) {
      void resolveUploadedImageUrl(source)
        .then(setPhotoPreviewUrl)
        .catch(() => setPhotoPreviewUrl(""))
    } else {
      setPhotoPreviewUrl("")
    }
    setEditing(false)
  }

  async function saveEmployee() {
    if (!employee || !form) return
    const payload = formToPayload(form)
    if (!payload.fullName || !payload.email) {
      toast.error("Name and email are required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${employee._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to save employee")
      setEmployee(data)
      setForm(employeeToForm(data))
      setEditing(false)
      await fetchDocuments()
      toast.success("Employee updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employee")
    } finally {
      setSaving(false)
    }
  }

  async function archiveEmployee() {
    if (!employee) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${employee._id}/archive`, {
        method: "PATCH",
        credentials: "include",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to archive employee")
      toast.success("Employee archived")
      void navigate({ to: "/employees" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive employee")
    } finally {
      setSaving(false)
    }
  }

  async function inviteEmployee() {
    if (!employee) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${employee._id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: employee.email, role: "member" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to invite employee")
      toast.success(data.linked ? "Employee linked to existing member" : "Invitation sent")
      await fetchEmployee()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite employee")
    } finally {
      setSaving(false)
    }
  }

  async function linkMember(memberId: string) {
    if (!employee || memberId === "none") return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/${employee._id}/link-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to link member")
      setEmployee(data)
      setForm(employeeToForm(data))
      toast.success("Employee linked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link member")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: employee?.fullName ?? "Employee" },
        ]}
      />
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="mx-auto max-w-6xl p-5 md:p-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
            <Link to="/employees">
              <ArrowLeftIcon className="size-4" />
              Back to employees
            </Link>
          </Button>

          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-12 text-center">
              <AlertCircleIcon className="size-8 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">{error}</h2>
                <p className="mt-1 text-sm text-muted-foreground">The employee profile could not be loaded.</p>
              </div>
              <Button onClick={() => void fetchEmployee()}>Try again</Button>
            </div>
          ) : employee ? (
            <div className="space-y-6">
              <section className="rounded-3xl border bg-card p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-5">
                    <Avatar className="size-24 rounded-3xl" size="lg">
                      <AvatarImage src={photoPreviewUrl || undefined} />
                      <AvatarFallback className="rounded-3xl text-4xl font-semibold">{initials(employee.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={employee.status === "active" ? "default" : "outline"}>
                          {statusLabels[employee.status]}
                        </Badge>
                        {employee.platformAccess.enabled ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">Access enabled</Badge>
                        ) : (
                          <Badge variant="outline">Access disabled</Badge>
                        )}
                      </div>
                      <h1 className="text-3xl font-semibold tracking-tight">{employee.fullName}</h1>
                      <p className="mt-1 text-muted-foreground">
                        {employee.title || "No title"} · {employee.team?.name ?? "No team"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editing ? (
                      <>
                        <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                          <XIcon />
                          Cancel
                        </Button>
                        <Button onClick={saveEmployee} disabled={saving || !form}>
                          {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon />}
                          Save changes
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                          <ArchiveIcon />
                          Archive
                        </Button>
                        <Button onClick={() => setEditing(true)}>Edit profile</Button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {editing && form ? (
                <EmployeeForm
                  form={form}
                  teams={teams}
                  modules={modules}
                  photoPreviewUrl={photoPreviewUrl}
                  uploadingPhoto={uploadingPhoto}
                  onChange={updateForm}
                  onUploadPhoto={(file) => void uploadProfilePicture(file)}
                  onRemovePhoto={removeProfilePicture}
                />
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoCard
                        icon={<BriefcaseBusinessIcon className="size-5" />}
                        label="Employee ID"
                        value={employee.employeeCode || "Not set"}
                      />
                      <InfoCard
                        icon={<BadgeCheckIcon className="size-5" />}
                        label="Start date"
                        value={formatDate(employee.startDate)}
                      />
                      <InfoCard
                        icon={<ShieldCheckIcon className="size-5" />}
                        label="Platform access"
                        value={employee.platformAccess.enabled ? "Enabled" : "Disabled"}
                      />
                    </div>

                    <section className="rounded-3xl border bg-card p-5">
                      <h2 className="text-lg font-semibold">Profile</h2>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <InfoCard icon={<MailIcon className="size-5" />} label="Email" value={employee.email} />
                        <InfoCard icon={<PhoneIcon className="size-5" />} label="Phone" value={employee.phone || "Not set"} />
                      </div>
                      <Separator className="my-5" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoCard
                          icon={<LinkIcon className="size-5" />}
                          label="Socials"
                          value={
                            employee.socials?.linkedinUrl || employee.socials?.instagramUrl ? (
                              <span className="flex flex-col gap-1">
                                {employee.socials?.linkedinUrl ? (
                                  <a className="inline-flex items-center gap-1 text-primary" href={employee.socials.linkedinUrl} target="_blank" rel="noreferrer">
                                    LinkedIn <ExternalLinkIcon className="size-3" />
                                  </a>
                                ) : null}
                                {employee.socials?.instagramUrl ? (
                                  <a className="inline-flex items-center gap-1 text-primary" href={employee.socials.instagramUrl} target="_blank" rel="noreferrer">
                                    Instagram <ExternalLinkIcon className="size-3" />
                                  </a>
                                ) : null}
                              </span>
                            ) : "Not set"
                          }
                        />
                        <InfoCard
                          icon={<MapPinIcon className="size-5" />}
                          label="Address"
                          value={
                            employeeAddressLines(employee.address).length > 0 ? (
                              <span className="flex flex-col gap-1">
                                {employeeAddressLines(employee.address).map((line) => (
                                  <span key={line}>{line}</span>
                                ))}
                              </span>
                            ) : "Not set"
                          }
                        />
                      </div>
                      <Separator className="my-5" />
                      <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
                        <div className="flex items-center gap-2 font-semibold">
                          <UserRoundIcon className="size-4" />
                          Emergency contact
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>Name: <span className="text-foreground">{employee.emergencyContact?.name || "-"}</span></span>
                          <span>Relationship: <span className="text-foreground">{employee.emergencyContact?.relationship || "-"}</span></span>
                          <span>Phone: <span className="text-foreground">{employee.emergencyContact?.phone || "-"}</span></span>
                          <span>Email: <span className="text-foreground">{employee.emergencyContact?.email || "-"}</span></span>
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-6">
                    <section className="rounded-3xl border bg-card p-5">
                      <h2 className="font-semibold">Module access</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Effective modules from team defaults and employee overrides.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {effectiveModules.length > 0 ? (
                          effectiveModules.map((module) => (
                            <Badge key={module} variant="secondary">
                              {modules.find((item) => item.key === module)?.label ?? module}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No module restrictions configured.</span>
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border bg-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">Login linking</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {employee.organizationMemberId
                              ? "Linked to an organization member."
                              : "Invite or link this employee when they need platform access."}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={inviteEmployee} disabled={saving || Boolean(employee.organizationMemberId)}>
                          <SendIcon />
                          Invite
                        </Button>
                      </div>
                      <Select value="none" onValueChange={linkMember}>
                        <SelectTrigger className="mt-4 w-full">
                          <SelectValue placeholder="Link existing member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Link existing member</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member._id} value={member._id}>
                              {(member.userName || member.userEmail || member._id)} · {member.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </section>

                    <section className="rounded-3xl border bg-card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">Documents</h2>
                          <p className="mt-1 text-sm text-muted-foreground">Open current branded employee documents.</p>
                        </div>
                        <IdCardIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="mt-4 grid gap-2">
                        {currentDocuments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No documents available yet.</p>
                        ) : currentDocuments.map((document) => (
                          <button
                            key={document._id}
                            type="button"
                            onClick={() => setPreviewDocument(document)}
                            className="flex items-center justify-between rounded-2xl border px-3 py-2 text-left"
                          >
                            <span>
                              <span className="block text-sm font-medium">{document.title}</span>
                              <span className="block text-xs text-muted-foreground">Issued {formatDate(document.issuedAt)}</span>
                            </span>
                            <LinkIcon className="size-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </section>
                  </aside>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive employee</DialogTitle>
            <DialogDescription>
              Archive {employee?.fullName}? This disables platform access and removes the employee from the active directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={archiveEmployee} disabled={saving}>
              {saving && <Spinner data-icon="inline-start" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewDocument)} onOpenChange={(open) => !open && setPreviewDocument(null)}>
        <DialogContent className="max-h-[90svh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title ?? "Employee document"}</DialogTitle>
            <DialogDescription>
              Preview the current document or download a PDF copy.
            </DialogDescription>
          </DialogHeader>
          {previewDocument ? (
            <div className="overflow-hidden rounded-xl border bg-background">
              <iframe
                title={previewDocument.title}
                src={documentPdfUrl(previewDocument, true)}
                className="h-[70svh] w-full border-0 bg-white"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDocument(null)}>
              Close
            </Button>
            {previewDocument ? (
              <Button asChild>
                <a href={documentPdfUrl(previewDocument)} target="_blank" rel="noreferrer">
                  <DownloadIcon className="size-4" />
                  Download
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        title="Crop employee photo"
        description="Drag to reposition and zoom to frame this employee photo."
        saveLabel="Save employee photo"
        upload={uploadCroppedEmployeeImage}
        onOpenChange={setCropOpen}
        onUploaded={handleProfilePictureUploaded}
        onError={(message) => toast.error(message)}
      />
    </AppLayout>
  )
}
