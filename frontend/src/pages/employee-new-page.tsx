import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckCircle2Icon,
  IdCardIcon,
  ShieldCheckIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
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
import type { EmployeeAccessModule } from "@/lib/entitlements"
import { uploadCroppedEmployeeImage } from "@/lib/uploaded-image"
import { cn } from "@/lib/utils"

import { API_ORIGIN } from "@/lib/env"
const API_BASE = `${API_ORIGIN}/api/v1/employees`

type StepId = "profile" | "employment" | "access" | "review"
type EmployeeStatus = "active" | "inactive" | "terminated" | "archived"

interface EmployeeTeam {
  _id: string
  name: string
  description: string | null
  defaultModules: EmployeeAccessModule[]
}

type EmployeeFormState = {
  fullName: string
  email: string
  phone: string
  title: string
  profileImageUrl: string
  linkedinUrl: string
  instagramUrl: string
  addressLine1: string
  addressLine2: string
  addressCity: string
  addressState: string
  addressPostalCode: string
  addressCountry: string
  employeeCode: string
  attendancePin: string
  startDate: string
  status: EmployeeStatus
  teamId: string
  accessEnabled: boolean
  allowedModules: EmployeeAccessModule[]
}

const steps: Array<{ id: StepId; label: string; description: string }> = [
  { id: "profile", label: "Profile", description: "Contact and role" },
  { id: "employment", label: "Employment", description: "Team and status" },
  { id: "access", label: "Access", description: "Inboundr modules" },
  { id: "review", label: "Review", description: "Create employee" },
]

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  terminated: "Terminated",
  archived: "Archived",
}

const employeePhotoTypes = ["image/png", "image/jpeg", "image/webp"]
const maxEmployeePhotoSourceSize = 10 * 1024 * 1024

const emptyForm: EmployeeFormState = {
  fullName: "",
  email: "",
  phone: "",
  title: "",
  profileImageUrl: "",
  linkedinUrl: "",
  instagramUrl: "",
  addressLine1: "",
  addressLine2: "",
  addressCity: "",
  addressState: "",
  addressPostalCode: "",
  addressCountry: "",
  employeeCode: "",
  attendancePin: "",
  startDate: "",
  status: "active",
  teamId: "none",
  accessEnabled: false,
  allowedModules: [],
}

type RecruitmentPrefillEnvelope = {
  version: 1
  createdAt: number
  applicationId: string
  jobTitle: string
  prefill: {
    fullName: string
    email: string
    phone: string | null
    title: string | null
    employeeCode: string | null
    profileImageUrl: string | null
    startDate: string | null
    status: EmployeeStatus
    socials: { linkedinUrl: string | null; instagramUrl: string | null }
    address: { line1: string; line2: string; city: string; state: string; postalCode: string; country: string }
  }
}

function consumeRecruitmentPrefill(): { form: EmployeeFormState; source: RecruitmentPrefillEnvelope | null } {
  const key = "recruitment.employee-prefill"
  const raw = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (!raw) return { form: emptyForm, source: null }
  try {
    const envelope = JSON.parse(raw) as RecruitmentPrefillEnvelope
    if (envelope.version !== 1 || Date.now() - envelope.createdAt > 15 * 60_000) return { form: emptyForm, source: null }
    const value = envelope.prefill
    return {
      source: envelope,
      form: {
        ...emptyForm,
        fullName: value.fullName || "",
        email: value.email || "",
        phone: value.phone || "",
        title: value.title || "",
        profileImageUrl: value.profileImageUrl || "",
        linkedinUrl: value.socials?.linkedinUrl || "",
        instagramUrl: value.socials?.instagramUrl || "",
        addressLine1: value.address?.line1 || "",
        addressLine2: value.address?.line2 || "",
        addressCity: value.address?.city || "",
        addressState: value.address?.state || "",
        addressPostalCode: value.address?.postalCode || "",
        addressCountry: value.address?.country || "",
        employeeCode: value.employeeCode || "",
        startDate: value.startDate || "",
        status: value.status || "active",
        accessEnabled: false,
        allowedModules: [],
      },
    }
  } catch {
    return { form: emptyForm, source: null }
  }
}

function Stepper({ currentStep }: { currentStep: StepId }) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-4">
      <div className="grid gap-4 md:grid-cols-4 md:gap-3">
        {steps.map((step, index) => {
          const active = step.id === currentStep
          const complete = index < currentIndex
          return (
            <div key={step.id} className="min-w-0">
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-bold text-muted-foreground shadow-xs transition-colors",
                    active && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                    complete && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {complete ? <CheckCircle2Icon className="size-4" /> : index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span
                    className={cn(
                      "ml-3 hidden h-px flex-1 bg-border md:block",
                      complete && "bg-primary/60"
                    )}
                  />
                )}
              </div>
              <div className="mt-3 pl-0.5">
                <p className={cn("text-sm font-semibold leading-none", active && "text-primary")}>
                  {step.label}
                </p>
                <p className="mt-2 text-xs leading-none text-muted-foreground">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IN"
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

function toggleModule(
  modules: EmployeeAccessModule[],
  module: EmployeeAccessModule,
  checked: boolean
) {
  if (checked) return [...new Set([...modules, module])]
  return modules.filter((item) => item !== module)
}

function formToPayload(form: EmployeeFormState) {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim() || null,
    title: form.title.trim() || null,
    profileImageUrl: form.profileImageUrl.trim() || null,
    employeeCode: form.employeeCode.trim() || null,
    attendancePin: form.attendancePin.trim() || undefined,
    startDate: form.startDate || null,
    status: form.status,
    teamId: form.teamId === "none" ? null : form.teamId,
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
      name: "",
      relationship: "",
      phone: "",
      email: "",
    },
    platformAccess: {
      enabled: form.accessEnabled,
      allowedModules: form.allowedModules,
      restrictedModules: [],
    },
  }
}

export default function EmployeeNewPage() {
  const navigate = useNavigate()
  const [recruitmentPrefill] = useState(consumeRecruitmentPrefill)
  const [step, setStep] = useState<StepId>("profile")
  const [form, setForm] = useState<EmployeeFormState>(recruitmentPrefill.form)
  const [teams, setTeams] = useState<EmployeeTeam[]>([])
  const [modules, setModules] = useState<{ key: EmployeeAccessModule; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("")
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  const currentIndex = steps.findIndex((item) => item.id === step)
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!form.fullName.trim()) errors.push("Employee name is required.")
    if (!form.email.trim() || !form.email.includes("@")) errors.push("A valid email is required.")
    if (form.attendancePin.trim() && !/^\d{4,8}$/.test(form.attendancePin.trim())) {
      errors.push("Attendance PIN must be 4 to 8 digits.")
    }
    return errors
  }, [form.attendancePin, form.email, form.fullName])

  const selectedTeam = teams.find((team) => team._id === form.teamId)
  const selectedModules = modules.filter((module) => form.allowedModules.includes(module.key))

  const fetchReferenceData = useCallback(async () => {
    const [teamsResponse, modulesResponse] = await Promise.all([
      fetch(`${API_BASE}/teams`, { credentials: "include" }),
      fetch(`${API_BASE}/modules`, { credentials: "include" }),
    ])
    if (teamsResponse.ok) setTeams((await teamsResponse.json()).teams ?? [])
    if (modulesResponse.ok) setModules((await modulesResponse.json()).modules ?? [])
  }, [])

  useEffect(() => {
    // Reference lists are hydrated from the employee API on entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReferenceData()
  }, [fetchReferenceData])

  function updateForm<K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
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

  function removeProfilePicture() {
    updateForm("profileImageUrl", "")
    setPhotoPreviewUrl("")
  }

  function goNext() {
    if (step === "profile" && validationErrors.length > 0) {
      toast.error(validationErrors[0])
      return
    }
    const nextStep = steps[currentIndex + 1]
    if (nextStep) setStep(nextStep.id)
  }

  function goBack() {
    const previousStep = steps[currentIndex - 1]
    if (previousStep) setStep(previousStep.id)
  }

  async function createEmployee() {
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0])
      setStep("profile")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formToPayload(form)),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Failed to create employee")
      toast.success("Employee created")
      void navigate({ to: "/employees/$id", params: { id: data._id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create employee")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: "New Employee" },
        ]}
      />
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="mx-auto max-w-5xl p-5 md:p-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-6">
            <Link to="/employees">
              <ArrowLeftIcon className="size-4" />
              Back to Employees
            </Link>
          </Button>

          <div className="mb-6 rounded-3xl border bg-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge variant="outline" className="mb-3">Employee setup</Badge>
                <h1 className="text-2xl font-semibold tracking-tight">New Employee</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create the HR record first. Login access can be enabled during setup or adjusted later.
                </p>
              </div>
              <IdCardIcon className="size-10 text-muted-foreground" />
            </div>
            <Separator className="my-5" />
            <Stepper currentStep={step} />
          </div>

          <div className="rounded-3xl border bg-card p-6">
            {recruitmentPrefill.source ? <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Prefilled from the hired {recruitmentPrefill.source.jobTitle} application</p><p className="mt-1 text-emerald-900/70">Review every field before creating the employee. Platform access remains disabled and no invitation is sent automatically.</p></div> : null}
            {step === "profile" ? (
              <section className="grid gap-5">
                <div className="flex items-center gap-3">
                  <UserRoundIcon className="size-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">Profile</h2>
                    <p className="text-sm text-muted-foreground">Basic identity and contact details.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>LinkedIn</Label>
                    <Input placeholder="linkedin.com/in/name" value={form.linkedinUrl} onChange={(event) => updateForm("linkedinUrl", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Instagram</Label>
                    <Input placeholder="instagram.com/name" value={form.instagramUrl} onChange={(event) => updateForm("instagramUrl", event.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:col-span-2">
                    <div>
                      <h3 className="text-sm font-semibold">Address</h3>
                      <p className="text-sm text-muted-foreground">Optional employee address for HR reference.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input placeholder="Address line 1" value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} />
                      <Input placeholder="Address line 2" value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} />
                      <Input placeholder="City" value={form.addressCity} onChange={(event) => updateForm("addressCity", event.target.value)} />
                      <Input placeholder="State" value={form.addressState} onChange={(event) => updateForm("addressState", event.target.value)} />
                      <Input placeholder="Postal code" value={form.addressPostalCode} onChange={(event) => updateForm("addressPostalCode", event.target.value)} />
                      <Input placeholder="Country" value={form.addressCountry} onChange={(event) => updateForm("addressCountry", event.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Profile picture</Label>
                    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                      <Avatar className="size-24 rounded-2xl" size="lg">
                        <AvatarImage src={photoPreviewUrl || undefined} />
                        <AvatarFallback className="rounded-2xl text-3xl font-semibold">
                          {initials(form.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Crop to a square before upload.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} asChild>
                            <label className="cursor-pointer">
                              <UploadIcon className="size-4" />
                              Upload Photo
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                disabled={uploadingPhoto}
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  if (file) void uploadProfilePicture(file)
                                  event.target.value = ""
                                }}
                              />
                            </label>
                          </Button>
                          {form.profileImageUrl && (
                            <Button type="button" variant="outline" size="sm" onClick={removeProfilePicture}>
                              <XIcon className="size-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      {uploadingPhoto && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner data-icon="inline-start" />
                          Uploading
                        </div>
                      )}
                      {!uploadingPhoto && !photoPreviewUrl && <CameraIcon className="hidden size-5 text-muted-foreground sm:block" />}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {step === "employment" ? (
              <section className="grid gap-5">
                <div className="flex items-center gap-3">
                  <UsersIcon className="size-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">Employment</h2>
                    <p className="text-sm text-muted-foreground">Team assignment and lifecycle state.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Employee ID</Label>
                    <Input value={form.employeeCode} onChange={(event) => updateForm("employeeCode", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Start date</Label>
                    <Input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Attendance PIN</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      placeholder="4 to 8 digits"
                      value={form.attendancePin}
                      onChange={(event) => updateForm("attendancePin", event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Required for the embed POS attendance kiosk.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(value) => updateForm("status", value as EmployeeStatus)}>
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
                  <div className="grid gap-2">
                    <Label>Team</Label>
                    <Select value={form.teamId} onValueChange={(value) => updateForm("teamId", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Team</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            ) : null}

            {step === "access" ? (
              <section className="grid gap-5">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="size-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">Platform Access</h2>
                    <p className="text-sm text-muted-foreground">Choose module access if this employee needs Inboundr login access.</p>
                  </div>
                </div>
                <label className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-4">
                  <Checkbox
                    checked={form.accessEnabled}
                    onCheckedChange={(checked) => updateForm("accessEnabled", checked === true)}
                  />
                  <span>
                    <span className="block text-sm font-semibold">Enable Inboundr access</span>
                    <span className="block text-sm text-muted-foreground">Access still requires an invitation or linked organization member.</span>
                  </span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {modules.map((module) => (
                    <label
                      key={module.key}
                      className="flex items-center gap-2 rounded-xl border bg-background/60 px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={form.allowedModules.includes(module.key)}
                        onCheckedChange={(checked) => updateForm("allowedModules", toggleModule(form.allowedModules, module.key, checked === true))}
                      />
                      <span>{module.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {step === "review" ? (
              <section className="grid gap-5">
                <div>
                  <h2 className="font-semibold">Review Employee</h2>
                  <p className="text-sm text-muted-foreground">Confirm the details before creating the record.</p>
                </div>
                {validationErrors.length > 0 ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                    {validationErrors[0]}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profile</p>
                    <h3 className="mt-3 text-xl font-semibold">{form.fullName || "Unnamed employee"}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{form.title || "No title"}</p>
                    <p className="mt-3 text-sm">{form.email || "No email"}</p>
                    <p className="text-sm text-muted-foreground">{form.phone || "No phone"}</p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      LinkedIn: <span className="text-foreground">{form.linkedinUrl || "-"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Instagram: <span className="text-foreground">{form.instagramUrl || "-"}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employment</p>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Employee ID</dt><dd>{form.employeeCode || "-"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Attendance PIN</dt><dd>{form.attendancePin ? "Set" : "Not set"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Start date</dt><dd>{form.startDate || "-"}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Status</dt><dd>{statusLabels[form.status]}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Team</dt><dd>{selectedTeam?.name ?? "No team"}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-2xl border p-4 md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
                    <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                      <span>{form.addressLine1 || "-"}</span>
                      {form.addressLine2 ? <span>{form.addressLine2}</span> : null}
                      <span>{[form.addressCity, form.addressState, form.addressPostalCode].filter(Boolean).join(", ") || "-"}</span>
                      <span>{form.addressCountry || "-"}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4 md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Access</p>
                    <p className="mt-3 text-sm">{form.accessEnabled ? "Platform access enabled" : "Platform access disabled"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedModules.length > 0 ? selectedModules.map((module) => (
                        <Badge key={module.key} variant="secondary">{module.label}</Badge>
                      )) : <span className="text-sm text-muted-foreground">No module access selected.</span>}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <Separator className="my-6" />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={goBack} disabled={currentIndex === 0 || saving}>
                Back
              </Button>
              {step === "review" ? (
                <Button onClick={createEmployee} disabled={saving || validationErrors.length > 0}>
                  {saving && <Spinner data-icon="inline-start" />}
                  Create Employee
                </Button>
              ) : (
                <Button onClick={goNext}>Continue</Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        title="Crop Employee Photo"
        description="Drag to reposition and zoom to frame this employee photo."
        saveLabel="Save Employee Photo"
        upload={uploadCroppedEmployeeImage}
        onOpenChange={setCropOpen}
        onUploaded={handleProfilePictureUploaded}
        onError={(message) => toast.error(message)}
      />
    </AppLayout>
  )
}
