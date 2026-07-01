import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearch } from "@tanstack/react-router"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AvatarCropDialog, type AvatarCropResult } from "@/components/avatar-crop-dialog"
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
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemePicker } from "@/components/theme-picker"
import { useTheme } from "@/components/theme-provider"
import { useSession, updateUser } from "@/lib/auth-client"
import { notifyOrganizationBrandingChanged } from "@/lib/organization-branding"
import { ACTIVE_ORGANIZATION_ID_KEY, setActiveOrganizationId } from "@/lib/organization-context"
import { useEntitlements, type EmployeeAccessModule } from "@/lib/entitlements"
import { SUPPORT_TICKET_TAG_COLORS, TAG_DOT_STYLES } from "@/components/support/tag-chip"
import type { SupportTicketTag, SupportTicketTagColor } from "@/components/support/types"
import { MAX_LETTERHEADS, uploadLetterheadImage } from "@/lib/letterhead"
import { resolveUploadedImageUrl } from "@/lib/uploaded-image"
import {
  Building2Icon,
  CameraIcon,
  CheckCircle2Icon,
  CrownIcon,
  CheckIcon,
  ImageIcon,
  KeyIcon,
  LogOutIcon,
  MailIcon,
  MessageSquareTextIcon,
  MoreVerticalIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { API_ORIGIN } from "@/lib/env"
import { formatDate, formatDateTime } from "@/lib/format"

const createTermTemplateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const createPaymentTermId = () => {
  return createTermTemplateId("payment-term")
}

const createDeliveryTermId = () => {
  return createTermTemplateId("delivery-term")
}

const normalizeTermTemplates = <T extends TermTemplate>(
  terms: T[] | undefined,
  fallbackText: string,
  createId: () => string,
): T[] => {
  const validTerms = (terms ?? [])
    .map((term) => ({
      id: term.id || createId(),
      name: term.name ?? "",
      text: term.text ?? "",
      isDefault: Boolean(term.isDefault),
    }) as T)
    .filter((term) => term.name.trim() && term.text.trim())

  if (validTerms.length > 0) {
    const defaultIndex = validTerms.findIndex((term) => term.isDefault)
    return validTerms.map((term, index) => ({
      ...term,
      isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
    }))
  }

  return fallbackText.trim()
    ? [
        {
          id: createId(),
          name: "Default",
          text: fallbackText.trim(),
          isDefault: true,
        } as T,
      ]
    : []
}

const normalizePaymentTermTemplates = (
  paymentTerms: PaymentTermTemplate[] | undefined,
  defaultTerms: string,
): PaymentTermTemplate[] => normalizeTermTemplates(paymentTerms, defaultTerms, createPaymentTermId)

const normalizeDeliveryTermTemplates = (
  deliveryTerms: DeliveryTermTemplate[] | undefined,
): DeliveryTermTemplate[] => normalizeTermTemplates(deliveryTerms, "", createDeliveryTermId)

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

const INVOICE_TEMPLATE_OPTIONS = [
  {
    id: "standard",
    label: "Standard",
    description: "Branded layout with your accent color, summary, and totals.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Monospace, typewriter-style layout. Clean and distraction-free.",
  },
  {
    id: "classic",
    label: "Classic",
    description: "Bold centered header with a prominent logo and tidy summary.",
  },
] as const

type InvoiceTemplateId = (typeof INVOICE_TEMPLATE_OPTIONS)[number]["id"]

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
    colorTheme: string
    pricing: string
    defaultTerms: string
    defaultUpiId: string
    defaultInvoiceTemplate: InvoiceTemplateId
    paymentTerms: PaymentTermTemplate[]
    deliveryTerms: DeliveryTermTemplate[]
  }
  letterheads: OrganizationLetterhead[]
  activeLetterheadId: string
}

interface OrganizationLetterhead {
  id: string
  key: string
  originalName: string
  contentType: string
  size: number
  createdAt: string
}

interface TermTemplate {
  id: string
  name: string
  text: string
  isDefault: boolean
}

type PaymentTermTemplate = TermTemplate
type DeliveryTermTemplate = TermTemplate

type OrganizationFormState = Omit<Organization, "_id" | "letterheads" | "activeLetterheadId">

type OrganizationRole = "owner" | "admin" | "member"

interface AccessGroupSummary {
  _id: string
  name: string
  allModules: boolean
  canManageOrganization: boolean
  isDefault: boolean
  defaultKey: "admin" | "members" | null
}

interface AccessGroup extends AccessGroupSummary {
  description: string | null
  moduleAccess: EmployeeAccessModule[]
  status: "active" | "archived"
  memberCount: number
  createdAt: string
  updatedAt: string
}

interface OrganizationMember {
  _id: string
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
  role: OrganizationRole
  accessGroupIds: string[]
  accessGroups: AccessGroupSummary[]
  createdAt: string
  lastSignInAt: string | null
}

interface OrganizationInvitation {
  _id: string
  email: string
  role: OrganizationRole
  accessGroupIds: string[]
  accessGroups: AccessGroupSummary[]
  expiresAt: string
  createdAt: string
}

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: {
    key: string
    url: string | null
  }
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
    colorTheme: "default",
    pricing: "INR",
    defaultTerms: "",
    defaultUpiId: "",
    defaultInvoiceTemplate: "standard",
    paymentTerms: [],
    deliveryTerms: [],
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
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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
    <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-sm">
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

function RoleBadge({ label }: { label: "Owner" | "Admin" | "Member" }) {
  const styles = {
    Owner: "bg-primary/10 text-primary",
    Admin: "bg-warning/10 text-warning",
    Member: "bg-muted text-muted-foreground",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[label]}`}>
      {label}
    </span>
  )
}

const ACCESS_MODULE_OPTIONS: { value: EmployeeAccessModule; label: string }[] = [
  { value: "rfq", label: "RFQ" },
  { value: "inbox", label: "Inbox" },
  { value: "products", label: "Products" },
  { value: "customers", label: "Customers" },
  { value: "invoices", label: "Invoices" },
  { value: "forms", label: "Forms" },
  { value: "links", label: "Links" },
  { value: "drive", label: "Drive" },
  { value: "stats", label: "Stats" },
  { value: "employees", label: "Employees" },
  { value: "projects", label: "Projects" },
  { value: "chat", label: "Chat" },
  { value: "support", label: "Support" },
]

function AccessGroupBadges({ groups }: { groups: AccessGroupSummary[] }) {
  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">No groups</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {groups.map((group) => (
        <Badge key={group._id} variant={group.canManageOrganization ? "default" : "secondary"}>
          {group.name}
        </Badge>
      ))}
    </div>
  )
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

function toggleAccessModule(modules: EmployeeAccessModule[], module: EmployeeAccessModule) {
  return modules.includes(module)
    ? modules.filter((item) => item !== module)
    : [...modules, module]
}

function AccessGroupChecklist({
  groups,
  selectedIds,
  onChange,
  disabled,
}: {
  groups: AccessGroup[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  return (
    <div className="grid gap-2 rounded-xl border bg-muted/20 p-3">
      {groups.map((group) => (
        <label key={group._id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
          <Checkbox
            checked={selectedIds.includes(group._id)}
            disabled={disabled}
            onCheckedChange={() => onChange(toggleId(selectedIds, group._id))}
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{group.name}</span>
            <span className="text-xs text-muted-foreground">
              {group.allModules ? "All modules" : `${group.moduleAccess.length} modules`}
              {group.canManageOrganization ? " - Can manage organization" : ""}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}

function ModuleAccessChecklist({
  selectedModules,
  onChange,
  disabled,
}: {
  selectedModules: EmployeeAccessModule[]
  onChange: (modules: EmployeeAccessModule[]) => void
  disabled?: boolean
}) {
  return (
    <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
      {ACCESS_MODULE_OPTIONS.map((module) => (
        <label key={module.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50">
          <Checkbox
            checked={selectedModules.includes(module.value)}
            disabled={disabled}
            onCheckedChange={() => onChange(toggleAccessModule(selectedModules, module.value))}
          />
          <span className="text-sm">{module.label}</span>
        </label>
      ))}
    </div>
  )
}

function toRoleLabel(role: OrganizationRole): "Owner" | "Admin" | "Member" {
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"
}

function colorInputValue(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#f5b400"
}

function getInitials(value?: string | null) {
  const fallback = value?.trim() || "User"
  const parts = fallback.split(/\s+/).slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "U"
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatLastSignIn(value?: string | null) {
  const formatted = formatDateTime(value)
  return formatted === "-" ? "Sign-in activity unavailable" : `Last signed in ${formatted}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function resolveLogoDisplayUrl(logoUrl: string): Promise<string> {
  const source = logoUrl.trim()
  if (!source || /^https?:\/\//i.test(source)) {
    return source
  }

  const res = await fetch(`${API_ORIGIN}/api/v1/uploads/view?key=${encodeURIComponent(source)}`, {
    credentials: "include",
  })
  const data: { url?: string; error?: string } = await res.json().catch(() => ({}))

  if (!res.ok || !data.url) {
    throw new Error(data.error || "Failed to load organization logo")
  }

  return data.url
}

// ─── Tab Content ─────────────────────────────────────────────

function OrganizationTab() {
  const { previewTheme, previewColorTheme } = useTheme()
  const [form, setForm] = useState<OrganizationFormState>(emptyOrganizationForm)
  const [letterheads, setLetterheads] = useState<OrganizationLetterhead[]>([])
  const [activeLetterheadId, setActiveLetterheadId] = useState("")
  const [letterheadPreviewUrls, setLetterheadPreviewUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false)
  const [settingActiveLetterheadId, setSettingActiveLetterheadId] = useState<string | null>(null)
  const [deletingLetterheadId, setDeletingLetterheadId] = useState<string | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const letterheadInputRef = useRef<HTMLInputElement>(null)
  const savedThemeRef = useRef<Pick<Organization["preferences"], "theme" | "colorTheme"> | null>(null)

  const applyOrganization = useCallback((organization: Organization) => {
    const paymentTerms = normalizePaymentTermTemplates(
      organization.preferences?.paymentTerms,
      organization.preferences?.defaultTerms ?? "",
    )
    const deliveryTerms = normalizeDeliveryTermTemplates(organization.preferences?.deliveryTerms)
    const defaultPaymentTerm = paymentTerms.find((term) => term.isDefault)
    const preferences = {
      primaryColor: organization.preferences?.primaryColor ?? "#f5b400",
      theme: organization.preferences?.theme ?? "dark",
      colorTheme: organization.preferences?.colorTheme ?? "default",
      pricing: organization.preferences?.pricing ?? "INR",
      defaultTerms: defaultPaymentTerm?.text ?? organization.preferences?.defaultTerms ?? "",
      defaultUpiId: organization.preferences?.defaultUpiId ?? "",
      defaultInvoiceTemplate: organization.preferences?.defaultInvoiceTemplate ?? "standard",
      paymentTerms,
      deliveryTerms,
    }

    savedThemeRef.current = {
      theme: preferences.theme,
      colorTheme: preferences.colorTheme,
    }

    setForm({
      name: organization.name ?? "",
      defaultContact: {
        name: organization.defaultContact?.name ?? "",
        email: organization.defaultContact?.email ?? "",
        phoneNumber: organization.defaultContact?.phoneNumber ?? "",
      },
      website: organization.website ?? "",
      logoUrl: organization.logoUrl ?? "",
      address: organization.address ?? "",
      preferences,
    })
    setLetterheads(organization.letterheads ?? [])
    setActiveLetterheadId(organization.activeLetterheadId ?? "")
  }, [])

  const fetchOrganization = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        credentials: "include",
      })
      const data: { organization: Organization } = await res.json()
      if (!res.ok) throw new Error((data as any)?.error || "Failed to load organization")

      applyOrganization(data.organization)
    } catch (err: any) {
      setError(err.message || "Failed to load organization")
    } finally {
      setLoading(false)
    }
  }, [applyOrganization])

  useEffect(() => {
    void fetchOrganization()
  }, [fetchOrganization])

  useEffect(() => {
    return () => {
      const savedTheme = savedThemeRef.current
      if (savedTheme) previewTheme(savedTheme.theme)
      previewColorTheme(null)
    }
  }, [previewTheme, previewColorTheme])

  useEffect(() => {
    let cancelled = false

    if (!form.logoUrl) {
      setLogoPreviewUrl("")
      return
    }

    void resolveLogoDisplayUrl(form.logoUrl)
      .then((url) => {
        if (!cancelled) setLogoPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setLogoPreviewUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [form.logoUrl])

  useEffect(() => {
    let cancelled = false

    if (letterheads.length === 0) return

    void Promise.all(
      letterheads.map(async (letterhead) => {
        try {
          return [letterhead.id, await resolveUploadedImageUrl(letterhead.key)] as const
        } catch {
          return [letterhead.id, ""] as const
        }
      }),
    ).then((entries) => {
      if (!cancelled) setLetterheadPreviewUrls(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [letterheads])

  const saveOrganization = async () => {
    setSaving(true)
    setError(null)

    try {
      const defaultPaymentTerm = form.preferences.paymentTerms.find((term) => term.isDefault)
      const payload = {
        ...form,
        preferences: {
          ...form.preferences,
          defaultTerms: defaultPaymentTerm?.text ?? "",
        },
      }
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save organization")
      savedThemeRef.current = {
        theme: form.preferences.theme,
        colorTheme: form.preferences.colorTheme,
      }
      toast.success("Organization settings saved")
      notifyOrganizationBrandingChanged()
    } catch (err: any) {
      const message = err.message || "Failed to save organization"
      setError(message)
      toast.error(message)
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

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be 2MB or smaller.")
      return
    }

    setUploadingLogo(true)
    setError(null)

    try {
      const presignRes = await fetch(`${API_ORIGIN}/api/v1/uploads/presign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "branding",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })
      const presign: PresignedUpload | { error?: string } = await presignRes.json()

      if (!presignRes.ok || !("uploadUrl" in presign)) {
        throw new Error((presign as { error?: string }).error || "Failed to prepare logo upload")
      }

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      })

      if (!uploadRes.ok) {
        throw new Error("Failed to upload logo")
      }

      updateForm("logoUrl", presign.file.key)
      setLogoPreviewUrl(await resolveLogoDisplayUrl(presign.file.key))
      toast.success("Logo uploaded", {
        description: "Save organization settings to publish it.",
      })
    } catch (err: any) {
      const message = err.message || "Failed to upload logo"
      setError(message)
      toast.error(message)
    } finally {
      setUploadingLogo(false)
    }
  }

  const uploadLetterhead = async (file: File) => {
    if (letterheads.length >= MAX_LETTERHEADS) {
      toast.error(`You can save up to ${MAX_LETTERHEADS} letterheads.`)
      return
    }

    setUploadingLetterhead(true)
    setError(null)

    try {
      const uploaded = await uploadLetterheadImage(file)
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/letterheads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploaded),
      })
      const data: { organization?: Organization; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.organization) throw new Error(data.error || "Failed to save letterhead")

      setLetterheads(data.organization.letterheads ?? [])
      setActiveLetterheadId(data.organization.activeLetterheadId ?? "")
      const added = data.organization.letterheads?.find((letterhead) => letterhead.key === uploaded.key)
      if (added) {
        setLetterheadPreviewUrls((current) => ({ ...current, [added.id]: uploaded.displayUrl }))
      }
      toast.success("Letterhead uploaded")
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to upload letterhead")
      setError(message)
      toast.error(message)
    } finally {
      setUploadingLetterhead(false)
    }
  }

  const setActiveLetterhead = async (id: string) => {
    setSettingActiveLetterheadId(id)
    setError(null)

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/letterheads/${encodeURIComponent(id)}/active`, {
        method: "PATCH",
        credentials: "include",
      })
      const data: { organization?: Organization; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.organization) throw new Error(data.error || "Failed to update active letterhead")

      setLetterheads(data.organization.letterheads ?? [])
      setActiveLetterheadId(data.organization.activeLetterheadId ?? "")
      toast.success("Active letterhead updated")
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to update active letterhead")
      setError(message)
      toast.error(message)
    } finally {
      setSettingActiveLetterheadId(null)
    }
  }

  const deleteLetterhead = async (id: string) => {
    setDeletingLetterheadId(id)
    setError(null)

    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/letterheads/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data: { organization?: Organization; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.organization) throw new Error(data.error || "Failed to delete letterhead")

      setLetterheads(data.organization.letterheads ?? [])
      setActiveLetterheadId(data.organization.activeLetterheadId ?? "")
      setLetterheadPreviewUrls((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      toast.success("Letterhead deleted")
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to delete letterhead")
      setError(message)
      toast.error(message)
    } finally {
      setDeletingLetterheadId(null)
    }
  }

  const updatePreference = (
    field: Exclude<keyof OrganizationFormState["preferences"], "paymentTerms" | "deliveryTerms">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      preferences: { ...current.preferences, [field]: value },
    }))
  }

  const updatePaymentTerms = (paymentTerms: PaymentTermTemplate[]) => {
    const defaultPaymentTerm = paymentTerms.find((term) => term.isDefault)
    setForm((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        paymentTerms,
        defaultTerms: defaultPaymentTerm?.text ?? "",
      },
    }))
  }

  const addPaymentTerm = () => {
    const nextTerm: PaymentTermTemplate = {
      id: createPaymentTermId(),
      name: "",
      text: "",
      isDefault: form.preferences.paymentTerms.length === 0,
    }
    updatePaymentTerms([...form.preferences.paymentTerms, nextTerm])
  }

  const updatePaymentTerm = (
    id: string,
    field: "name" | "text",
    value: string,
  ) => {
    updatePaymentTerms(
      form.preferences.paymentTerms.map((term) =>
        term.id === id ? { ...term, [field]: value } : term,
      ),
    )
  }

  const setDefaultPaymentTerm = (id: string) => {
    updatePaymentTerms(
      form.preferences.paymentTerms.map((term) => ({
        ...term,
        isDefault: term.id === id,
      })),
    )
  }

  const deletePaymentTerm = (id: string) => {
    const term = form.preferences.paymentTerms.find((item) => item.id === id)
    if (!term) return
    if (term.isDefault) {
      toast.error("Choose another default payment term before deleting this one")
      return
    }
    updatePaymentTerms(form.preferences.paymentTerms.filter((item) => item.id !== id))
  }

  const updateDeliveryTerms = (deliveryTerms: DeliveryTermTemplate[]) => {
    setForm((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        deliveryTerms,
      },
    }))
  }

  const addDeliveryTerm = () => {
    const nextTerm: DeliveryTermTemplate = {
      id: createDeliveryTermId(),
      name: "",
      text: "",
      isDefault: form.preferences.deliveryTerms.length === 0,
    }
    updateDeliveryTerms([...form.preferences.deliveryTerms, nextTerm])
  }

  const updateDeliveryTerm = (
    id: string,
    field: "name" | "text",
    value: string,
  ) => {
    updateDeliveryTerms(
      form.preferences.deliveryTerms.map((term) =>
        term.id === id ? { ...term, [field]: value } : term,
      ),
    )
  }

  const setDefaultDeliveryTerm = (id: string) => {
    updateDeliveryTerms(
      form.preferences.deliveryTerms.map((term) => ({
        ...term,
        isDefault: term.id === id,
      })),
    )
  }

  const deleteDeliveryTerm = (id: string) => {
    const term = form.preferences.deliveryTerms.find((item) => item.id === id)
    if (!term) return
    if (term.isDefault) {
      toast.error("Choose another default delivery term before deleting this one")
      return
    }
    updateDeliveryTerms(form.preferences.deliveryTerms.filter((item) => item.id !== id))
  }

  const updateThemePreference = (value: OrganizationFormState["preferences"]["theme"]) => {
    updatePreference("theme", value)
    previewTheme(value)
  }

  const updateColorThemePreference = (name: string) => {
    updatePreference("colorTheme", name)
    previewColorTheme(name)
  }

  const paymentTerms = form.preferences.paymentTerms
  const hasInvalidPaymentTerms = paymentTerms.some(
    (term) => !term.name.trim() || !term.text.trim(),
  )
  const hasPaymentTermsWithoutDefault =
    paymentTerms.length > 0 && !paymentTerms.some((term) => term.isDefault)
  const deliveryTerms = form.preferences.deliveryTerms
  const hasInvalidDeliveryTerms = deliveryTerms.some(
    (term) => !term.name.trim() || !term.text.trim(),
  )
  const hasDeliveryTermsWithoutDefault =
    deliveryTerms.length > 0 && !deliveryTerms.some((term) => term.isDefault)

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

              <div className="space-y-3">
                <Label htmlFor="organizationLogo">Organization logo</Label>
                <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-lg border bg-background">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt={`${form.name || "Organization"} logo`} className="max-h-16 max-w-28 object-contain" />
                    ) : (
                      <Building2Icon className="size-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      id="organizationLogo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      disabled={uploadingLogo}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void uploadLogo(file)
                        event.target.value = ""
                      }}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG. Max 2MB. Save organization settings after upload.</p>
                    {form.logoUrl && (
                      <Button type="button" variant="outline" size="sm" onClick={() => updateForm("logoUrl", "")}>
                        Remove Logo
                      </Button>
                    )}
                  </div>
                  {uploadingLogo && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>
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
            title="Letterheads"
            description="Manage image letterheads for future PDFs and emails."
            action={
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={uploadingLetterhead || letterheads.length >= MAX_LETTERHEADS}
                onClick={() => letterheadInputRef.current?.click()}
              >
                {uploadingLetterhead ? <Spinner data-icon="inline-start" /> : <PlusIcon className="size-4" />}
                Upload
              </Button>
            }
          >
            <div className="space-y-4 p-5">
              <input
                ref={letterheadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploadingLetterhead || letterheads.length >= MAX_LETTERHEADS}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadLetterhead(file)
                  event.target.value = ""
                }}
              />

              <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{letterheads.length} of {MAX_LETTERHEADS} letterheads saved</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG. Max 2MB each. Active changes save immediately.</p>
                </div>
                {letterheads.length >= MAX_LETTERHEADS && (
                  <p className="text-xs font-medium text-muted-foreground">Delete one to upload another.</p>
                )}
              </div>

              {letterheads.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed p-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No letterheads uploaded</p>
                    <p className="text-xs text-muted-foreground">
                      Upload organization letterhead images now so PDFs and emails can use them later.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {letterheads.map((letterhead) => {
                    const isActive = letterhead.id === activeLetterheadId
                    const previewUrl = letterheadPreviewUrls[letterhead.id]
                    const busy = settingActiveLetterheadId === letterhead.id || deletingLetterheadId === letterhead.id

                    return (
                      <div key={letterhead.id} className={`overflow-hidden rounded-xl border bg-background ${isActive ? "border-primary" : ""}`}>
                        <div className="flex h-36 items-center justify-center bg-muted/30">
                          {previewUrl ? (
                            <img src={previewUrl} alt={letterhead.originalName || "Organization letterhead"} className="max-h-32 max-w-full object-contain" />
                          ) : (
                            <ImageIcon className="size-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{letterhead.originalName || "Letterhead image"}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(letterhead.size)} · {formatDate(letterhead.createdAt)}
                              </p>
                            </div>
                            {isActive && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                <CheckCircle2Icon className="size-3" />
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={isActive ? "secondary" : "outline"}
                              size="sm"
                              disabled={isActive || busy}
                              onClick={() => void setActiveLetterhead(letterhead.id)}
                            >
                              {settingActiveLetterheadId === letterhead.id && <Spinner data-icon="inline-start" />}
                              {isActive ? "In use" : "Use this"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={busy}
                              onClick={() => void deleteLetterhead(letterhead.id)}
                            >
                              {deletingLetterheadId === letterhead.id ? <Spinner data-icon="inline-start" /> : <Trash2Icon className="size-4" />}
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </SettingsCard>

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
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={colorInputValue(form.preferences.primaryColor)}
                      onChange={(event) => updatePreference("primaryColor", event.target.value)}
                      className="w-12 p-1"
                    />
                    <Input
                      value={form.preferences.primaryColor}
                      onChange={(event) => updatePreference("primaryColor", event.target.value)}
                      placeholder="#f5b400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="theme">Mode</Label>
                  <Select
                    value={form.preferences.theme}
                    onValueChange={(value) =>
                      updateThemePreference(value as OrganizationFormState["preferences"]["theme"])
                    }
                  >
                    <SelectTrigger id="theme" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pricing">Pricing currency</Label>
                  <Input id="pricing" value={form.preferences.pricing} onChange={(event) => updatePreference("pricing", event.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultUpiId">UPI ID</Label>
                <p className="text-[13px] text-muted-foreground">
                  Invoices with a balance due include a scan-to-pay UPI QR code on the PDF. Can be overridden per invoice.
                </p>
                <Input
                  id="defaultUpiId"
                  value={form.preferences.defaultUpiId}
                  onChange={(event) => updatePreference("defaultUpiId", event.target.value)}
                  placeholder="business@upi"
                  className="sm:max-w-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Invoice template</Label>
                <p className="text-[13px] text-muted-foreground">
                  The default design for new invoice PDFs. Can be overridden per invoice.
                </p>
                <div className="grid gap-3 pt-1 sm:grid-cols-3">
                  {INVOICE_TEMPLATE_OPTIONS.map((template) => {
                    const selected = form.preferences.defaultInvoiceTemplate === template.id
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => updatePreference("defaultInvoiceTemplate", template.id)}
                        aria-pressed={selected}
                        className={`group flex flex-col overflow-hidden rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="aspect-[3/4] w-full overflow-hidden border-b bg-muted/30">
                          <img
                            src={`/invoice-templates/${template.id}.svg`}
                            alt={`${template.label} invoice template preview`}
                            className="h-full w-full object-cover object-top"
                            loading="lazy"
                          />
                        </div>
                        <div className="space-y-1 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{template.label}</span>
                            {selected ? <CheckIcon className="size-4 text-primary" /> : null}
                          </div>
                          <p className="text-xs leading-snug text-muted-foreground">{template.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Color theme</Label>
                <p className="text-[13px] text-muted-foreground">
                  Sets the default color theme for all users in this organization.
                </p>
                <ThemePicker
                  value={form.preferences.colorTheme}
                  onChange={updateColorThemePreference}
                  className="pt-1"
                />
              </div>

              <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label>Payment terms</Label>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Save reusable templates for RFQs. The default is preselected when a quote is created.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addPaymentTerm} className="gap-2">
                    <PlusIcon className="size-3.5" />
                    Add Term
                  </Button>
                </div>

                {paymentTerms.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Add a payment term template to make it available in RFQs.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentTerms.map((term) => (
                      <div key={term.id} className="rounded-lg border bg-card/70 p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Input
                            value={term.name}
                            onChange={(event) => updatePaymentTerm(term.id, "name", event.target.value)}
                            placeholder="Term name, e.g. Net 30"
                            className="h-9 min-w-44 flex-1"
                          />
                          <Button
                            type="button"
                            variant={term.isDefault ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setDefaultPaymentTerm(term.id)}
                            className="gap-1.5"
                          >
                            {term.isDefault && <CheckCircle2Icon className="size-3.5" />}
                            {term.isDefault ? "Default" : "Make default"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePaymentTerm(term.id)}
                            disabled={term.isDefault}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                        <textarea
                          rows={4}
                          value={term.text}
                          onChange={(event) => updatePaymentTerm(term.id, "text", event.target.value)}
                          placeholder="Payment due within 30 days from invoice date..."
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {hasInvalidPaymentTerms && (
                  <p className="text-xs text-destructive">Each payment term needs a name and text before saving.</p>
                )}
                {hasPaymentTermsWithoutDefault && (
                  <p className="text-xs text-destructive">Choose one payment term as the default.</p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label>Delivery terms</Label>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Save reusable delivery templates for RFQs. The default is preselected when a quote is created.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addDeliveryTerm} className="gap-2">
                    <PlusIcon className="size-3.5" />
                    Add Term
                  </Button>
                </div>

                {deliveryTerms.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Add a delivery term template to make it available in RFQs.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deliveryTerms.map((term) => (
                      <div key={term.id} className="rounded-lg border bg-card/70 p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Input
                            value={term.name}
                            onChange={(event) => updateDeliveryTerm(term.id, "name", event.target.value)}
                            placeholder="Term name, e.g. Standard delivery"
                            className="h-9 min-w-44 flex-1"
                          />
                          <Button
                            type="button"
                            variant={term.isDefault ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setDefaultDeliveryTerm(term.id)}
                            className="gap-1.5"
                          >
                            {term.isDefault && <CheckCircle2Icon className="size-3.5" />}
                            {term.isDefault ? "Default" : "Make default"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteDeliveryTerm(term.id)}
                            disabled={term.isDefault}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                        <textarea
                          rows={4}
                          value={term.text}
                          onChange={(event) => updateDeliveryTerm(term.id, "text", event.target.value)}
                          placeholder="Delivery will be completed within 2-3 weeks from order confirmation..."
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {hasInvalidDeliveryTerms && (
                  <p className="text-xs text-destructive">Each delivery term needs a name and text before saving.</p>
                )}
                {hasDeliveryTermsWithoutDefault && (
                  <p className="text-xs text-destructive">Choose one delivery term as the default.</p>
                )}
              </div>

              <div className="flex">
                <Button
                  onClick={saveOrganization}
                  disabled={
                    saving ||
                    !form.name.trim() ||
                    hasInvalidPaymentTerms ||
                    hasPaymentTermsWithoutDefault ||
                    hasInvalidDeliveryTerms ||
                    hasDeliveryTermsWithoutDefault
                  }
                >
                  {saving && <Spinner data-icon="inline-start" />}
                  Save Organization
                </Button>
              </div>
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  )
}

function AccountTab() {
  const { data: session, isPending: loadingSession } = useSession()
  const { hasFeature } = useEntitlements()
  const [accounts, setAccounts] = useState<GmailAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [gmailError, setGmailError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const quotationsEnabled = hasFeature("rfq")

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
    if (!quotationsEnabled) {
      setGmailError("Quotations are not enabled for this organization.")
      return
    }

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
      toast.success("Gmail account disconnected")
    } catch (err: any) {
      setGmailError(err.message || "Failed to disconnect Gmail")
      toast.error(err.message || "Failed to disconnect Gmail")
    } finally {
      setDisconnectingId(null)
    }
  }

  const user = session?.user
  const displayName = user?.name || user?.email || "Signed-in user"
  const displayEmail = user?.email || "Email unavailable"
  const initials = getInitials(displayName)
  const sessionImage = user?.image ?? ""

  useEffect(() => {
    let cancelled = false

    if (!sessionImage) {
      setAvatarUrl("")
      return
    }

    void resolveUploadedImageUrl(sessionImage)
      .then((url) => {
        if (!cancelled) setAvatarUrl(url)
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [sessionImage])

  const handleAvatarFileSelected = (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please choose a PNG, JPG, or WebP image.")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(typeof reader.result === "string" ? reader.result : null)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarUploaded = async (result: AvatarCropResult) => {
    try {
      await updateUser({ image: result.key })
      setAvatarUrl(result.displayUrl)
      toast.success("Profile picture updated")
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile picture")
    }
  }

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true)
    try {
      await updateUser({ image: null })
      setAvatarUrl("")
      toast.success("Profile picture removed")
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove profile picture")
    } finally {
      setRemovingAvatar(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account"
        description="Your signed-in identity and connected inboxes."
      />

      <SettingsCard
        title="Account Identity"
        description="This information comes from your BTSA login."
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="group relative size-16 shrink-0 overflow-hidden rounded-2xl border shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label="Change profile picture"
            >
              <Avatar className="size-full rounded-2xl after:rounded-2xl">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} className="rounded-2xl object-cover" />
                <AvatarFallback className="rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                  {loadingSession ? <Spinner /> : initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <CameraIcon className="size-5" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{loadingSession ? "Loading account..." : displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{loadingSession ? "Checking current session" : displayEmail}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  Change Photo
                </button>
                {sessionImage && (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
                    onClick={handleRemoveAvatar}
                    disabled={removingAvatar}
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            Authenticated
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleAvatarFileSelected(file)
            event.target.value = ""
          }}
        />
      </SettingsCard>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        onOpenChange={setCropOpen}
        onUploaded={handleAvatarUploaded}
        onError={(message) => toast.error(message)}
      />

      <SettingsCard
        title="Connected Gmail"
        description={
          quotationsEnabled
            ? "Authorize Gmail inboxes for RFQ processing and quote replies."
            : "Quotations are disabled for this organization. Re-enable Quotations before connecting Gmail."
        }
        action={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleConnectGmail}
            disabled={connecting || !quotationsEnabled}
          >
            {connecting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <MailIcon className="size-4" />
            )}
            Connect Gmail
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
                  {quotationsEnabled
                    ? "Connect Gmail to process incoming RFQs and send quotes on the same thread."
                    : "Gmail can be connected after Quotations are re-enabled."}
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
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }`}>
                        {account.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.watchExpiration
                        ? `Watch renews before ${formatDate(account.watchExpiration)}`
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
                  {disconnectingId === account._id && <Spinner data-icon="inline-start" />}
                  Disconnect
                </Button>
              </div>
            ))
          )}
        </div>
      </SettingsCard>
    </div>
  )
}

function MembersTab() {
  const { data: session } = useSession()
  const { canManageOrganization } = useEntitlements()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([])
  const [email, setEmail] = useState("")
  const [selectedInviteGroupIds, setSelectedInviteGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [transferTarget, setTransferTarget] = useState<OrganizationMember | null>(null)
  const [groupEditTarget, setGroupEditTarget] = useState<OrganizationMember | null>(null)
  const [groupEditIds, setGroupEditIds] = useState<string[]>([])
  const [savingGroups, setSavingGroups] = useState(false)
  const [transferConfirmation, setTransferConfirmation] = useState("")
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentUserId = session?.user?.id
  const isCurrentUserOwner = members.some((member) => member.userId === currentUserId && member.role === "owner")
  const transferTargetEmail = transferTarget?.userEmail?.toLowerCase() ?? ""
  const transferConfirmationMatches =
    Boolean(transferTargetEmail) && transferConfirmation.trim().toLowerCase() === transferTargetEmail

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [membersRes, invitationsRes, groupsRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/v1/organization/members`, {
          credentials: "include",
        }),
        fetch(`${API_ORIGIN}/api/v1/organization/invitations`, {
          credentials: "include",
        }),
        fetch(`${API_ORIGIN}/api/v1/organization/access-groups`, {
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

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        const loadedGroups = groupsData.accessGroups ?? []
        setAccessGroups(loadedGroups)
        setSelectedInviteGroupIds((current) => {
          if (current.length > 0) return current
          const membersGroup = loadedGroups.find((group: AccessGroup) => group.defaultKey === "members")
          return membersGroup ? [membersGroup._id] : []
        })
      } else if (groupsRes.status !== 403) {
        const groupsData = await groupsRes.json().catch(() => null)
        throw new Error(groupsData?.error || "Failed to load access groups")
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
    let cancelled = false
    const pending = members.filter(
      (member) => member.userImage && !memberAvatars[member.userId],
    )
    if (pending.length === 0) return

    void Promise.all(
      pending.map(async (member) => {
        try {
          const url = await resolveUploadedImageUrl(member.userImage as string)
          return [member.userId, url] as const
        } catch {
          return null
        }
      }),
    ).then((entries) => {
      if (cancelled) return
      const resolved = entries.filter((entry): entry is readonly [string, string] => entry !== null)
      if (resolved.length === 0) return
      setMemberAvatars((prev) => {
        const next = { ...prev }
        for (const [userId, url] of resolved) next[userId] = url
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [members, memberAvatars])

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
        body: JSON.stringify({ email, accessGroupIds: selectedInviteGroupIds }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to send invitation")
      setEmail("")
      const membersGroup = accessGroups.find((group) => group.defaultKey === "members")
      setSelectedInviteGroupIds(membersGroup ? [membersGroup._id] : [])
      setMessage("Invitation sent")
      toast.success("Invitation sent")
      await fetchMembers()
    } catch (err: any) {
      setError(err.message || "Failed to send invitation")
      toast.error(err.message || "Failed to send invitation")
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
      toast.success("Invitation cancelled")
    } catch (err: any) {
      setError(err.message || "Failed to cancel invitation")
      toast.error(err.message || "Failed to cancel invitation")
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
      toast.success("Member removed")
    } catch (err: any) {
      setError(err.message || "Failed to remove member")
      toast.error(err.message || "Failed to remove member")
    }
  }

  const leaveOrganization = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/members/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to leave organization")
      }
      window.localStorage.removeItem(ACTIVE_ORGANIZATION_ID_KEY)
      toast.success("You left the organization")
      window.location.href = "/"
    } catch (err: any) {
      setError(err.message || "Failed to leave organization")
      toast.error(err.message || "Failed to leave organization")
    }
  }

  const openTransferDialog = (member: OrganizationMember) => {
    setTransferTarget(member)
    setTransferConfirmation("")
    setError(null)
  }

  const openGroupDialog = (member: OrganizationMember) => {
    setGroupEditTarget(member)
    setGroupEditIds((member.accessGroupIds ?? []).map(String))
    setError(null)
  }

  const saveMemberGroups = async () => {
    if (!groupEditTarget) return
    setSavingGroups(true)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/members/${groupEditTarget._id}/access-groups`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessGroupIds: groupEditIds }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to update member groups")
      setGroupEditTarget(null)
      setGroupEditIds([])
      await fetchMembers()
      toast.success("Member groups updated")
    } catch (err: any) {
      setError(err.message || "Failed to update member groups")
      toast.error(err.message || "Failed to update member groups")
    } finally {
      setSavingGroups(false)
    }
  }

  const transferOwnership = async () => {
    if (!transferTarget || !transferConfirmationMatches) return
    setError(null)
    setTransferringId(transferTarget._id)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/members/${transferTarget._id}/transfer-ownership`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to transfer ownership")
      const targetName = transferTarget.userName ?? transferTarget.userEmail ?? "member"
      setTransferTarget(null)
      setTransferConfirmation("")
      await fetchMembers()
      toast.success(`Ownership transferred to ${targetName}`)
    } catch (err: any) {
      setError(err.message || "Failed to transfer ownership")
      toast.error(err.message || "Failed to transfer ownership")
    } finally {
      setTransferringId(null)
    }
  }

  return (
    <>
    <div className="space-y-6">
      <SectionHeader
        title="Members"
        description="Manage your team members and their roles."
      />

      {(error || message || accepting) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          error
            ? "border-destructive/20 bg-destructive/10 text-destructive"
            : "border-success/20 bg-success/10 text-success"
        }`}>
          {error || (accepting ? "Accepting invitation..." : message)}
        </div>
      )}

      <SettingsCard title="Invite Member" description="Send an email invitation to add a teammate to this organization.">
        <div className="grid gap-4 p-5">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
          />
          {canManageOrganization && accessGroups.length > 0 && (
            <AccessGroupChecklist
              groups={accessGroups}
              selectedIds={selectedInviteGroupIds}
              onChange={setSelectedInviteGroupIds}
              disabled={submitting}
            />
          )}
          <Button
            className="w-fit gap-1.5"
            onClick={inviteMember}
            disabled={submitting || !email.trim() || !canManageOrganization}
          >
            {submitting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Invite
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
                <Avatar size="lg">
                  <AvatarImage
                    src={memberAvatars[member.userId] || undefined}
                    alt={member.userName ?? member.userEmail ?? "Member"}
                  />
                  <AvatarFallback className="bg-primary/10 font-bold text-primary">
                    {(member.userName ?? member.userEmail ?? member.userId).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{member.userName ?? member.userEmail ?? member.userId}</p>
                    {member.userId === currentUserId && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        You
                      </span>
                    )}
                  </div>
                  {member.userEmail && (
                    <p className="text-xs text-muted-foreground">{member.userEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Joined {formatDate(member.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatLastSignIn(member.lastSignInAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden max-w-60 sm:block">
                  {member.role === "owner" ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <RoleBadge label="Owner" />
                      <AccessGroupBadges groups={member.accessGroups ?? []} />
                    </div>
                  ) : (
                    <AccessGroupBadges groups={member.accessGroups ?? []} />
                  )}
                </div>
                {member.role !== "owner" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Member actions">
                        <MoreVerticalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canManageOrganization && (
                        <DropdownMenuItem onSelect={() => openGroupDialog(member)}>
                          <ShieldCheckIcon />
                          Edit Groups
                        </DropdownMenuItem>
                      )}
                      {isCurrentUserOwner && member.userId !== currentUserId && (
                        <>
                          {canManageOrganization && <DropdownMenuSeparator />}
                          <DropdownMenuItem onSelect={() => openTransferDialog(member)}>
                            <CrownIcon />
                            Transfer Ownership
                          </DropdownMenuItem>
                        </>
                      )}
                      {member.userId === currentUserId ? (
                        <DropdownMenuItem variant="destructive" onSelect={() => void leaveOrganization(member._id)}>
                          <LogOutIcon />
                          Leave
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem variant="destructive" onSelect={() => void removeMember(member._id)}>
                          <Trash2Icon />
                          Remove Member
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    Expires {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <AccessGroupBadges groups={invitation.accessGroups ?? []} />
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
    <Dialog
      open={Boolean(groupEditTarget)}
      onOpenChange={(open) => {
        if (open || savingGroups) return
        setGroupEditTarget(null)
        setGroupEditIds([])
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Member Groups</DialogTitle>
          <DialogDescription>
            Choose which access groups apply to {groupEditTarget?.userName ?? groupEditTarget?.userEmail ?? "this member"}.
          </DialogDescription>
        </DialogHeader>
        <AccessGroupChecklist
          groups={accessGroups}
          selectedIds={groupEditIds}
          onChange={setGroupEditIds}
          disabled={savingGroups}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setGroupEditTarget(null)
              setGroupEditIds([])
            }}
            disabled={savingGroups}
          >
            Cancel
          </Button>
          <Button onClick={() => void saveMemberGroups()} disabled={savingGroups}>
            {savingGroups && <Spinner data-icon="inline-start" />}
            Save Groups
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={Boolean(transferTarget)}
      onOpenChange={(open) => {
        if (open || transferringId) return
        setTransferTarget(null)
        setTransferConfirmation("")
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            This immediately makes {transferTarget?.userName ?? transferTarget?.userEmail ?? "this member"} the organization owner.
            Your role will become Admin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{transferTarget?.userName ?? transferTarget?.userEmail ?? "Selected member"}</p>
            {transferTarget?.userEmail && (
              <p className="text-xs text-muted-foreground">{transferTarget.userEmail}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-confirmation">
              Type {transferTarget?.userEmail ?? "the member email"} to confirm
            </Label>
            <Input
              id="transfer-confirmation"
              value={transferConfirmation}
              onChange={(event) => setTransferConfirmation(event.target.value)}
              placeholder={transferTarget?.userEmail ?? "member@example.com"}
              disabled={Boolean(transferringId)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setTransferTarget(null)
              setTransferConfirmation("")
            }}
            disabled={Boolean(transferringId)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void transferOwnership()}
            disabled={!transferConfirmationMatches || Boolean(transferringId)}
          >
            {transferringId && <Spinner data-icon="inline-start" />}
            Transfer Ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function AccessGroupsTab() {
  const { canManageOrganization } = useEntitlements()
  const [groups, setGroups] = useState<AccessGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<AccessGroup | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [allModules, setAllModules] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [moduleAccess, setModuleAccess] = useState<EmployeeAccessModule[]>([])
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingGroup(null)
    setName("")
    setDescription("")
    setAllModules(false)
    setCanManage(false)
    setModuleAccess([])
  }

  const loadGroups = useCallback(async () => {
    if (!canManageOrganization) {
      setGroups([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/access-groups`, {
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load access groups")
      setGroups(data.accessGroups ?? [])
    } catch (err: any) {
      setError(err.message || "Failed to load access groups")
    } finally {
      setLoading(false)
    }
  }, [canManageOrganization])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const startEdit = (group: AccessGroup) => {
    setEditingGroup(group)
    setName(group.name)
    setDescription(group.description ?? "")
    setAllModules(group.allModules)
    setCanManage(group.canManageOrganization)
    setModuleAccess(group.moduleAccess ?? [])
    setError(null)
  }

  const saveGroup = async () => {
    setSaving(true)
    setError(null)
    try {
      const url = editingGroup
        ? `${API_ORIGIN}/api/v1/organization/access-groups/${editingGroup._id}`
        : `${API_ORIGIN}/api/v1/organization/access-groups`
      const res = await fetch(url, {
        method: editingGroup ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          allModules,
          canManageOrganization: canManage,
          moduleAccess: allModules ? [] : moduleAccess,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save access group")
      resetForm()
      await loadGroups()
      toast.success(editingGroup ? "Access group updated" : "Access group created")
    } catch (err: any) {
      setError(err.message || "Failed to save access group")
      toast.error(err.message || "Failed to save access group")
    } finally {
      setSaving(false)
    }
  }

  const deleteGroup = async (group: AccessGroup) => {
    if (group.isDefault) return
    const confirmed = window.confirm(`Delete ${group.name}? Members in this group will lose that access.`)
    if (!confirmed) return

    setDeletingId(group._id)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/access-groups/${group._id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete access group")
      }
      await loadGroups()
      if (editingGroup?._id === group._id) resetForm()
      toast.success("Access group deleted")
    } catch (err: any) {
      setError(err.message || "Failed to delete access group")
      toast.error(err.message || "Failed to delete access group")
    } finally {
      setDeletingId(null)
    }
  }

  if (!canManageOrganization) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Access Groups"
          description="Groups control module access and organization management permissions."
        />
        <SettingsCard title="Access Restricted" description="You do not have permission to manage access groups.">
          <div className="px-5 py-5 text-sm text-muted-foreground">
            Ask an organization admin to update your access.
          </div>
        </SettingsCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Access Groups"
        description="Configure module access and management permissions for organization members."
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <SettingsCard
        title={editingGroup ? "Edit Access Group" : "Create Access Group"}
        description="Choose modules and whether this group can manage organization settings."
        action={editingGroup ? (
          <Button variant="outline" size="sm" onClick={resetForm}>
            New Group
          </Button>
        ) : null}
      >
        <div className="grid gap-4 p-5">
          <div className="grid gap-2">
            <Label htmlFor="access-group-name">Group name</Label>
            <Input
              id="access-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sales Team"
              disabled={saving || Boolean(editingGroup?.isDefault)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="access-group-description">Description</Label>
            <Input
              id="access-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional note for admins"
              disabled={saving}
            />
          </div>
          <div className="grid gap-3 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">All Modules</p>
                <p className="text-xs text-muted-foreground">Automatically include current and future modules.</p>
              </div>
              <Switch checked={allModules} onCheckedChange={setAllModules} disabled={saving} />
            </div>
            {!allModules && (
              <ModuleAccessChecklist
                selectedModules={moduleAccess}
                onChange={setModuleAccess}
                disabled={saving}
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Can Manage Organization</p>
              <p className="text-xs text-muted-foreground">Allows managing members, groups, settings, and admin actions.</p>
            </div>
            <Switch checked={canManage} onCheckedChange={setCanManage} disabled={saving} />
          </div>
          <Button className="w-fit" onClick={() => void saveGroup()} disabled={saving || !name.trim()}>
            {saving && <Spinner data-icon="inline-start" />}
            {editingGroup ? "Save Group" : "Create Group"}
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Access Groups" description={`${groups.length} active groups in this organization.`}>
        <div className="divide-y">
          {loading ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">Loading access groups...</div>
          ) : groups.length === 0 ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">No access groups found.</div>
          ) : groups.map((group) => (
            <div key={group._id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{group.name}</p>
                  {group.isDefault && <Badge variant="secondary">Default</Badge>}
                  {group.canManageOrganization && <Badge>Admin Powers</Badge>}
                  {group.allModules && <Badge variant="outline">All Modules</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {group.description || "No description"} - {group.memberCount} members
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(group)}>
                  Edit
                </Button>
                {!group.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void deleteGroup(group)}
                    disabled={deletingId === group._id}
                  >
                    {deletingId === group._id ? <Spinner data-icon="inline-start" /> : <Trash2Icon className="size-4" />}
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  )
}

// ─── Support Tab ──────────────────────────────────────────────

interface ReplyTemplate {
  id: string
  title: string
  body: string
  shortcut: string
  createdAt: string
  updatedAt: string
}

interface SupportAiSettings {
  enabled: boolean
  instructions: string
  updatedBy: string | null
  updatedAt: string | null
}

interface SupportChatSettings {
  emailTranscriptEnabled: boolean
  updatedBy: string | null
  updatedAt: string | null
}

interface SupportCallSettings {
  enabled: boolean
  voice: string
  greeting: string
  instructions: string
  recordingEnabled: boolean
  updatedBy: string | null
  updatedAt: string | null
  supportedVoices: string[]
}

interface SupportCallPhoneNumber {
  id: string
  phoneNumber: string
  label: string
  status: string
}

interface SupportKnowledgeArticle {
  id: string
  title: string
  body: string
  tags: string[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const TEMPLATE_TEXTAREA_CLASS =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"

function SupportTicketTagsCard() {
  const { canManageOrganization } = useEntitlements()
  const [tags, setTags] = useState<SupportTicketTag[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [color, setColor] = useState<SupportTicketTagColor>("slate")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SupportTicketTag | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load ticket tags")
      setTags(data.tags ?? [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load ticket tags")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTags()
  }, [fetchTags])

  const resetForm = () => {
    setEditingId(null)
    setName("")
    setColor("slate")
  }

  const startEdit = (tag: SupportTicketTag) => {
    setEditingId(tag.id)
    setName(tag.name)
    setColor(tag.color)
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const url = editingId
        ? `${API_ORIGIN}/api/v1/support/ticket-tags/${editingId}`
        : `${API_ORIGIN}/api/v1/support/ticket-tags`
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save tag")
      toast.success(editingId ? "Tag updated" : "Tag created")
      resetForm()
      await fetchTags()
    } catch (err: any) {
      toast.error(err.message || "Failed to save tag")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/ticket-tags/${pendingDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to delete tag")
      toast.success("Tag deleted")
      if (editingId === pendingDelete.id) resetForm()
      setPendingDelete(null)
      await fetchTags()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tag")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SettingsCard
      title="Ticket Tags"
      description="Categorize support conversations (e.g. Service Calls, Warranty Support) and filter the inbox by tag."
    >
      <div className="space-y-4 p-5">
        {canManageOrganization ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor="ticketTagName">Tag name</Label>
              <Input
                id="ticketTagName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Warranty Support"
                maxLength={40}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void save()
                  }
                }}
              />
            </div>
            <div className="w-40 space-y-1.5">
              <Label htmlFor="ticketTagColor">Color</Label>
              <Select value={color} onValueChange={(value) => setColor(value as SupportTicketTagColor)}>
                <SelectTrigger id="ticketTagColor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TICKET_TAG_COLORS.map((option) => (
                    <SelectItem key={option} value={option}>
                      <span className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${TAG_DOT_STYLES[option]}`} />
                        <span className="capitalize">{option}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving || !name.trim()}>
                {saving && <Spinner data-icon="inline-start" />}
                {editingId ? "Save Tag" : "Add Tag"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only organization admins can create or edit tags. You can apply existing tags from a conversation.
          </p>
        )}

        <div className="rounded-xl border">
          {loading ? (
            <div className="px-4 py-5 text-sm text-muted-foreground">Loading tags...</div>
          ) : tags.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tags yet.{canManageOrganization ? " Create your first one above." : ""}
            </div>
          ) : (
            <div className="divide-y">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`size-2.5 shrink-0 rounded-full ${TAG_DOT_STYLES[tag.color] ?? TAG_DOT_STYLES.slate}`} />
                    <span className="truncate text-sm font-medium">{tag.name}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {tag.usageCount} {tag.usageCount === 1 ? "ticket" : "tickets"}
                    </span>
                  </div>
                  {canManageOrganization && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(tag)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(tag)}
                        aria-label="Delete tag"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? pendingDelete.usageCount > 0
                  ? `"${pendingDelete.name}" is applied to ${pendingDelete.usageCount} ${pendingDelete.usageCount === 1 ? "ticket" : "tickets"}. Deleting it removes the tag from those conversations. This cannot be undone.`
                  : `Delete the "${pendingDelete.name}" tag? This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Spinner data-icon="inline-start" />}
              Delete Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  )
}

function SupportTab() {
  const [settings, setSettings] = useState<SupportAiSettings>({
    enabled: true,
    instructions: "",
    updatedBy: null,
    updatedAt: null,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [chatSettings, setChatSettings] = useState<SupportChatSettings>({
    emailTranscriptEnabled: true,
    updatedBy: null,
    updatedAt: null,
  })
  const [chatSettingsLoading, setChatSettingsLoading] = useState(true)
  const [chatSettingsSaving, setChatSettingsSaving] = useState(false)
  const [callSettings, setCallSettings] = useState<SupportCallSettings>({
    enabled: true,
    voice: "marin",
    greeting: "",
    instructions: "",
    recordingEnabled: true,
    updatedBy: null,
    updatedAt: null,
    supportedVoices: ["marin"],
  })
  const [callPhoneNumbers, setCallPhoneNumbers] = useState<SupportCallPhoneNumber[]>([])
  const [callSettingsLoading, setCallSettingsLoading] = useState(true)
  const [callSettingsSaving, setCallSettingsSaving] = useState(false)
  const [articles, setArticles] = useState<SupportKnowledgeArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [articleEditingId, setArticleEditingId] = useState<string | null>(null)
  const [articleTitle, setArticleTitle] = useState("")
  const [articleBody, setArticleBody] = useState("")
  const [articleTags, setArticleTags] = useState("")
  const [articleEnabled, setArticleEnabled] = useState(true)
  const [articleSaving, setArticleSaving] = useState(false)
  const [articleDeletingId, setArticleDeletingId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<ReplyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [shortcut, setShortcut] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/ai/settings`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load AI agent settings")
      setSettings(data.settings ?? { enabled: true, instructions: "", updatedBy: null, updatedAt: null })
    } catch (err: any) {
      toast.error(err.message || "Failed to load AI agent settings")
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const saveSettings = async () => {
    setSettingsSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/ai/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          instructions: settings.instructions,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save AI agent settings")
      setSettings(data.settings)
      toast.success("AI agent settings saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save AI agent settings")
    } finally {
      setSettingsSaving(false)
    }
  }

  const fetchChatSettings = useCallback(async () => {
    setChatSettingsLoading(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/settings`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load chat widget settings")
      setChatSettings(
        data.settings ?? { emailTranscriptEnabled: true, updatedBy: null, updatedAt: null }
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to load chat widget settings")
    } finally {
      setChatSettingsLoading(false)
    }
  }, [])

  const saveChatSettings = async () => {
    setChatSettingsSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailTranscriptEnabled: chatSettings.emailTranscriptEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save chat widget settings")
      setChatSettings(data.settings)
      toast.success("Chat widget settings saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save chat widget settings")
    } finally {
      setChatSettingsSaving(false)
    }
  }

  const fetchCallSettings = useCallback(async () => {
    setCallSettingsLoading(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/call/settings`, {
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load voice agent settings")
      if (data.settings) setCallSettings(data.settings)
      setCallPhoneNumbers(data.phoneNumbers ?? [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load voice agent settings")
    } finally {
      setCallSettingsLoading(false)
    }
  }, [])

  const saveCallSettings = async () => {
    setCallSettingsSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/call/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: callSettings.enabled,
          voice: callSettings.voice,
          greeting: callSettings.greeting,
          instructions: callSettings.instructions,
          recordingEnabled: callSettings.recordingEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save voice agent settings")
      setCallSettings((current) => ({ ...current, ...data.settings }))
      toast.success("Voice agent settings saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save voice agent settings")
    } finally {
      setCallSettingsSaving(false)
    }
  }

  const fetchArticles = useCallback(async () => {
    setArticlesLoading(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/knowledge`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load knowledge base")
      setArticles(data.articles ?? [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load knowledge base")
    } finally {
      setArticlesLoading(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/templates`, { credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to load templates")
      setTemplates(data.templates ?? [])
    } catch (err: any) {
      setError(err.message || "Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
    void fetchChatSettings()
    void fetchCallSettings()
    void fetchArticles()
    void fetchTemplates()
  }, [fetchArticles, fetchCallSettings, fetchChatSettings, fetchSettings, fetchTemplates])

  const resetArticleForm = () => {
    setArticleEditingId(null)
    setArticleTitle("")
    setArticleBody("")
    setArticleTags("")
    setArticleEnabled(true)
  }

  const startArticleEdit = (article: SupportKnowledgeArticle) => {
    setArticleEditingId(article.id)
    setArticleTitle(article.title)
    setArticleBody(article.body)
    setArticleTags(article.tags.join(", "))
    setArticleEnabled(article.enabled)
  }

  const saveArticle = async () => {
    if (!articleTitle.trim() || !articleBody.trim()) return
    setArticleSaving(true)
    try {
      const url = articleEditingId
        ? `${API_ORIGIN}/api/v1/support/knowledge/${articleEditingId}`
        : `${API_ORIGIN}/api/v1/support/knowledge`
      const res = await fetch(url, {
        method: articleEditingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: articleTitle.trim(),
          body: articleBody.trim(),
          tags: articleTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          enabled: articleEnabled,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save knowledge article")
      toast.success(articleEditingId ? "Knowledge article updated" : "Knowledge article created")
      resetArticleForm()
      await fetchArticles()
    } catch (err: any) {
      toast.error(err.message || "Failed to save knowledge article")
    } finally {
      setArticleSaving(false)
    }
  }

  const toggleArticle = async (article: SupportKnowledgeArticle) => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/knowledge/${article.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !article.enabled }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to update article")
      setArticles((current) =>
        current.map((item) => (item.id === article.id ? data.article : item))
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update article")
    }
  }

  const removeArticle = async (id: string) => {
    setArticleDeletingId(id)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/knowledge/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to delete article")
      toast.success("Knowledge article deleted")
      if (articleEditingId === id) resetArticleForm()
      await fetchArticles()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete article")
    } finally {
      setArticleDeletingId(null)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle("")
    setBody("")
    setShortcut("")
  }

  const startEdit = (template: ReplyTemplate) => {
    setEditingId(template.id)
    setTitle(template.title)
    setBody(template.body)
    setShortcut(template.shortcut)
  }

  const save = async () => {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    try {
      const url = editingId
        ? `${API_ORIGIN}/api/v1/support/templates/${editingId}`
        : `${API_ORIGIN}/api/v1/support/templates`
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), shortcut: shortcut.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save template")
      toast.success(editingId ? "Template updated" : "Template created")
      resetForm()
      await fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/support/templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete template")
      }
      toast.success("Template deleted")
      if (editingId === id) resetForm()
      await fetchTemplates()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Support"
        description="Configure the AI agent, knowledge base, and saved replies your team uses in support."
      />

      <SettingsCard
        title="AI Agent"
        description="Copilot handles new support chats automatically until a teammate takes over."
      >
        <div className="space-y-5 p-5">
          {settingsLoading ? (
            <div className="text-sm text-muted-foreground">Loading AI agent settings...</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="supportAiEnabled" className="text-sm font-medium">
                    Enable Copilot for new chats
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When enabled, new support chats start in autonomous AI mode. Agents can pause,
                    resume, or take over each conversation.
                  </p>
                </div>
                <Switch
                  id="supportAiEnabled"
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => setSettings((current) => ({ ...current, enabled }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supportAiInstructions">Instructions</Label>
                <textarea
                  id="supportAiInstructions"
                  rows={7}
                  value={settings.instructions}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, instructions: event.target.value }))
                  }
                  placeholder="Tell the agent how to answer, what tone to use, what policies to follow, and when to escalate to your team."
                  className={TEMPLATE_TEXTAREA_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  The AI can use these Instructions, enabled knowledge articles, reply templates,
                  and the conversation history. It cannot access private orders, billing, or
                  account data unless you add those tools later.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button onClick={saveSettings} disabled={settingsSaving}>
                  {settingsSaving && <Spinner data-icon="inline-start" />}
                  Save AI Agent
                </Button>
                {settings.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last saved {formatDateTime(settings.updatedAt)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Chat Widget"
        description="Control what visitors see in your embedded support chat."
      >
        <div className="space-y-5 p-5">
          {chatSettingsLoading ? (
            <div className="text-sm text-muted-foreground">Loading chat widget settings...</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="supportEmailTranscript" className="text-sm font-medium">
                    Offer to email a copy of the conversation
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When enabled, visitors can tick a box on the pre-chat form to get the full
                    transcript emailed to them after the chat ends.
                  </p>
                </div>
                <Switch
                  id="supportEmailTranscript"
                  checked={chatSettings.emailTranscriptEnabled}
                  onCheckedChange={(emailTranscriptEnabled) =>
                    setChatSettings((current) => ({ ...current, emailTranscriptEnabled }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button onClick={saveChatSettings} disabled={chatSettingsSaving}>
                  {chatSettingsSaving && <Spinner data-icon="inline-start" />}
                  Save Chat Widget
                </Button>
                {chatSettings.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last saved {formatDateTime(chatSettings.updatedAt)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Voice Agent"
        description="Answer inbound support calls with a realtime AI voice agent on your connected phone numbers."
      >
        <div className="space-y-5 p-5">
          {callSettingsLoading ? (
            <div className="text-sm text-muted-foreground">Loading voice agent settings...</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="supportCallEnabled" className="text-sm font-medium">
                    Answer inbound calls with the voice agent
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When enabled, calls to your connected numbers are answered by a realtime AI
                    agent that can look up your knowledge base and open support tickets.
                  </p>
                </div>
                <Switch
                  id="supportCallEnabled"
                  checked={callSettings.enabled}
                  onCheckedChange={(enabled) =>
                    setCallSettings((current) => ({ ...current, enabled }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Connected phone numbers</Label>
                {callPhoneNumbers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No phone numbers are assigned to your organization yet. Ask an administrator to
                    assign one before the voice agent can take calls.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {callPhoneNumbers.map((number) => (
                      <Badge
                        key={number.id}
                        variant={number.status === "active" ? "default" : "secondary"}
                        className="font-mono"
                      >
                        {number.phoneNumber}
                        {number.label ? ` · ${number.label}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supportCallVoice">Voice</Label>
                <Select
                  value={callSettings.voice}
                  onValueChange={(voice) =>
                    setCallSettings((current) => ({ ...current, voice }))
                  }
                >
                  <SelectTrigger id="supportCallVoice" className="w-full sm:w-64">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {callSettings.supportedVoices.map((voice) => (
                      <SelectItem key={voice} value={voice}>
                        {voice.charAt(0).toUpperCase() + voice.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supportCallGreeting">Greeting</Label>
                <textarea
                  id="supportCallGreeting"
                  rows={2}
                  value={callSettings.greeting}
                  onChange={(event) =>
                    setCallSettings((current) => ({ ...current, greeting: event.target.value }))
                  }
                  placeholder="e.g. Thanks for calling Acme support, how can I help you today?"
                  className={TEMPLATE_TEXTAREA_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  Spoken to the caller when the agent answers. Leave blank to use a default greeting.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supportCallInstructions">Instructions</Label>
                <textarea
                  id="supportCallInstructions"
                  rows={7}
                  value={callSettings.instructions}
                  onChange={(event) =>
                    setCallSettings((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  placeholder="Tell the voice agent how to speak, what policies to follow, and when to create a ticket or escalate."
                  className={TEMPLATE_TEXTAREA_CLASS}
                />
                <p className="text-xs text-muted-foreground">
                  The agent can use these Instructions, your enabled knowledge articles, and the
                  live conversation to help callers.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="supportCallRecording" className="text-sm font-medium">
                    Record calls
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    When enabled, call recordings are saved and attached to the support ticket
                    created for each call.
                  </p>
                </div>
                <Switch
                  id="supportCallRecording"
                  checked={callSettings.recordingEnabled}
                  onCheckedChange={(recordingEnabled) =>
                    setCallSettings((current) => ({ ...current, recordingEnabled }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button onClick={saveCallSettings} disabled={callSettingsSaving}>
                  {callSettingsSaving && <Spinner data-icon="inline-start" />}
                  Save Voice Agent
                </Button>
                {callSettings.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last saved {formatDateTime(callSettings.updatedAt)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title={articleEditingId ? "Edit Knowledge Article" : "New Knowledge Article"}
        description="Manual articles give the AI reliable business context for support replies."
      >
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div className="space-y-1.5">
              <Label htmlFor="knowledgeTitle">Title</Label>
              <Input
                id="knowledgeTitle"
                value={articleTitle}
                onChange={(event) => setArticleTitle(event.target.value)}
                placeholder="e.g. Return policy"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="knowledgeTags">Tags</Label>
              <Input
                id="knowledgeTags"
                value={articleTags}
                onChange={(event) => setArticleTags(event.target.value)}
                placeholder="returns, shipping"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="knowledgeBody">Content</Label>
            <textarea
              id="knowledgeBody"
              rows={6}
              value={articleBody}
              onChange={(event) => setArticleBody(event.target.value)}
              placeholder="Write the exact policy, answer, or process the AI should rely on."
              className={TEMPLATE_TEXTAREA_CLASS}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={articleEnabled} onCheckedChange={setArticleEnabled} />
              Enabled for AI replies
            </label>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveArticle}
                disabled={articleSaving || !articleTitle.trim() || !articleBody.trim()}
              >
                {articleSaving && <Spinner data-icon="inline-start" />}
                {articleEditingId ? "Save Article" : "Create Article"}
              </Button>
              {articleEditingId && (
                <Button variant="outline" onClick={resetArticleForm} disabled={articleSaving}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Knowledge Base"
        description={`${articles.length} ${articles.length === 1 ? "article" : "articles"} available for the support AI agent.`}
      >
        <div className="divide-y">
          {articlesLoading ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">Loading knowledge base...</div>
          ) : articles.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No knowledge articles yet. Create the first one above.
            </div>
          ) : (
            articles.map((article) => (
              <div key={article.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{article.title}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {article.enabled ? "Enabled" : "Disabled"}
                    </span>
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">
                    {article.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleArticle(article)}>
                    {article.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => startArticleEdit(article)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeArticle(article.id)}
                    disabled={articleDeletingId === article.id}
                    aria-label="Delete knowledge article"
                  >
                    {articleDeletingId === article.id ? <Spinner /> : <Trash2Icon className="size-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      <SupportTicketTagsCard />

      <SettingsCard
        title={editingId ? "Edit Template" : "New Template"}
        description="Use placeholders like {{name}}, {{first_name}}, or {{ticket_number}} — they fill in when inserted."
      >
        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="space-y-1.5">
              <Label htmlFor="tplTitle">Title</Label>
              <Input
                id="tplTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Greeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplShortcut">Shortcut (optional)</Label>
              <Input
                id="tplShortcut"
                value={shortcut}
                onChange={(event) => setShortcut(event.target.value)}
                placeholder="greeting"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tplBody">Message</Label>
            <textarea
              id="tplBody"
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Hi {{first_name}}, thanks for reaching out..."
              className={TEMPLATE_TEXTAREA_CLASS}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || !title.trim() || !body.trim()}>
              {saving && <Spinner data-icon="inline-start" />}
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Saved Templates"
        description={`${templates.length} ${templates.length === 1 ? "template" : "templates"} available in the composer.`}
      >
        <div className="divide-y">
          {loading ? (
            <div className="px-5 py-5 text-sm text-muted-foreground">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No templates yet. Create your first one above.
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{template.title}</p>
                    {template.shortcut && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        /{template.shortcut}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">
                    {template.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(template)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(template.id)}
                    disabled={deletingId === template.id}
                    aria-label="Delete template"
                  >
                    {deletingId === template.id ? <Spinner /> : <Trash2Icon className="size-4" />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsCard>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────

export function SettingsPage() {
  const { tab } = useSearch({ from: "/settings" })
  const {
    canManageOrganization,
    hasFeature,
    hasModuleAccess,
    loading: entitlementsLoading,
  } = useEntitlements()
  const canShowManagementTabs = !entitlementsLoading && canManageOrganization
  const canShowSupportTab =
    !entitlementsLoading && hasFeature("support") && hasModuleAccess("support")
  const settingsTabs = useMemo(
    () => [
      {
        value: "organization",
        label: "Organization",
        icon: Building2Icon,
        isVisible: canShowManagementTabs,
        content: <OrganizationTab />,
      },
      {
        value: "account",
        label: "Account",
        icon: KeyIcon,
        isVisible: true,
        content: <AccountTab />,
      },
      {
        value: "members",
        label: "Members",
        icon: UsersIcon,
        isVisible: canShowManagementTabs,
        content: <MembersTab />,
      },
      {
        value: "access-groups",
        label: "Access Groups",
        icon: ShieldCheckIcon,
        isVisible: canShowManagementTabs,
        content: <AccessGroupsTab />,
      },
      {
        value: "support",
        label: "Support",
        icon: MessageSquareTextIcon,
        isVisible: canShowSupportTab,
        content: <SupportTab />,
      },
      {
        value: "notifications",
        label: "Notifications",
        icon: MailIcon,
        isVisible: canShowManagementTabs,
        content: <NotificationsTab />,
      },
    ],
    [canShowManagementTabs, canShowSupportTab],
  )
  const visibleTabs = settingsTabs.filter((settingsTab) => settingsTab.isVisible)
  const activeTab = visibleTabs.some((settingsTab) => settingsTab.value === tab)
    ? tab
    : visibleTabs[0]?.value

  return (
    <AppLayout>
      <SiteHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-5xl px-6 py-8 lg:px-10">
          <div className="mb-7 max-w-2xl">
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
          </div>

          <Tabs defaultValue={activeTab} key={activeTab}>
            <div className="mb-6 overflow-x-auto">
              <TabsList className="h-auto rounded-2xl bg-muted/60 p-1.5">
                {visibleTabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-1.5">
                    <Icon className="size-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="max-w-3xl">
              {visibleTabs.map(({ value, content }) => (
                <TabsContent key={value} value={value} className="mt-0">
                  {content}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}

// ─── Notifications Tab ───────────────────────────────────────

interface DigestPreferences {
  enabled: boolean
  recipientMode: "all_members" | "custom"
  memberRecipientUserIds: string[]
  externalRecipientEmails: string[]
  sendTimeLocal: string
  timezone: string
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
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const [prefs, setPrefs] = useState<DigestPreferences>({
    enabled: false,
    recipientMode: "all_members",
    memberRecipientUserIds: [],
    externalRecipientEmails: [],
    sendTimeLocal: "08:00",
    timezone: browserTimezone,
    sections: { emailVolume: true, rfqBreakdown: true, productRequests: true, matchQuality: true },
    sendHourUtc: 8,
  })
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [externalEmail, setExternalEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/digest/preferences`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const loadedMembers = data.members ?? []
        setMembers(loadedMembers)
        setPrefs({
          enabled: data.enabled ?? false,
          recipientMode: data.recipientMode ?? "all_members",
          memberRecipientUserIds:
            data.memberRecipientUserIds ?? loadedMembers.map((member: OrganizationMember) => member.userId),
          externalRecipientEmails: data.externalRecipientEmails ?? [],
          sendTimeLocal: data.sendTimeLocal ?? "08:00",
          timezone: data.timezone ?? browserTimezone,
          sections: {
            emailVolume: data.sections?.emailVolume ?? true,
            rfqBreakdown: data.sections?.rfqBreakdown ?? true,
            productRequests: data.sections?.productRequests ?? true,
            matchQuality: data.sections?.matchQuality ?? true,
          },
          sendHourUtc: data.sendHourUtc ?? 8,
        })
      })
      .catch(() => {
        toast.error("Failed to load notification preferences")
      })
      .finally(() => setLoading(false))
  }, [browserTimezone])

  const handleSave = async () => {
    if (prefs.recipientMode === "custom" && prefs.memberRecipientUserIds.length + prefs.externalRecipientEmails.length === 0) {
      toast.error("Select at least one digest recipient")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/digest/preferences`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save notification preferences")
      setPrefs((prev) => ({ ...prev, ...data }))
      if (data?.members) setMembers(data.members)
      toast.success("Notification preferences saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save notification preferences")
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/digest/test`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error("Failed to send test email")
      }
      toast.success("Test email sent", {
        description: "Check your inbox.",
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email")
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

  const selectedMemberIds =
    prefs.recipientMode === "all_members"
      ? members.map((member) => member.userId)
      : prefs.memberRecipientUserIds
  const selectedMemberCount = selectedMemberIds.length
  const totalRecipientCount = selectedMemberCount + prefs.externalRecipientEmails.length
  const selectedMemberSet = new Set(selectedMemberIds)
  const externalEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail.trim())
  const disableSave =
    saving ||
    (prefs.recipientMode === "custom" && totalRecipientCount === 0)
  const [sendHour = "08", sendMinute = "00"] = prefs.sendTimeLocal.split(":")
  const sendHourNumber = Number(sendHour)
  const sendPeriod = sendHourNumber >= 12 ? "PM" : "AM"
  const sendDisplayHour = String(sendHourNumber % 12 || 12).padStart(2, "0")
  const updateSendTime = (next: { hour?: string; minute?: string; period?: string }) => {
    const hour12 = Number(next.hour ?? sendDisplayHour)
    const minute = next.minute ?? sendMinute
    const period = next.period ?? sendPeriod
    const hour24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12
    setPrefs((prev) => ({
      ...prev,
      sendTimeLocal: `${String(hour24).padStart(2, "0")}:${minute}`,
    }))
  }

  const toggleMemberRecipient = (userId: string) => {
    setPrefs((prev) => {
      const selected = new Set(prev.memberRecipientUserIds)
      if (selected.has(userId)) selected.delete(userId)
      else selected.add(userId)
      return { ...prev, memberRecipientUserIds: [...selected] }
    })
  }

  const addExternalEmail = () => {
    const email = externalEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address")
      return
    }
    const memberEmails = new Set(members.map((member) => member.userEmail?.toLowerCase()).filter(Boolean))
    if (prefs.externalRecipientEmails.includes(email) || memberEmails.has(email)) {
      toast.error("That recipient is already included")
      return
    }
    setPrefs((prev) => ({
      ...prev,
      recipientMode: "custom",
      externalRecipientEmails: [...prev.externalRecipientEmails, email],
    }))
    setExternalEmail("")
  }

  const removeExternalEmail = (email: string) => {
    setPrefs((prev) => ({
      ...prev,
      externalRecipientEmails: prev.externalRecipientEmails.filter((item) => item !== email),
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
        description="Control the daily operating digest and automated payment reminders."
      />

      <SettingsCard
        title="Daily Stats Digest"
        description={`${totalRecipientCount} recipient${totalRecipientCount === 1 ? "" : "s"} · ${prefs.sendTimeLocal} ${prefs.timezone}`}
        action={
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, enabled: checked }))}
          />
        }
      >
        <div className="space-y-5 px-5 py-4">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Delivery Window</p>
                <p className="text-xs text-muted-foreground">
                  Sent daily at {prefs.sendTimeLocal} in {prefs.timezone}. The backend queues it during hour {prefs.sendHourUtc.toString().padStart(2, "0")}:00 UTC.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Select
                    value={sendDisplayHour}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ hour: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">:</span>
                  <Select
                    value={sendMinute}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ minute: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["00", "15", "30", "45"].map((minute) => (
                        <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sendPeriod}
                    disabled={!prefs.enabled}
                    onValueChange={(value) => updateSendTime({ period: value })}
                  >
                    <SelectTrigger className="h-10 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={!prefs.enabled}
                  onClick={() => setPrefs((prev) => ({ ...prev, timezone: browserTimezone }))}
                >
                  Use local zone
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Recipients</p>
              <p className="text-xs text-muted-foreground">
                Send to every workspace member by default, or choose a tighter list and add outside emails.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition-colors ${prefs.recipientMode === "all_members" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                disabled={!prefs.enabled}
                onClick={() => setPrefs((prev) => ({ ...prev, recipientMode: "all_members" }))}
              >
                <p className="text-sm font-semibold">All Members</p>
                <p className="mt-1 text-xs text-muted-foreground">{members.length} current workspace members</p>
              </button>
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition-colors ${prefs.recipientMode === "custom" ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                disabled={!prefs.enabled}
                onClick={() => setPrefs((prev) => ({
                  ...prev,
                  recipientMode: "custom",
                  memberRecipientUserIds: prev.memberRecipientUserIds.length > 0 ? prev.memberRecipientUserIds : members.map((member) => member.userId),
                }))}
              >
                <p className="text-sm font-semibold">Custom Recipients</p>
                <p className="mt-1 text-xs text-muted-foreground">{totalRecipientCount} selected recipients</p>
              </button>
            </div>

            {prefs.recipientMode === "custom" && (
              <div className="space-y-3 rounded-xl border p-3">
                <div className="divide-y rounded-lg border">
                  {members.map((member) => (
                    <label key={member._id} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.userName ?? member.userEmail ?? "Unnamed member"}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.userEmail ?? "Email unavailable for this member"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <RoleBadge label={toRoleLabel(member.role)} />
                        <Switch
                          size="sm"
                          checked={selectedMemberSet.has(member.userId)}
                          disabled={!prefs.enabled || !member.userEmail}
                          onCheckedChange={() => toggleMemberRecipient(member.userId)}
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>External recipients</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={externalEmail}
                      disabled={!prefs.enabled}
                      onChange={(event) => setExternalEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          addExternalEmail()
                        }
                      }}
                      placeholder="advisor@example.com"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExternalEmail}
                      disabled={!prefs.enabled || !externalEmailIsValid}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Outside recipients receive the digest email but do not get workspace access.
                  </p>
                  {prefs.externalRecipientEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {prefs.externalRecipientEmails.map((email) => (
                        <span key={email} className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
                          {email}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeExternalEmail(email)}
                            aria-label={`Remove ${email}`}
                          >
                            <Trash2Icon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Included Sections</p>
              <p className="text-xs text-muted-foreground">Choose which stats should appear in the daily email.</p>
            </div>
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
            <Button onClick={handleSave} disabled={disableSave}>
              {saving && <Spinner data-icon="inline-start" />}
              Save Preferences
            </Button>
            <Button variant="outline" onClick={handleSendTest} disabled={sendingTest}>
              {sendingTest && <Spinner data-icon="inline-start" />}
              Send Test Email
            </Button>
          </div>
        </div>
      </SettingsCard>

      <PaymentRemindersCard />
    </div>
  )
}

// ─── Payment Reminders ───────────────────────────────────────

interface PaymentReminderPrefs {
  enabled: boolean
  offsets: number[]
  sendTimeLocal: string
  timezone: string
  sendHourUtc: number
}

const REMINDER_OFFSET_OPTIONS = [
  { value: 0, label: "On due date" },
  { value: 3, label: "3 days after" },
  { value: 7, label: "7 days after" },
  { value: 14, label: "14 days after" },
  { value: 30, label: "30 days after" },
]

function reminderOffsetLabel(offset: number) {
  const preset = REMINDER_OFFSET_OPTIONS.find((option) => option.value === offset)
  return preset?.label ?? `${offset} days after`
}

function PaymentRemindersCard() {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  const [prefs, setPrefs] = useState<PaymentReminderPrefs>({
    enabled: false,
    offsets: [0, 7, 14],
    sendTimeLocal: "10:00",
    timezone: "UTC",
    sendHourUtc: 10,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/organization/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const reminders = data?.organization?.preferences?.paymentReminders
        if (reminders) {
          setPrefs({
            enabled: reminders.enabled ?? false,
            offsets: Array.isArray(reminders.offsets) ? reminders.offsets : [0, 7, 14],
            sendTimeLocal: reminders.sendTimeLocal ?? "10:00",
            timezone: reminders.timezone ?? "UTC",
            sendHourUtc: reminders.sendHourUtc ?? 10,
          })
        }
      })
      .catch(() => {
        toast.error("Failed to load payment reminder settings")
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (prefs.enabled && prefs.offsets.length === 0) {
      toast.error("Select at least one reminder schedule")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/organization/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { paymentReminders: prefs } }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Failed to save payment reminder settings")
      const saved = data?.organization?.preferences?.paymentReminders
      if (saved) {
        setPrefs((prev) => ({ ...prev, ...saved }))
      }
      toast.success("Payment reminder settings saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment reminder settings")
    } finally {
      setSaving(false)
    }
  }

  const toggleOffset = (value: number) => {
    setPrefs((prev) => ({
      ...prev,
      offsets: prev.offsets.includes(value)
        ? prev.offsets.filter((offset) => offset !== value)
        : [...prev.offsets, value].sort((a, b) => a - b),
    }))
  }

  const offsetOptions = [
    ...REMINDER_OFFSET_OPTIONS,
    ...prefs.offsets
      .filter((offset) => !REMINDER_OFFSET_OPTIONS.some((option) => option.value === offset))
      .map((offset) => ({ value: offset, label: reminderOffsetLabel(offset) })),
  ].sort((a, b) => a.value - b.value)

  const [sendHour = "10", sendMinute = "00"] = prefs.sendTimeLocal.split(":")
  const sendHourNumber = Number(sendHour)
  const sendPeriod = sendHourNumber >= 12 ? "PM" : "AM"
  const sendDisplayHour = String(sendHourNumber % 12 || 12).padStart(2, "0")
  const updateSendTime = (next: { hour?: string; minute?: string; period?: string }) => {
    const hour12 = Number(next.hour ?? sendDisplayHour)
    const minute = next.minute ?? sendMinute
    const period = next.period ?? sendPeriod
    const hour24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12
    setPrefs((prev) => ({
      ...prev,
      sendTimeLocal: `${String(hour24).padStart(2, "0")}:${minute}`,
    }))
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  }

  return (
    <SettingsCard
      title="Payment Reminders"
      description="Email customers automatically when an invoice is due or overdue. Applies to the whole organization."
      action={
        <Switch
          checked={prefs.enabled}
          onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, enabled: checked }))}
        />
      }
    >
      <div className="space-y-5 px-5 py-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Reminder Schedule</p>
            <p className="text-xs text-muted-foreground">
              Reminders are sent relative to each invoice's due date. Invoices keep getting reminders until they are paid, cancelled, or written off.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {offsetOptions.map((option) => {
              const selected = prefs.offsets.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={!prefs.enabled}
                  onClick={() => toggleOffset(option.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {prefs.enabled && prefs.offsets.length === 0 && (
            <p className="text-xs text-destructive">Select at least one reminder schedule.</p>
          )}
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Delivery Window</p>
              <p className="text-xs text-muted-foreground">
                Sent at {prefs.sendTimeLocal} in {prefs.timezone}. The backend queues reminders during hour {prefs.sendHourUtc.toString().padStart(2, "0")}:00 UTC.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Select
                  value={sendDisplayHour}
                  disabled={!prefs.enabled}
                  onValueChange={(value) => updateSendTime({ hour: value })}
                >
                  <SelectTrigger className="h-10 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((hour) => (
                      <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">:</span>
                <Select
                  value={sendMinute}
                  disabled={!prefs.enabled}
                  onValueChange={(value) => updateSendTime({ minute: value })}
                >
                  <SelectTrigger className="h-10 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["00", "15", "30", "45"].map((minute) => (
                      <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sendPeriod}
                  disabled={!prefs.enabled}
                  onValueChange={(value) => updateSendTime({ period: value })}
                >
                  <SelectTrigger className="h-10 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="h-10"
                disabled={!prefs.enabled}
                onClick={() => setPrefs((prev) => ({ ...prev, timezone: browserTimezone }))}
              >
                Use local zone
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Reminders are sent from your connected Gmail account with the invoice PDF attached, and only for sent invoices with a due date, a balance due, and a customer email. Reminders can be turned off per invoice from its detail page.
        </div>

        <div className="flex pt-1">
          <Button onClick={handleSave} disabled={saving || (prefs.enabled && prefs.offsets.length === 0)}>
            {saving && <Spinner data-icon="inline-start" />}
            Save Reminder Settings
          </Button>
        </div>
      </div>
    </SettingsCard>
  )
}

export default SettingsPage
