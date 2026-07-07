import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  Edit3Icon,
  MapPinIcon,
  PlusIcon,
  TagsIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
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
  assetsFetch,
  DEPRECIATION_METHOD_LABELS,
  type AssetCategory,
  type AssetDepreciationMethod,
  type AssetLocation,
} from "@/lib/assets"

type CategoryFormState = {
  name: string
  description: string
  depreciationMethod: AssetDepreciationMethod
  usefulLifeMonths: string
  salvagePercentage: string
  wdvRatePercentage: string
}

const emptyCategoryForm: CategoryFormState = {
  name: "",
  description: "",
  depreciationMethod: "straight_line",
  usefulLifeMonths: "60",
  salvagePercentage: "0",
  wdvRatePercentage: "0",
}

type LocationFormState = {
  name: string
  address: string
  notes: string
}

const emptyLocationForm: LocationFormState = { name: "", address: "", notes: "" }

export default function AssetsSettingsPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [locations, setLocations] = useState<AssetLocation[]>([])
  const [codePrefix, setCodePrefix] = useState("AST")
  const [nextSequence, setNextSequence] = useState(1)
  const [loading, setLoading] = useState(true)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm)

  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<AssetLocation | null>(null)
  const [locationForm, setLocationForm] = useState<LocationFormState>(emptyLocationForm)

  const [saving, setSaving] = useState(false)
  const [savingPrefix, setSavingPrefix] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [categoriesData, locationsData, settingsData] = await Promise.all([
        assetsFetch<{ categories: AssetCategory[] }>("/categories"),
        assetsFetch<{ locations: AssetLocation[] }>("/locations"),
        assetsFetch<{ codePrefix: string; nextSequence: number }>("/settings"),
      ])
      setCategories(categoriesData.categories)
      setLocations(locationsData.locations)
      setCodePrefix(settingsData.codePrefix)
      setNextSequence(settingsData.nextSequence)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load asset setup")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  function openCategoryDialog(category: AssetCategory | null) {
    setEditingCategory(category)
    setCategoryForm(
      category
        ? {
            name: category.name,
            description: category.description,
            depreciationMethod: category.depreciationMethod,
            usefulLifeMonths: String(category.usefulLifeMonths),
            salvagePercentage: String(category.salvagePercentage),
            wdvRatePercentage: String(category.wdvRatePercentage),
          }
        : emptyCategoryForm
    )
    setCategoryDialogOpen(true)
  }

  async function saveCategory() {
    setSaving(true)
    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        depreciationMethod: categoryForm.depreciationMethod,
        usefulLifeMonths: Number(categoryForm.usefulLifeMonths) || 60,
        salvagePercentage: Number(categoryForm.salvagePercentage) || 0,
        wdvRatePercentage: Number(categoryForm.wdvRatePercentage) || 0,
      }
      await assetsFetch(editingCategory ? `/categories/${editingCategory._id}` : "/categories", {
        method: editingCategory ? "PUT" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(editingCategory ? "Category updated" : "Category created")
      setCategoryDialogOpen(false)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category")
    } finally {
      setSaving(false)
    }
  }

  async function archiveCategory(category: AssetCategory) {
    try {
      await assetsFetch(`/categories/${category._id}/archive`, { method: "PATCH", body: "{}" })
      toast.success("Category archived")
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive category")
    }
  }

  function openLocationDialog(location: AssetLocation | null) {
    setEditingLocation(location)
    setLocationForm(
      location
        ? { name: location.name, address: location.address, notes: location.notes }
        : emptyLocationForm
    )
    setLocationDialogOpen(true)
  }

  async function saveLocation() {
    setSaving(true)
    try {
      await assetsFetch(editingLocation ? `/locations/${editingLocation._id}` : "/locations", {
        method: editingLocation ? "PUT" : "POST",
        body: JSON.stringify(locationForm),
      })
      toast.success(editingLocation ? "Location updated" : "Location created")
      setLocationDialogOpen(false)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location")
    } finally {
      setSaving(false)
    }
  }

  async function archiveLocation(location: AssetLocation) {
    try {
      await assetsFetch(`/locations/${location._id}/archive`, { method: "PATCH", body: "{}" })
      toast.success("Location archived")
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive location")
    }
  }

  async function savePrefix() {
    setSavingPrefix(true)
    try {
      const data = await assetsFetch<{ codePrefix: string; nextSequence: number }>("/settings", {
        method: "PUT",
        body: JSON.stringify({ codePrefix }),
      })
      setCodePrefix(data.codePrefix)
      setNextSequence(data.nextSequence)
      toast.success("Asset code prefix updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update prefix")
    } finally {
      setSavingPrefix(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Assets", href: "/assets" }, { label: "Setup" }]} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-8 p-6">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/assets">
                <ArrowLeftIcon className="size-4" />
                Back to Assets
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Asset Setup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage categories with depreciation defaults, locations, and asset code numbering.
            </p>
          </div>

          <section className="rounded-xl border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <TagsIcon className="size-4 text-muted-foreground" />
                Categories
              </span>
              <Button variant="outline" size="sm" onClick={() => openCategoryDialog(null)}>
                <PlusIcon className="size-4" />
                New Category
              </Button>
            </div>
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading...</p>
            ) : categories.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No categories yet. Categories carry depreciation defaults that assets inherit.
              </p>
            ) : (
              <div className="divide-y">
                {categories.map((category) => (
                  <div key={category._id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {DEPRECIATION_METHOD_LABELS[category.depreciationMethod]} · {category.usefulLifeMonths} months
                        {category.depreciationMethod === "straight_line"
                          ? ` · ${category.salvagePercentage}% salvage`
                          : ` · ${category.wdvRatePercentage}% per year`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => openCategoryDialog(category)}
                      >
                        <Edit3Icon className="size-4" />
                        <span className="sr-only">Edit category</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => void archiveCategory(category)}
                      >
                        <ArchiveIcon className="size-4" />
                        <span className="sr-only">Archive category</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <MapPinIcon className="size-4 text-muted-foreground" />
                Locations
              </span>
              <Button variant="outline" size="sm" onClick={() => openLocationDialog(null)}>
                <PlusIcon className="size-4" />
                New Location
              </Button>
            </div>
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading...</p>
            ) : locations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No locations yet. Add offices, plants, or sites where assets live.
              </p>
            ) : (
              <div className="divide-y">
                {locations.map((location) => (
                  <div key={location._id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{location.name}</p>
                      {location.address && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{location.address}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => openLocationDialog(location)}
                      >
                        <Edit3Icon className="size-4" />
                        <span className="sr-only">Edit location</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={() => void archiveLocation(location)}
                      >
                        <ArchiveIcon className="size-4" />
                        <span className="sr-only">Archive location</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border">
            <div className="border-b bg-muted/30 px-4 py-2.5 text-sm font-semibold">Asset Codes</div>
            <div className="flex flex-wrap items-end gap-4 p-4">
              <div className="grid gap-2">
                <Label htmlFor="code-prefix">Code prefix</Label>
                <Input
                  id="code-prefix"
                  value={codePrefix}
                  maxLength={8}
                  className="w-32 font-mono uppercase"
                  onChange={(event) => setCodePrefix(event.target.value.toUpperCase())}
                />
              </div>
              <div className="grid gap-2">
                <Label>Next code</Label>
                <Badge variant="outline" className="h-9 px-3 font-mono text-sm">
                  {codePrefix || "AST"}-{String(nextSequence).padStart(4, "0")}
                </Badge>
              </div>
              <Button onClick={() => void savePrefix()} disabled={savingPrefix || !codePrefix.trim()}>
                {savingPrefix && <Spinner data-icon="inline-start" />}
                Save Prefix
              </Button>
            </div>
            <p className="px-4 pb-4 text-xs text-muted-foreground">
              New assets get sequential codes with this prefix. Existing asset codes are not changed.
            </p>
          </section>
        </div>
      </main>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              Assets in this category inherit these depreciation defaults; each asset can override them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Computers, Furniture, Machinery..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Depreciation method</Label>
                <Select
                  value={categoryForm.depreciationMethod}
                  onValueChange={(value) =>
                    setCategoryForm((current) => ({
                      ...current,
                      depreciationMethod: value as AssetDepreciationMethod,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">{DEPRECIATION_METHOD_LABELS.straight_line}</SelectItem>
                    <SelectItem value="written_down_value">{DEPRECIATION_METHOD_LABELS.written_down_value}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-life">Useful life (months)</Label>
                <Input
                  id="category-life"
                  type="number"
                  min={1}
                  value={categoryForm.usefulLifeMonths}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, usefulLifeMonths: event.target.value }))
                  }
                />
              </div>
              {categoryForm.depreciationMethod === "straight_line" ? (
                <div className="grid gap-2">
                  <Label htmlFor="category-salvage">Salvage (% of cost)</Label>
                  <Input
                    id="category-salvage"
                    type="number"
                    min={0}
                    max={95}
                    value={categoryForm.salvagePercentage}
                    onChange={(event) =>
                      setCategoryForm((current) => ({ ...current, salvagePercentage: event.target.value }))
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="category-wdv">WDV rate (% per year)</Label>
                    <Input
                      id="category-wdv"
                      type="number"
                      min={0}
                      max={100}
                      value={categoryForm.wdvRatePercentage}
                      onChange={(event) =>
                        setCategoryForm((current) => ({ ...current, wdvRatePercentage: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category-salvage-floor">Salvage floor (% of cost)</Label>
                    <Input
                      id="category-salvage-floor"
                      type="number"
                      min={0}
                      max={95}
                      value={categoryForm.salvagePercentage}
                      onChange={(event) =>
                        setCategoryForm((current) => ({ ...current, salvagePercentage: event.target.value }))
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveCategory()} disabled={saving || !categoryForm.name.trim()}>
              {saving && <Spinner data-icon="inline-start" />}
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "New Location"}</DialogTitle>
            <DialogDescription>A site, office, plant, or storage place where assets live.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="location-name">Name</Label>
              <Input
                id="location-name"
                value={locationForm.name}
                onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Head office, Pune plant..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-address">Address</Label>
              <Input
                id="location-address"
                value={locationForm.address}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, address: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location-notes">Notes</Label>
              <Input
                id="location-notes"
                value={locationForm.notes}
                onChange={(event) => setLocationForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveLocation()} disabled={saving || !locationForm.name.trim()}>
              {saving && <Spinner data-icon="inline-start" />}
              {editingLocation ? "Save Changes" : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
