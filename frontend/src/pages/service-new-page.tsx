import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ClipboardPlusIcon,
  FactoryIcon,
  PlusIcon,
  UserRoundCogIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import {
  coreApiFetch,
  PRIORITY_LABELS,
  ServiceApiError,
  serviceFetch,
  useOrganizationRefresh,
  type CustomerOption,
  type DuplicateCandidate,
  type DuplicateResponse,
  type EmployeeOption,
  type EquipmentOption,
  type ServicePriority,
  type ServiceRequest,
  type ServiceSettingsResponse,
  type SiteOption,
} from "@/lib/service-management"

const NONE = "__none__"
const DEFAULT_COMPLAINTS = [
  "Breakdown",
  "Preventive maintenance",
  "Installation",
  "Inspection",
  "Parts",
  "Other",
]

const emptySite = {
  name: "",
  city: "",
  address: "",
  state: "",
  postalCode: "",
  country: "",
}

const emptyEquipment = {
  name: "",
  modelName: "",
  serialNumber: "",
  manufacturer: "",
}

type FormState = {
  customerId: string
  customerSiteId: string
  installedEquipmentId: string
  complaintType: string
  title: string
  description: string
  priority: ServicePriority
  coordinatorId: string
  engineerId: string
}

const emptyForm: FormState = {
  customerId: "",
  customerSiteId: NONE,
  installedEquipmentId: NONE,
  complaintType: "",
  title: "",
  description: "",
  priority: "medium",
  coordinatorId: NONE,
  engineerId: NONE,
}

export default function ServiceNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [sites, setSites] = useState<SiteOption[]>([])
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [settingsData, setSettingsData] =
    useState<ServiceSettingsResponse | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [siteOpen, setSiteOpen] = useState(false)
  const [siteDraft, setSiteDraft] = useState(emptySite)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [siteSaving, setSiteSaving] = useState(false)
  const [equipmentOpen, setEquipmentOpen] = useState(false)
  const [equipmentDraft, setEquipmentDraft] = useState(emptyEquipment)
  const [equipmentError, setEquipmentError] = useState<string | null>(null)
  const [equipmentSaving, setEquipmentSaving] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    Promise.all([
      coreApiFetch<{ customers?: CustomerOption[] }>(
        "/api/v1/customers?limit=100"
      ),
      coreApiFetch<{ employees?: EmployeeOption[] }>(
        "/api/v1/employees?limit=100"
      ),
      serviceFetch<ServiceSettingsResponse>("/settings"),
    ])
      .then(([customerData, employeeData, settingsData]) => {
        setCustomers(customerData.customers ?? [])
        setEmployees(employeeData.employees ?? [])
        setSettingsData(settingsData)
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Unable to load form options"
        )
      )
      .finally(() => setLoadingOptions(false))
  }, [revision])

  useEffect(() => {
    if (!form.customerId) {
      return
    }
    const query = `customerId=${encodeURIComponent(form.customerId)}`
    Promise.all([
      serviceFetch<{ items: SiteOption[] }>(`/sites?${query}`),
      serviceFetch<{ items: EquipmentOption[] }>(`/equipment?${query}`),
    ])
      .then(([siteData, equipmentData]) => {
        setSites(siteData.items ?? [])
        setEquipment(equipmentData.items ?? [])
      })
      .catch(() => {
        setSites([])
        setEquipment([])
      })
  }, [form.customerId, revision])

  const resetForOrganization = useCallback(() => {
    setForm(emptyForm)
    setCustomers([])
    setEmployees([])
    setSites([])
    setEquipment([])
    setSettingsData(null)
    setLoadingOptions(true)
    setDuplicates([])
    setDuplicateOpen(false)
    setSiteOpen(false)
    setSiteDraft(emptySite)
    setSiteError(null)
    setEquipmentOpen(false)
    setEquipmentDraft(emptyEquipment)
    setEquipmentError(null)
    setRevision((value) => value + 1)
  }, [])
  useOrganizationRefresh(resetForOrganization)

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function createSite() {
    if (!form.customerId) return
    if (!siteDraft.name.trim() || !siteDraft.city.trim()) {
      setSiteError("Name and city are required.")
      return
    }
    setSiteSaving(true)
    setSiteError(null)
    try {
      const { item } = await serviceFetch<{ item: SiteOption }>("/sites", {
        method: "POST",
        body: JSON.stringify({
          customerId: form.customerId,
          name: siteDraft.name.trim(),
          city: siteDraft.city.trim(),
          address: siteDraft.address.trim(),
          state: siteDraft.state.trim(),
          postalCode: siteDraft.postalCode.trim(),
          country: siteDraft.country.trim(),
        }),
      })
      setSites((current) => [
        ...current.filter((site) => site._id !== item._id),
        item,
      ])
      setForm((current) => ({
        ...current,
        customerSiteId: item._id,
        installedEquipmentId: NONE,
      }))
      setSiteDraft(emptySite)
      setSiteOpen(false)
      toast.success("Customer site created and selected")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create customer site"
      setSiteError(message)
      toast.error(message)
    } finally {
      setSiteSaving(false)
    }
  }

  async function createEquipment() {
    if (!form.customerId) return
    if (!equipmentDraft.name.trim()) {
      setEquipmentError("Name is required.")
      return
    }
    setEquipmentSaving(true)
    setEquipmentError(null)
    try {
      const { item } = await serviceFetch<{ item: EquipmentOption }>(
        "/equipment",
        {
          method: "POST",
          body: JSON.stringify({
            customerId: form.customerId,
            customerSiteId:
              form.customerSiteId === NONE ? null : form.customerSiteId,
            name: equipmentDraft.name.trim(),
            modelName: equipmentDraft.modelName.trim(),
            serialNumber: equipmentDraft.serialNumber.trim(),
            manufacturer: equipmentDraft.manufacturer.trim(),
          }),
        }
      )
      setEquipment((current) => [
        ...current.filter((equipment) => equipment._id !== item._id),
        item,
      ])
      patch("installedEquipmentId", item._id)
      setEquipmentDraft(emptyEquipment)
      setEquipmentOpen(false)
      toast.success("Equipment created and selected")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create equipment"
      setEquipmentError(message)
      toast.error(message)
    } finally {
      setEquipmentSaving(false)
    }
  }

  async function submit(allowDuplicate = false) {
    setSaving(true)
    const payload = {
      customerId: form.customerId,
      customerSiteId: form.customerSiteId === NONE ? null : form.customerSiteId,
      installedEquipmentId:
        form.installedEquipmentId === NONE ? null : form.installedEquipmentId,
      complaintType: form.complaintType,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      coordinatorId: form.coordinatorId === NONE ? null : form.coordinatorId,
      engineerId: form.engineerId === NONE ? null : form.engineerId,
      allowDuplicate,
    }
    try {
      const data = await serviceFetch<
        | {
            item?: ServiceRequest
            request?: ServiceRequest
            duplicateCandidates?: DuplicateCandidate[]
          }
        | ServiceRequest
      >("/requests", { method: "POST", body: JSON.stringify(payload) })
      if (
        "duplicateCandidates" in data &&
        data.duplicateCandidates?.length &&
        !allowDuplicate
      ) {
        setDuplicates(data.duplicateCandidates)
        setDuplicateOpen(true)
        return
      }
      const request =
        "item" in data ? data.item : "request" in data ? data.request : data
      if (!request?._id)
        throw new Error("The service request was created without an identifier")
      toast.success("Service request created")
      void navigate({
        to: "/service/$requestId",
        params: { requestId: request._id },
      })
    } catch (err) {
      if (
        err instanceof ServiceApiError &&
        err.status === 409 &&
        !allowDuplicate
      ) {
        const payload = err.payload as Partial<DuplicateResponse> | null
        setDuplicates(payload?.duplicateCandidates ?? [])
        setDuplicateOpen(true)
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to create service request"
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const complaints = settingsData?.settings.complaintTypes?.length
    ? settingsData.settings.complaintTypes
    : DEFAULT_COMPLAINTS
  const canSubmit = Boolean(
    form.customerId && form.complaintType && form.title.trim()
  )

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[
          { label: "Service", href: "/service" },
          { label: "New SR" },
        ]}
      />
      <main className="flex-1 overflow-auto">
        <form
          className="mx-auto max-w-5xl space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/service">
              <ArrowLeftIcon />
              Back to requests
            </Link>
          </Button>
          <PageHeader
            title="Log service request"
            description="Capture the complaint, site context, and initial ownership."
            actions={
              <Button
                type="submit"
                disabled={!canSubmit || saving || loadingOptions}
              >
                {saving && <Spinner />}Create SR
              </Button>
            }
          />

          <FormSection
            icon={FactoryIcon}
            title="Customer & equipment"
            description="Identify where the service event occurred."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Customer" required>
                <Select
                  value={form.customerId}
                  onValueChange={(value) => {
                    setSites([])
                    setEquipment([])
                    setForm((current) => ({
                      ...current,
                      customerId: value,
                      customerSiteId: NONE,
                      installedEquipmentId: NONE,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name || item.company || "Unnamed customer"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Site / city"
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={!form.customerId}
                    onClick={() => {
                      setSiteError(null)
                      setSiteOpen(true)
                    }}
                  >
                    <PlusIcon />
                    Add site
                  </Button>
                }
              >
                <Select
                  value={form.customerSiteId}
                  onValueChange={(value) => patch("customerSiteId", value)}
                  disabled={!form.customerId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not specified</SelectItem>
                    {sites.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name}
                        {item.city ? ` · ${item.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Equipment"
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={!form.customerId}
                    onClick={() => {
                      setEquipmentError(null)
                      setEquipmentOpen(true)
                    }}
                  >
                    <PlusIcon />
                    Add equipment
                  </Button>
                }
              >
                <Select
                  value={form.installedEquipmentId}
                  onValueChange={(value) =>
                    patch("installedEquipmentId", value)
                  }
                  disabled={!form.customerId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No equipment</SelectItem>
                    {equipment.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name}
                        {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={ClipboardPlusIcon}
            title="Complaint"
            description="Use a concise subject; put diagnostic context in the description."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Complaint type" required>
                <Select
                  value={form.complaintType}
                  onValueChange={(value) => patch("complaintType", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {complaints.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority" required>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    patch("priority", value as ServicePriority)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subject" required className="md:col-span-3">
                <Input
                  value={form.title}
                  onChange={(event) => patch("title", event.target.value)}
                  placeholder="Machine stops after warm-up"
                />
              </Field>
              <Field label="Description" className="md:col-span-3">
                <textarea
                  value={form.description}
                  onChange={(event) => patch("description", event.target.value)}
                  rows={5}
                  placeholder="Symptoms, operating conditions, error codes, and actions already taken..."
                  className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            icon={UserRoundCogIcon}
            title="Initial ownership"
            description="Assignment can be changed later from the request workspace."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <EmployeeField
                label="Coordinator"
                value={form.coordinatorId}
                employees={employees}
                onChange={(value) => patch("coordinatorId", value)}
              />
              <EmployeeField
                label="Engineer"
                value={form.engineerId}
                employees={employees}
                onChange={(value) => patch("engineerId", value)}
              />
            </div>
          </FormSection>
        </form>
      </main>

      <Dialog
        open={siteOpen}
        onOpenChange={(open) => {
          if (!siteSaving) setSiteOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add customer site</DialogTitle>
            <DialogDescription>
              Create a service location for the selected customer. City is
              required so operational reports remain useful.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DraftInput
                label="Site name"
                required
                value={siteDraft.name}
                onChange={(name) =>
                  setSiteDraft((current) => ({ ...current, name }))
                }
              />
              <DraftInput
                label="City"
                required
                value={siteDraft.city}
                onChange={(city) =>
                  setSiteDraft((current) => ({ ...current, city }))
                }
              />
            </div>
            <DraftInput
              label="Address"
              value={siteDraft.address}
              onChange={(address) =>
                setSiteDraft((current) => ({ ...current, address }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <DraftInput
                label="State"
                value={siteDraft.state}
                onChange={(state) =>
                  setSiteDraft((current) => ({ ...current, state }))
                }
              />
              <DraftInput
                label="Postal code"
                value={siteDraft.postalCode}
                onChange={(postalCode) =>
                  setSiteDraft((current) => ({ ...current, postalCode }))
                }
              />
              <DraftInput
                label="Country"
                value={siteDraft.country}
                onChange={(country) =>
                  setSiteDraft((current) => ({ ...current, country }))
                }
              />
            </div>
            {siteError && (
              <p className="text-sm text-destructive">{siteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={siteSaving}
              onClick={() => setSiteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                siteSaving || !siteDraft.name.trim() || !siteDraft.city.trim()
              }
              onClick={() => void createSite()}
            >
              {siteSaving && <Spinner />}
              Create site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={equipmentOpen}
        onOpenChange={(open) => {
          if (!equipmentSaving) setEquipmentOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add installed equipment</DialogTitle>
            <DialogDescription>
              Create equipment for the selected customer
              {form.customerSiteId !== NONE
                ? " at the currently selected site."
                : ". Select a site first if this equipment belongs to one."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <DraftInput
              label="Equipment name"
              required
              value={equipmentDraft.name}
              onChange={(name) =>
                setEquipmentDraft((current) => ({ ...current, name }))
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <DraftInput
                label="Model"
                value={equipmentDraft.modelName}
                onChange={(modelName) =>
                  setEquipmentDraft((current) => ({ ...current, modelName }))
                }
              />
              <DraftInput
                label="Serial number"
                value={equipmentDraft.serialNumber}
                onChange={(serialNumber) =>
                  setEquipmentDraft((current) => ({
                    ...current,
                    serialNumber,
                  }))
                }
              />
            </div>
            <DraftInput
              label="Manufacturer"
              value={equipmentDraft.manufacturer}
              onChange={(manufacturer) =>
                setEquipmentDraft((current) => ({
                  ...current,
                  manufacturer,
                }))
              }
            />
            {equipmentError && (
              <p className="text-sm text-destructive">{equipmentError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={equipmentSaving}
              onClick={() => setEquipmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={equipmentSaving || !equipmentDraft.name.trim()}
              onClick={() => void createEquipment()}
            >
              {equipmentSaving && <Spinner />}
              Create equipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="text-warning" />
              Possible duplicate request
            </DialogTitle>
            <DialogDescription>
              Review these recent requests before creating another. Continue
              only if this is a distinct service event.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 divide-y overflow-auto rounded-lg border">
            {duplicates.length ? (
              duplicates.map((item) => (
                <div key={item._id} className="p-3 text-sm">
                  <p className="font-medium">
                    {item.reference ?? item._id} · {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.systemCategory} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                The server detected a matching request.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
              Review form
            </Button>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={() => void submit(true)}
            >
              Create anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FactoryIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b bg-muted/20 px-5 py-3">
        <Icon className="size-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  className,
  action,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {action}
      </div>
      {children}
    </div>
  )
}

function DraftInput({
  label,
  required,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} required={required}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  )
}

function EmployeeField({
  label,
  value,
  employees,
  onChange,
}: {
  label: string
  value: string
  employees: EmployeeOption[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Unassigned</SelectItem>
          {employees.map((item) => (
            <SelectItem key={item._id} value={item._id}>
              {item.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
