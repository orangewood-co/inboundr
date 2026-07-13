import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useBlocker, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  ContactIcon,
  MapPinIcon,
  SlidersHorizontalIcon,
  StickyNoteIcon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { CustomerFieldInput } from "@/components/customer-field-input"
import { InternationalPhoneInput } from "@/components/international-phone-input"
import { ErrorState } from "@/components/list-states"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  activeCustomerFields,
  fetchCustomerSettings,
  type CustomerFieldDefinition,
  type CustomerFieldValue,
} from "@/lib/customer-fields"
import {
  createEmptyCustomerForm,
  customerFormToPayload,
  validateCustomerPayload,
  type CustomerFormState,
  type CustomerPayload,
} from "@/lib/customer-form"
import { API_ORIGIN } from "@/lib/env"

const API_BASE = `${API_ORIGIN}/api/v1/customers`

interface CreatedCustomer {
  _id: string
  name: string
  company: string
  email: string
}

interface CustomersResponse {
  customers: CreatedCustomer[]
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRoundIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4.5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((section) => (
        <div key={section} className="rounded-xl border p-5">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CustomerNewPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<CustomerFormState>(createEmptyCustomerForm)
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomerFieldDefinition[]>([])
  const [loadingFields, setLoadingFields] = useState(true)
  const [fieldsError, setFieldsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicateCustomer, setDuplicateCustomer] = useState<CreatedCustomer | null>(null)
  const navigationAllowedRef = useRef(false)

  async function loadFields() {
    setLoadingFields(true)
    setFieldsError(null)
    try {
      setFieldDefinitions(await fetchCustomerSettings())
    } catch (error) {
      setFieldsError(error instanceof Error ? error.message : "Unable to load customer fields")
    } finally {
      setLoadingFields(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchCustomerSettings()
      .then((fields) => {
        if (!cancelled) setFieldDefinitions(fields)
      })
      .catch((error) => {
        if (!cancelled) {
          setFieldsError(
            error instanceof Error ? error.message : "Unable to load customer fields",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(createEmptyCustomerForm()),
    [form],
  )
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = isDirty
  }, [isDirty])

  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !navigationAllowedRef.current,
    withResolver: true,
    enableBeforeUnload: () => dirtyRef.current && !navigationAllowedRef.current,
  })

  const customFields = useMemo(
    () => activeCustomerFields(fieldDefinitions),
    [fieldDefinitions],
  )

  function updateForm(
    field: Exclude<keyof CustomerFormState, "fieldValues">,
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaveError(null)
  }

  function updateField(fieldId: string, value: CustomerFieldValue) {
    setForm((current) => ({
      ...current,
      fieldValues: { ...current.fieldValues, [fieldId]: value },
    }))
    setSaveError(null)
  }

  async function findDuplicate(email: string): Promise<CreatedCustomer | null> {
    const params = new URLSearchParams({ email, limit: "1" })
    const response = await fetch(`${API_BASE}?${params}`, {
      credentials: "include",
    })
    const data = (await response.json().catch(() => null)) as CustomersResponse | null
    if (!response.ok) {
      throw new Error("Unable to check for an existing customer")
    }
    return data?.customers?.[0] ?? null
  }

  async function persistCustomer(payload: CustomerPayload) {
    const response = await fetch(API_BASE, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => null)) as
      | (CreatedCustomer & { error?: string })
      | null
    if (!response.ok || !data?._id) {
      throw new Error(data?.error ?? "Unable to create customer")
    }

    navigationAllowedRef.current = true
    toast.success("Customer created successfully")
    await navigate({ to: "/customers/$id", params: { id: data._id } })
  }

  async function createCustomer({ skipDuplicateCheck = false } = {}) {
    const payload = customerFormToPayload(form, fieldDefinitions)
    const validationError = validateCustomerPayload(payload)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (!skipDuplicateCheck) {
        const duplicate = await findDuplicate(payload.email)
        if (duplicate) {
          setDuplicateCustomer(duplicate)
          return
        }
      }
      setDuplicateCustomer(null)
      await persistCustomer(payload)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to create customer")
    } finally {
      setSaving(false)
    }
  }

  function openExistingCustomer() {
    if (!duplicateCustomer) return
    navigationAllowedRef.current = true
    void navigate({
      to: "/customers/$id",
      params: { id: duplicateCustomer._id },
    })
  }

  return (
    <AppLayout>
      <SiteHeader
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "New" }]}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
              <Link to="/customers">
                <ArrowLeftIcon className="size-4" />
                Back to Customers
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">New Customer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a customer to your organization&apos;s shared directory.
            </p>
          </div>

          {loadingFields ? (
            <FormSkeleton />
          ) : fieldsError ? (
            <div className="rounded-xl border">
              <ErrorState message={fieldsError} onRetry={() => void loadFields()} />
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void createCustomer()
              }}
            >
              <FieldGroup>
                <FormSection
                  icon={UserRoundIcon}
                  title="Customer identity"
                  description="The person and company this record represents."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="customer-name">Name</FieldLabel>
                      <Input
                        id="customer-name"
                        value={form.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="Customer name"
                        autoComplete="name"
                        autoFocus
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="customer-company">Company</FieldLabel>
                      <Input
                        id="customer-company"
                        value={form.company}
                        onChange={(event) => updateForm("company", event.target.value)}
                        placeholder="Company name"
                        autoComplete="organization"
                        required
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  icon={ContactIcon}
                  title="Contact information"
                  description="How your team can reach this customer."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="customer-email">Email</FieldLabel>
                      <Input
                        id="customer-email"
                        type="email"
                        value={form.email}
                        onChange={(event) => updateForm("email", event.target.value)}
                        placeholder="name@company.com"
                        autoComplete="email"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="customer-phone">Contact number</FieldLabel>
                      <InternationalPhoneInput
                        id="customer-phone"
                        value={form.contactNumber}
                        onChange={(value) => updateForm("contactNumber", value)}
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection
                  icon={MapPinIcon}
                  title="Address"
                  description="The customer&apos;s billing or primary office address."
                >
                  <Field>
                    <FieldLabel htmlFor="customer-address">Address</FieldLabel>
                    <textarea
                      id="customer-address"
                      rows={4}
                      value={form.address}
                      onChange={(event) => updateForm("address", event.target.value)}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="Street, city, state, postal code"
                      autoComplete="street-address"
                    />
                  </Field>
                </FormSection>

                {customFields.length > 0 && (
                  <FormSection
                    icon={SlidersHorizontalIcon}
                    title="Organization fields"
                    description="Additional customer details configured for your organization."
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      {customFields.map((field) => (
                        <CustomerFieldInput
                          key={field.id}
                          field={field}
                          value={form.fieldValues[field.id]}
                          onChange={(value) => updateField(field.id, value)}
                        />
                      ))}
                    </div>
                  </FormSection>
                )}

                <FormSection
                  icon={StickyNoteIcon}
                  title="Internal notes"
                  description="Context visible to teammates who can access customers."
                >
                  <Field>
                    <FieldLabel htmlFor="customer-notes">Notes</FieldLabel>
                    <textarea
                      id="customer-notes"
                      rows={5}
                      value={form.notes}
                      onChange={(event) => updateForm("notes", event.target.value)}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      placeholder="Pricing preferences, follow-up context, or internal notes"
                    />
                  </Field>
                </FormSection>

                {saveError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {saveError}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                  <Button asChild variant="outline" disabled={saving}>
                    <Link to="/customers">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Spinner data-icon="inline-start" />}
                    Create Customer
                  </Button>
                </div>
              </FieldGroup>
            </form>
          )}
        </div>
      </main>

      <Dialog
        open={Boolean(duplicateCustomer)}
        onOpenChange={(open) => {
          if (!open && !saving) setDuplicateCustomer(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer With This Email Already Exists</DialogTitle>
            <DialogDescription>
              Review the existing active customer before creating a duplicate record.
            </DialogDescription>
          </DialogHeader>
          {duplicateCustomer && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">{duplicateCustomer.name}</p>
              <p className="mt-1 text-muted-foreground">{duplicateCustomer.company}</p>
              <p className="mt-2 font-medium text-foreground">{duplicateCustomer.email}</p>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setDuplicateCustomer(null)}
              disabled={saving}
            >
              Keep Editing
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={openExistingCustomer} disabled={saving}>
                Open Existing
              </Button>
              <Button onClick={() => void createCustomer({ skipDuplicateCheck: true })} disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Create Anyway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Unsaved Changes?</DialogTitle>
            <DialogDescription>
              You have entered customer information that has not been saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
