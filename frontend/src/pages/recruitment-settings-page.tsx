import { useEffect, useState } from "react"
import { CopyIcon, ExternalLinkIcon, PlusIcon, Trash2Icon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"

import { ErrorState, ListSkeleton } from "@/components/list-states"
import { RecruitmentPageTitle, RecruitmentShell } from "@/components/recruitment/recruitment-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useEntitlements } from "@/lib/entitlements"
import { careersUrl, recruitmentApi, type RecruitmentSettings } from "@/lib/recruitment"

export function RecruitmentSettingsPage() {
  const { canManageOrganization } = useEntitlements()
  const [settings, setSettings] = useState<RecruitmentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    recruitmentApi.settings()
      .then(({ settings: value }) => setSettings(value))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load careers settings"))
      .finally(() => setLoading(false))
  }, [])

  function patch(update: Partial<RecruitmentSettings>) {
    setSettings((current) => current ? { ...current, ...update } : current)
  }

  async function save() {
    if (!settings || !canManageOrganization) return
    setSaving(true)
    try {
      const { settings: saved } = await recruitmentApi.updateSettings({ ...settings, banner: undefined, bannerUrl: undefined })
      setSettings(saved)
      toast.success("Careers site settings saved")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to save settings")
    } finally {
      setSaving(false)
    }
  }

  async function uploadBanner(file: File) {
    if (!canManageOrganization) return
    setUploadingBanner(true)
    try {
      const { settings: saved } = await recruitmentApi.uploadBanner(file)
      setSettings((current) => current ? { ...current, banner: saved.banner, bannerUrl: saved.bannerUrl } : saved)
      toast.success("Careers banner updated")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to upload banner")
    } finally {
      setUploadingBanner(false)
    }
  }

  async function removeBanner() {
    if (!canManageOrganization) return
    setUploadingBanner(true)
    try {
      await recruitmentApi.updateSettings({ bannerUrl: null })
      setSettings((current) => current ? { ...current, banner: null, bannerUrl: null } : current)
      toast.success("Careers banner removed")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to remove banner")
    } finally {
      setUploadingBanner(false)
    }
  }

  if (loading) return <RecruitmentShell><ListSkeleton rows={8} columns={2} /></RecruitmentShell>
  if (error || !settings) return <RecruitmentShell><ErrorState message={error || "Settings unavailable"} /></RecruitmentShell>

  const publicUrl = settings.organizationPath ? careersUrl(settings.organizationPath) : ""
  return (
    <RecruitmentShell breadcrumbs={[{ label: "Recruitment", href: "/recruitment" }, { label: "Careers Site" }]}>
      <div className="mx-auto max-w-5xl">
        <RecruitmentPageTitle
          eyebrow="Recruitment"
          title="Careers Site"
          description="Configure your public careers page."
          action={publicUrl ? <div className="flex gap-2"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success("Link copied"))}><CopyIcon /> Copy Link</Button><Button variant="outline" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Preview</a></Button></div> : undefined}
        />
        {!canManageOrganization && <p className="mb-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">Read-only: organization admin access is required to change careers-site settings.</p>}
        <fieldset disabled={!canManageOrganization} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Publishing</h2>
              <p className="mb-5 text-sm text-muted-foreground">Your careers URL is generated automatically from the organization name.</p>
              <div className="space-y-4">
                {publicUrl && <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3"><span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{publicUrl}</span><Button type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.success("Link copied"))}><CopyIcon /> Copy</Button></div>}
                <label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-medium">Publish careers site</span><span className="text-xs text-muted-foreground">Candidates can browse open roles at the public URL.</span></span><Switch checked={settings.publicCareersEnabled} onCheckedChange={(checked) => patch({ publicCareersEnabled: checked })} /></label>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Story & Visual Identity</h2>
              <p className="mb-5 text-sm text-muted-foreground">Use a wide JPG, PNG, WebP, or SVG image up to 2MB.</p>
              <div className="grid gap-4">
                <div><Label>Headline</Label><Input className="mt-2" value={settings.headline} onChange={(event) => patch({ headline: event.target.value })} placeholder="Build the future with us" /></div>
                <div><Label>Introduction</Label><textarea className="mt-2 min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={settings.intro} onChange={(event) => patch({ intro: event.target.value })} placeholder="Tell candidates what makes this a meaningful place to work." /></div>
                <div><Label>Careers banner</Label>{settings.bannerUrl ? <div className="mt-2 overflow-hidden rounded-xl border"><img src={settings.bannerUrl} alt="Current careers banner" className="aspect-[16/6] w-full object-cover" /><div className="flex items-center justify-between gap-3 p-3"><p className="min-w-0 truncate text-xs text-muted-foreground">{settings.banner?.originalName ?? "Uploaded banner"}</p><div className="flex gap-2"><Button size="sm" variant="outline" asChild><label className="cursor-pointer"><UploadCloudIcon /> Replace<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" disabled={uploadingBanner} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBanner(file); event.target.value = "" }} /></label></Button><Button size="sm" variant="ghost" disabled={uploadingBanner} onClick={() => void removeBanner()}><Trash2Icon /> Remove</Button></div></div></div> : <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors hover:bg-muted/30"><UploadCloudIcon className="size-6 text-muted-foreground" /><span className="mt-2 text-sm font-medium">{uploadingBanner ? "Uploading banner…" : "Upload careers banner"}</span><span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, or SVG · max 2MB</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" disabled={uploadingBanner} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadBanner(file); event.target.value = "" }} /></label>}</div>
                <div><Label>Header branding</Label><Select value={settings.headerBrandDisplay ?? "logo_and_name"} onValueChange={(headerBrandDisplay) => patch({ headerBrandDisplay: headerBrandDisplay as RecruitmentSettings["headerBrandDisplay"] })}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="logo_and_name">Logo and Name</SelectItem><SelectItem value="logo_only">Logo Only</SelectItem><SelectItem value="name_only">Name Only</SelectItem></SelectContent></Select><p className="mt-1.5 text-xs text-muted-foreground">Controls what appears in the careers page header. If the logo cannot load, the name is shown as a fallback.</p></div>
                <label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span><span className="block text-sm font-medium">Use organization branding</span><span className="text-xs text-muted-foreground">Inherit the organization logo and primary color.</span></span><Switch checked={settings.inheritOrganizationBranding} onCheckedChange={(checked) => patch({ inheritOrganizationBranding: checked })} /></label>
                {!settings.inheritOrganizationBranding && <div className="grid gap-4 sm:grid-cols-2"><div><Label>Primary color</Label><div className="mt-2 flex gap-2"><Input aria-label="Primary color picker" className="w-14 p-1" type="color" value={settings.branding.primaryColor} onChange={(event) => patch({ branding: { ...settings.branding, primaryColor: event.target.value } })} /><Input value={settings.branding.primaryColor} onChange={(event) => patch({ branding: { ...settings.branding, primaryColor: event.target.value } })} /></div></div><div><Label>Logo URL</Label><Input className="mt-2" type="url" value={settings.branding.logoUrl ?? ""} onChange={(event) => patch({ branding: { ...settings.branding, logoUrl: event.target.value || null } })} /></div></div>}
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Search & Sharing</h2>
              <p className="mb-5 text-sm text-muted-foreground">Customize how the careers page appears in search results and social previews.</p>
              <div className="grid gap-4">
                <div><Label>SEO title</Label><Input className="mt-2" maxLength={120} value={settings.seoTitle} onChange={(event) => patch({ seoTitle: event.target.value })} placeholder={settings.headline || "Company careers"} /><p className="mt-1 text-right text-xs text-muted-foreground">{settings.seoTitle.length}/120</p></div>
                <div><Label>SEO description</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={320} value={settings.seoDescription} onChange={(event) => patch({ seoDescription: event.target.value })} placeholder="A concise description for search engines." /><p className="mt-1 text-right text-xs text-muted-foreground">{settings.seoDescription.length}/320</p></div>
                <div><Label>Social share text</Label><textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" maxLength={500} value={settings.socialShareText} onChange={(event) => patch({ socialShareText: event.target.value })} placeholder="The message shown when someone shares your careers page." /><p className="mt-1 text-right text-xs text-muted-foreground">{settings.socialShareText.length}/500</p></div>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <div className="flex items-start justify-between"><div><h2 className="font-semibold">Social Links</h2><p className="text-sm text-muted-foreground">Give candidates a path to learn more.</p></div><Button size="sm" variant="outline" onClick={() => patch({ socialLinks: [...settings.socialLinks, { label: "", url: "" }] })}><PlusIcon /> Add</Button></div>
              <div className="mt-5 space-y-3">{settings.socialLinks.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No social links yet.</p> : settings.socialLinks.map((link, index) => <div key={index} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]"><Input aria-label={`Social link ${index + 1} label`} value={link.label} onChange={(event) => patch({ socialLinks: settings.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} placeholder="LinkedIn" /><Input aria-label={`Social link ${index + 1} URL`} type="url" value={link.url} onChange={(event) => patch({ socialLinks: settings.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) })} placeholder="https://…" /><Button size="icon" variant="ghost" aria-label="Remove social link" onClick={() => patch({ socialLinks: settings.socialLinks.filter((_, itemIndex) => itemIndex !== index) })}><Trash2Icon /></Button></div>)}</div>
            </section>
            <section className="rounded-2xl border bg-card p-6 shadow-xs">
              <h2 className="font-semibold">Candidate Privacy & Consent</h2>
              <p className="mb-5 text-sm text-muted-foreground">Publishing requires both a consent version and consent text.</p>
              <div className="grid gap-4"><div><Label>Privacy policy URL</Label><Input className="mt-2" type="url" value={settings.privacyPolicyUrl ?? ""} onChange={(event) => patch({ privacyPolicyUrl: event.target.value || null })} placeholder="https://…" /></div><div><Label>Consent version</Label><Input className="mt-2" value={settings.consent.version} onChange={(event) => patch({ consent: { ...settings.consent, version: event.target.value } })} placeholder="2026-07" /></div><div><Label>Consent text</Label><textarea className="mt-2 min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={settings.consent.text} onChange={(event) => patch({ consent: { ...settings.consent, text: event.target.value } })} placeholder="I agree that…" /></div></div>
            </section>
          </div>
          <aside><div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-xs"><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Candidate View</p>{settings.bannerUrl ? <img src={settings.bannerUrl} alt="" className="mt-4 aspect-[16/7] w-full rounded-xl object-cover" /> : <div className="mt-4 aspect-[16/7] rounded-xl bg-gradient-to-br from-amber-100 to-orange-50" />}<h3 className="mt-4 text-xl font-semibold">{settings.headline || "Your careers headline"}</h3><p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">{settings.intro || "Your introduction will appear here."}</p><Button className="mt-6 w-full" onClick={() => void save()} disabled={saving}>{saving && <Spinner />} Save Settings</Button></div></aside>
        </fieldset>
      </div>
    </RecruitmentShell>
  )
}
