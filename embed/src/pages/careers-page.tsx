import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseBusinessIcon, Building2Icon, CalendarDaysIcon, CheckCircle2Icon, ChevronDownIcon, Clock3Icon, ExternalLinkIcon, MapPinIcon, SearchIcon, UploadCloudIcon } from "lucide-react"
import { motion } from "motion/react"

import { Turnstile } from "../components/turnstile"
import { turnstileIsRequired } from "../lib/turnstile-config"
import { applyBrandPalette } from "../lib/brand-color"
import { careersApi, inferFileMimeType, isVisible, publicCareersPath, type CareersField, type CareersJob, type CareersSite, type UploadedResume } from "../lib/recruitment"

function Meta({ site, job }: { site: CareersSite; job?: CareersJob }) {
  useEffect(() => {
    const seo = job?.seo ?? site.seo
    const share = job?.share ?? site.share
    const canonicalPath = seo.canonicalPath
    const image = job?.seo.image ?? site.seo.image
    const canonicalUrl = new URL(canonicalPath, window.location.origin).toString()
    document.title = seo.title
    const upsert = (selector: string, attributes: Record<string, string>) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector)
      if (!element) {
        element = document.createElement("meta")
        document.head.appendChild(element)
      }
      Object.entries(attributes).forEach(([key, value]) => element!.setAttribute(key, value))
    }
    upsert('meta[name="description"]', { name: "description", content: seo.description })
    upsert('meta[property="og:title"]', { property: "og:title", content: share.title })
    upsert('meta[property="og:description"]', { property: "og:description", content: share.text })
    upsert('meta[property="og:url"]', { property: "og:url", content: canonicalUrl })
    upsert('meta[name="twitter:card"]', { name: "twitter:card", content: image ? "summary_large_image" : "summary" })
    upsert('meta[name="twitter:title"]', { name: "twitter:title", content: share.title })
    upsert('meta[name="twitter:description"]', { name: "twitter:description", content: share.text })
    if (image) {
      upsert('meta[property="og:image"]', { property: "og:image", content: image })
      upsert('meta[name="twitter:image"]', { name: "twitter:image", content: image })
    }
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement("link")
      canonical.rel = "canonical"
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
    let script = document.head.querySelector<HTMLScriptElement>('script[data-careers-jsonld]')
    if (!script) {
      script = document.createElement("script")
      script.type = "application/ld+json"
      script.dataset.careersJsonld = "true"
      document.head.appendChild(script)
    }
    script.text = JSON.stringify(job ? {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: job.title,
      description: job.description,
      datePosted: job.publishedAt,
      validThrough: job.applicationDeadline || undefined,
      employmentType: job.employmentType || undefined,
      hiringOrganization: { "@type": "Organization", name: site.organizationName, sameAs: site.website || undefined, logo: site.branding.logoUrl || undefined },
      jobLocationType: job.workplaceType === "remote" ? "TELECOMMUTE" : undefined,
      jobLocation: job.location ? { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location } } : undefined,
    } : {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: site.seo.title,
      description: site.seo.description,
      about: { "@type": "Organization", name: site.organizationName, url: site.website || undefined },
    })
  }, [job, site])
  return null
}

function formatSalary(job: CareersJob) {
  if (!job.salaryVisible || (job.salaryMin === null && job.salaryMax === null)) return null
  const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency: job.salaryCurrency, maximumFractionDigits: 0 })
  const period = job.salaryPeriod === "hour" ? "hour" : job.salaryPeriod === "month" ? "month" : "year"
  if (job.salaryMin !== null && job.salaryMax !== null) return `${formatter.format(job.salaryMin)} – ${formatter.format(job.salaryMax)} per ${period}`
  if (job.salaryMin !== null) return `From ${formatter.format(job.salaryMin)} per ${period}`
  return `Up to ${formatter.format(job.salaryMax!)} per ${period}`
}

const reveal = (index: number) => ({ "--reveal-i": index }) as React.CSSProperties

const inputClasses = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[15px] text-stone-100 outline-none transition-[border-color,box-shadow,background-color] placeholder:text-stone-500 focus:border-brand-bright/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-bright/20"

function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-[#0c0a09]"><div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-stone-200" aria-label="Loading careers" /></div>
}

function ErrorPage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#0c0a09] p-6">
    <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <BriefcaseBusinessIcon className="mx-auto size-8 text-stone-500" />
      <h1 className="mt-4 font-display text-2xl font-semibold text-stone-100">This careers page is unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-stone-400">{message}</p>
      <button type="button" className="mt-6 rounded-full bg-stone-100 px-5 py-2.5 text-sm font-semibold text-stone-950 transition-transform active:scale-[.97]" onClick={() => window.location.reload()}>Try again</button>
    </div>
  </main>
}

function Header({ site, embed }: { site: CareersSite; embed: boolean }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const hideBrokenLogo = useCallback(() => setLogoFailed(true), [])
  const display = site.headerBrandDisplay ?? "logo_and_name"
  const logoAvailable = Boolean(site.branding.logoUrl) && !logoFailed
  // A logo-only header still needs an accessible, visible brand when the logo
  // is missing or fails to load, so fall back to the organization name.
  const showLogo = display !== "name_only" && logoAvailable
  const showName = display !== "logo_only" || !logoAvailable
  return <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0c0a09]/80 backdrop-blur-md">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
      <a href={publicCareersPath(site.organizationPath)} className="flex min-w-0 items-center gap-3 font-display text-[15px] font-semibold text-stone-100">
        {/* White plate keeps dark-on-transparent logos legible on the ink background. */}
        {showLogo && <img src={site.branding.logoUrl!} alt={showName ? "" : site.organizationName} className={showName ? "size-9 shrink-0 rounded-lg bg-white object-contain p-1" : "h-9 w-auto max-w-48 rounded-lg bg-white object-contain px-1.5 py-1"} onError={hideBrokenLogo} />}
        {showName && <span className="truncate">{site.organizationName}</span>}
      </a>
      {!embed && site.website && <a href={site.website} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors hover:text-stone-100">Company site <ExternalLinkIcon className="size-3.5" /></a>}
    </div>
  </header>
}

const heroGlow = {
  background: "radial-gradient(56rem 32rem at 84% -18%, color-mix(in oklab, var(--brand) 40%, transparent), transparent 66%), radial-gradient(44rem 30rem at -12% 118%, color-mix(in oklab, var(--brand) 20%, transparent), transparent 62%)",
}

function CareersListing({ site, jobs, embed, onNavigate }: { site: CareersSite; jobs: CareersJob[]; embed: boolean; onNavigate?: (path: string) => void }) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [department, setDepartment] = useState(() => initialParams.get("department") ?? "")
  const [location, setLocation] = useState(() => initialParams.get("location") ?? "")
  const [type, setType] = useState("")
  const [query, setQuery] = useState(() => initialParams.get("query") ?? "")
  const values = (key: "department" | "location" | "employmentType") => Array.from(new Set(jobs.map((job) => job[key]).filter(Boolean))).sort()
  const filtered = jobs.filter((job) => (!department || job.department === department) && (!location || job.location === location) && (!type || job.employmentType === type) && (!query || `${job.title} ${job.department} ${job.location}`.toLowerCase().includes(query.toLowerCase())))
  const grouped: Array<{ name: string; jobs: CareersJob[] }> = []
  for (const job of filtered) {
    const name = job.department || "General"
    const group = grouped.find((entry) => entry.name === name)
    if (group) group.jobs.push(job)
    else grouped.push({ name, jobs: [job] })
  }
  const showGroups = grouped.length > 1
  return <>
    <Meta site={site} />
    <Header site={site} embed={embed} />
    <main className="relative text-stone-200">
      <section className="relative overflow-hidden">
        {site.bannerUrl && <>
          <img src={site.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a09]/60 via-[#0c0a09]/80 to-[#0c0a09]" />
        </>}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={heroGlow} />
        <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 opacity-[0.055]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#0c0a09]" />
        <div className={`relative mx-auto max-w-6xl px-5 ${embed ? "pt-12 pb-10" : "pt-20 pb-16 sm:pt-28 sm:pb-20"}`}>
          <p className="reveal flex items-center gap-3 text-[11px] font-bold tracking-[0.28em] text-brand-bright uppercase" style={reveal(0)}>
            <span aria-hidden="true" className="h-px w-8 bg-brand-bright/60" />
            Careers at {site.organizationName}
          </p>
          <h1 className={`reveal mt-5 max-w-4xl font-display font-bold tracking-tight text-balance text-stone-50 ${embed ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl lg:text-7xl"}`} style={reveal(1)}>
            {site.headline || `Do work that moves things forward.`}
          </h1>
          {site.intro && <p className="reveal mt-6 max-w-xl text-base leading-7 whitespace-pre-line text-stone-400" style={reveal(2)}>{site.intro}</p>}
        </div>
      </section>
      <section className={`mx-auto max-w-6xl px-5 ${embed ? "pb-12" : "pb-20 sm:pb-28"}`}>
        <div className="reveal flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.08] pt-8" style={reveal(3)}>
          <h2 className="font-display text-2xl font-semibold text-stone-100">Open Roles</h2>
          <p className="text-sm tabular-nums text-stone-500">{filtered.length} role{filtered.length === 1 ? "" : "s"} shown</p>
        </div>
        <div className="reveal mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]" style={reveal(4)}>
          <label className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 transition-colors focus-within:border-brand-bright/50 focus-within:bg-white/[0.06] sm:col-span-3 lg:col-span-1">
            <SearchIcon className="size-4 shrink-0 text-stone-500" />
            <span className="sr-only">Search roles</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 outline-none placeholder:text-stone-500" />
          </label>
          {[["Department", department, setDepartment, values("department")], ["Location", location, setLocation, values("location")], ["Type", type, setType, values("employmentType")]].map(([label, current, setter, options]) => <label key={label as string} className="relative">
            <span className="sr-only">{label as string}</span>
            <select value={current as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-9 pl-3.5 text-sm text-stone-200 outline-none transition-colors focus:border-brand-bright/50 [&>option]:bg-[#1c1917]">
              <option value="">All {String(label).toLowerCase()}s</option>
              {(options as string[]).map((option) => <option key={option}>{option}</option>)}
            </select>
            <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500" />
          </label>)}
        </div>
        {filtered.length > 0 ? <div className="reveal mt-8 space-y-10" style={reveal(5)}>
          {grouped.map((group) => <div key={group.name}>
            {showGroups && <div className="mb-3 flex items-baseline gap-2.5">
              <p className="text-[11px] font-bold tracking-[0.22em] text-stone-500 uppercase">{group.name}</p>
              <span className="text-[11px] font-semibold tabular-nums text-stone-600">{group.jobs.length}</span>
            </div>}
            <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {group.jobs.map((job) => {
                const salary = formatSalary(job)
                const path = job.seo.canonicalPath || publicCareersPath(site.organizationPath, job.slug)
                return <a key={job.id} href={`${path}${embed ? "?embed=1" : ""}`} onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(path) } : undefined} className="group flex items-center gap-5 py-5 transition-colors duration-200 hover:bg-white/[0.02] sm:gap-6 sm:py-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h3 className="font-display text-lg font-semibold text-stone-100 transition-colors duration-200 group-hover:text-brand-bright sm:text-xl">{job.title}</h3>
                      {job.deadlineClosed && <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-stone-500 uppercase">Applications closed</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-stone-500">
                      {!showGroups && <span className="flex items-center gap-1.5"><Building2Icon className="size-3.5" />{job.department || "General"}</span>}
                      <span className="flex items-center gap-1.5"><MapPinIcon className="size-3.5" />{job.location || "Flexible"}</span>
                      <span className="flex items-center gap-1.5"><Clock3Icon className="size-3.5" />{job.employmentType || "Role"}</span>
                      {salary && <span className="rounded-full border border-brand-bright/20 bg-brand-bright/10 px-2.5 py-0.5 text-xs font-semibold text-brand-bright">{salary}</span>}
                    </div>
                  </div>
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-stone-400 transition-colors duration-200 group-hover:border-brand-strong group-hover:bg-brand-strong group-hover:text-brand-ink">
                    <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                  </span>
                </a>
              })}
            </div>
          </div>)}
        </div> : <div className="reveal mt-8 rounded-2xl border border-dashed border-white/10 py-20 text-center" style={reveal(5)}>
          <p className="font-display text-xl font-semibold text-stone-200">No roles match those filters.</p>
          <button type="button" className="mt-4 text-sm font-semibold text-brand-bright underline-offset-4 hover:underline" onClick={() => { setQuery(""); setDepartment(""); setLocation(""); setType("") }}>Clear filters</button>
        </div>}
      </section>
    </main>
    <Footer site={site} />
  </>
}

function Field({ field, value, onChange, onUpload, uploading }: { field: CareersField; value: unknown; onChange: (value: unknown) => void; onUpload: (files: FileList, field: CareersField) => void; uploading: boolean }) {
  if (field.type === "long_text") return <textarea className={`mt-2 min-h-28 resize-y ${inputClasses}`} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? undefined} />
  if (field.type === "dropdown") return <span className="relative mt-2 block">
    <select className={`appearance-none pr-9 [&>option]:bg-[#1c1917] ${inputClasses}`} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose an option</option>
      {field.options?.map((option) => <option key={option}>{option}</option>)}
    </select>
    <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500" />
  </span>
  if (field.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : []
    return <div className="mt-3 space-y-2">{field.options?.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm font-normal text-stone-300 transition-colors hover:border-white/20"><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} className="size-4 accent-brand-strong" />{option}</label>)}</div>
  }
  if (field.type === "yes_no") return <div className="mt-2 grid grid-cols-2 gap-2">{[true, false].map((answer) => <button key={String(answer)} type="button" onClick={() => onChange(answer)} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${value === answer ? "border-brand-strong bg-brand-strong text-brand-ink" : "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/25"}`}>{answer ? "Yes" : "No"}</button>)}</div>
  if (field.type === "rating") return <div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={`size-10 rounded-lg border text-sm font-semibold transition-colors ${value === rating ? "border-brand-strong bg-brand-strong text-brand-ink" : "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/25"}`} onClick={() => onChange(rating)}>{rating}</button>)}</div>
  if (field.type === "file") return <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 transition-colors hover:border-brand-bright/40"><UploadCloudIcon className="size-5 shrink-0 text-stone-500" /><span className={`min-w-0 flex-1 text-sm font-normal ${value ? "text-stone-200" : "text-stone-400"}`}>{uploading ? "Uploading…" : value ? (Array.isArray(value) ? `${value.length} file(s) uploaded` : (value as UploadedResume).fileName) : `Choose PDF or DOCX · max ${Math.min(field.maxFileSizeMb ?? 10, 10)}MB each`}</span><input className="sr-only" type="file" multiple={field.multiple} accept={(field.allowedMimeTypes?.length ? field.allowedMimeTypes : ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).join(",")} disabled={uploading} onChange={(event) => event.target.files && onUpload(event.target.files, field)} /></label>
  const type = field.type === "short_text" || field.type === "phone" ? "text" : field.type
  return <input className={`mt-2 ${inputClasses}`} type={type} value={String(value ?? "")} onChange={(event) => onChange(field.type === "number" ? (event.target.value === "" ? undefined : event.target.valueAsNumber) : event.target.value)} placeholder={field.placeholder ?? undefined} />
}

function ApplicationForm({ site, job }: { site: CareersSite; job: CareersJob }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [resume, setResume] = useState<UploadedResume | null>(null)
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("")
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [uploadSession, setUploadSession] = useState("")
  const [uploading, setUploading] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const fields = job.applicationForm?.fields ?? []
  const consentField = job.applicationForm?.lockedFields.find((field) => field.id === "consent")
  const onToken = useCallback((token: string) => setTurnstileToken(token), [])

  async function upload(files: FileList, field?: CareersField) {
    setError("")
    const selected = Array.from(files)
    const fieldId = field?.id
    const maxMb = Math.min(field?.maxFileSizeMb ?? 10, 10)
    const maxBytes = maxMb * 1024 * 1024
    const allowed = field?.allowedMimeTypes?.length
      ? field.allowedMimeTypes
      : ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if (!field?.multiple && selected.length > 1) { setError(`“${field?.label ?? "Resume"}” accepts one file.`); return }
    const invalid = selected.find((file) => {
      const mime = inferFileMimeType(file)
      return !mime || !allowed.includes(mime) || file.size <= 0 || file.size > maxBytes
    })
    if (invalid) { setError(`${invalid.name} must match the allowed type and be no larger than ${maxMb}MB.`); return }
    if (!uploadSession && turnstileIsRequired && !turnstileToken) {
      setError("Complete application verification before uploading files.")
      return
    }
    setUploading(fieldId ?? "resume")
    try {
      let session = uploadSession
      const uploaded: UploadedResume[] = []
      for (const file of selected) {
        const result = await careersApi.upload(site.organizationPath, job.slug, file, {
          fieldId,
          contentType: field ? inferFileMimeType(file) ?? undefined : undefined,
          turnstileToken: session ? undefined : turnstileToken,
          uploadSession: session || undefined,
        })
        session = result.uploadSession
        uploaded.push(result.file)
      }
      setUploadSession(session)
      if (fieldId) {
        const field = fields.find((item) => item.id === fieldId)
        setAnswers((current) => ({ ...current, [fieldId]: field?.multiple ? uploaded : uploaded[0] }))
      } else setResume(uploaded[0])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed")
      if (!uploadSession) {
        setTurnstileToken("")
        setTurnstileAttempt((current) => current + 1)
      }
    } finally {
      setUploading("")
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    const visible = fields.filter((field) => isVisible(field, answers))
    const invalidNumber = visible.find((field) => field.type === "number" && answers[field.id] !== undefined && !Number.isFinite(answers[field.id]))
    const missing = visible.find((field) => field.required && (answers[field.id] === undefined || answers[field.id] === "" || (Array.isArray(answers[field.id]) && (answers[field.id] as unknown[]).length === 0)))
    const fail = (message: string) => {
      setError(message)
      setTurnstileToken("")
      setTurnstileAttempt((current) => current + 1)
      setUploadSession("")
    }
    if (!fullName.trim() || !email.trim() || !resume || !consent || missing || invalidNumber) {
      fail(invalidNumber ? `“${invalidNumber.label}” must be a valid number.` : missing ? `“${missing.label}” is required.` : "Complete your name, email, resume, and consent.")
      return
    }
    if (turnstileIsRequired && !turnstileToken && !uploadSession) { fail("Complete application verification."); return }
    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      await careersApi.apply(site.organizationPath, job.slug, {
        fullName, email, resume, answers, consent: { accepted: true, version: consentField?.version }, website, turnstileToken, uploadSession,
        metadata: {
          source: params.get("source") || params.get("utm_source") || "careers_site",
          referrer: document.referrer,
          utm: Object.fromEntries(["source", "medium", "campaign", "term", "content"].map((key) => [key, params.get(`utm_${key}`) || ""])),
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: `${window.screen.width}x${window.screen.height}`,
        },
      })
      setSuccess(true)
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    } catch (reason) {
      fail(reason instanceof Error ? reason.message : "Application could not be submitted")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="relative overflow-hidden rounded-3xl border border-brand-bright/25 bg-[#13100e] p-8 text-center">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36" style={{ background: "radial-gradient(24rem 10rem at 50% 0%, color-mix(in oklab, var(--brand) 22%, transparent), transparent 70%)" }} />
    <div className="relative">
      <CheckCircle2Icon className="mx-auto size-10 text-brand-bright" />
      <h2 className="mt-4 font-display text-2xl font-semibold text-stone-50">Application received</h2>
      <p className="mt-2 text-sm leading-6 text-stone-400">Thanks, {fullName.split(" ")[0]}. Your application is now with the hiring team.</p>
    </div>
  </motion.div>
  return <form onSubmit={submit} noValidate className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#13100e] p-5 shadow-[0_32px_80px_-32px_rgba(0,0,0,0.9)] sm:p-7">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-bright/60 to-transparent" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: "radial-gradient(30rem 12rem at 50% 0%, color-mix(in oklab, var(--brand) 13%, transparent), transparent 72%)" }} />
    <div className="relative">
      <p className="text-[11px] font-bold tracking-[0.24em] text-brand-bright uppercase">Apply for this role</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-stone-50">Tell Us About Yourself</h2>
      <div className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-stone-200">Full name <span aria-hidden="true" className="text-brand-bright">*</span><input className={`mt-2 ${inputClasses}`} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
        <label className="block text-sm font-semibold text-stone-200">Email <span aria-hidden="true" className="text-brand-bright">*</span><input className={`mt-2 ${inputClasses}`} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <Turnstile key={turnstileAttempt} onToken={onToken} />
        <label className="block text-sm font-semibold text-stone-200">Resume <span aria-hidden="true" className="text-brand-bright">*</span><span className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 transition-colors hover:border-brand-bright/40"><UploadCloudIcon className="size-5 shrink-0 text-stone-500" /><span className={`min-w-0 flex-1 font-normal ${resume ? "text-stone-200" : "text-stone-400"}`}>{uploading === "resume" ? "Uploading…" : resume ? resume.fileName : "Upload a PDF or DOCX up to 10MB"}</span><input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={Boolean(uploading)} onChange={(event) => event.target.files && void upload(event.target.files)} /></span></label>
        {fields.filter((field) => isVisible(field, answers)).map((field) => <label key={field.id} className="block text-sm font-semibold text-stone-200">{field.label} {field.required && <span aria-hidden="true" className="text-brand-bright">*</span>}{field.description && <span className="mt-1 block text-xs leading-5 font-normal text-stone-500">{field.description}</span>}<Field field={field} value={answers[field.id]} onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))} onUpload={(files, fileField) => void upload(files, fileField)} uploading={uploading === field.id} /></label>)}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-stone-300"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-brand-strong" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{consentField?.label || "I consent to the processing of my application data."} {site.privacyPolicyUrl && <a className="font-semibold text-brand-bright underline-offset-2 hover:underline" href={site.privacyPolicyUrl} target="_blank" rel="noreferrer">Privacy policy</a>}</span></label>
        <label className="absolute -left-[10000px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        <button disabled={submitting || Boolean(uploading) || !job.acceptingApplications} className="brand-shadow group flex w-full items-center justify-center gap-2 rounded-full bg-brand-strong px-6 py-3.5 text-sm font-bold text-brand-ink transition-[transform,filter,opacity] duration-150 hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Sending application…" : "Submit application"} {!submitting && <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />}</button>
      </div>
    </div>
  </form>
}

function JobDetail({ site, job, embed, onClose }: { site: CareersSite; job: CareersJob; embed: boolean; onClose?: () => void }) {
  const deadline = job.applicationDeadline ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(job.applicationDeadline)) : null
  const salary = formatSalary(job)
  const listingPath = publicCareersPath(site.organizationPath)
  const facts = ([[MapPinIcon, job.location], [Clock3Icon, job.employmentType], [Building2Icon, job.workplaceType]] as Array<[typeof MapPinIcon, string | null]>).filter(([, value]) => Boolean(value)) as Array<[typeof MapPinIcon, string]>
  return <>
    <Meta site={site} job={job} />
    <Header site={site} embed={embed} />
    <main className="relative min-h-screen overflow-hidden text-stone-200">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[28rem]" style={{ background: "radial-gradient(48rem 26rem at 22% -30%, color-mix(in oklab, var(--brand) 28%, transparent), transparent 66%)" }} />
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-[0.05]" />
      <div className={`relative mx-auto max-w-6xl px-5 ${embed ? "pt-8 pb-12" : "pt-10 pb-20 sm:pt-14 sm:pb-24"}`}>
        <a href={`${listingPath}${embed ? "?embed=1" : ""}`} onClick={onClose ? (event) => { event.preventDefault(); onClose() } : undefined} className="group inline-flex items-center gap-2 text-sm font-semibold text-stone-400 transition-colors hover:text-stone-100"><ArrowLeftIcon className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" /> All open roles</a>
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <article>
            <p className="reveal flex items-center gap-3 text-[11px] font-bold tracking-[0.28em] text-brand-bright uppercase" style={reveal(0)}>
              <span aria-hidden="true" className="h-px w-8 bg-brand-bright/60" />
              {job.department || "Open role"}
            </p>
            <h1 className="reveal mt-4 font-display text-4xl font-bold tracking-tight text-balance text-stone-50 sm:text-5xl" style={reveal(1)}>{job.title}</h1>
            <div className="reveal mt-6 flex flex-wrap items-center gap-2" style={reveal(2)}>
              {facts.map(([Icon, label]) => <span key={label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-stone-300 capitalize"><Icon className="size-3.5 text-stone-500" />{label}</span>)}
              {salary && <span className="rounded-full border border-brand-bright/25 bg-brand-bright/10 px-3.5 py-1.5 text-[13px] font-semibold text-brand-bright">{salary}</span>}
            </div>
            {deadline && <p className={`reveal mt-5 flex items-center gap-2 text-sm ${job.deadlineClosed ? "font-semibold text-red-300" : "text-stone-400"}`} style={reveal(3)}><CalendarDaysIcon className="size-4" />{job.deadlineClosed ? `Applications closed on ${deadline}` : `Apply by ${deadline}`}</p>}
            <div className="reveal mt-12 space-y-12" style={reveal(4)}>
              <section>
                <div className="flex items-center gap-4">
                  <h2 className="shrink-0 font-display text-2xl font-semibold text-stone-100">About the Role</h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" />
                </div>
                <div className="careers-copy mt-5 text-[15px] leading-[1.85] whitespace-pre-line text-stone-400">{job.description || "Role details will be shared during the hiring process."}</div>
              </section>
              {job.requirements && <section>
                <div className="flex items-center gap-4">
                  <h2 className="shrink-0 font-display text-2xl font-semibold text-stone-100">What You’ll Bring</h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-white/[0.08]" />
                </div>
                <div className="careers-copy mt-5 text-[15px] leading-[1.85] whitespace-pre-line text-stone-400">{job.requirements}</div>
              </section>}
            </div>
          </article>
          <aside className="reveal lg:sticky lg:top-20" style={reveal(3)}>
            {job.deadlineClosed || !job.acceptingApplications ? <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <CalendarDaysIcon className="mx-auto size-8 text-stone-500" />
              <h2 className="mt-4 font-display text-2xl font-semibold text-stone-100">Applications are closed</h2>
              <p className="mt-2 text-sm leading-6 text-stone-400">This role remains visible for reference, but new applications are no longer accepted.</p>
              <a href={listingPath} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-bright underline-offset-4 hover:underline">Explore other roles <ArrowRightIcon className="size-4" /></a>
            </div> : <ApplicationForm site={site} job={job} />}
          </aside>
        </div>
      </div>
    </main>
    <Footer site={site} />
  </>
}

function Footer({ site }: { site: CareersSite }) {
  return <footer className="border-t border-white/[0.08] px-5 py-8">
    <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <p className="text-sm text-stone-500">© {new Date().getFullYear()} {site.organizationName}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {site.socialLinks.map((link) => <a key={link.url} className="text-sm text-stone-400 transition-colors hover:text-brand-bright" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}
        {site.privacyPolicyUrl && <a className="text-sm text-stone-400 transition-colors hover:text-brand-bright" href={site.privacyPolicyUrl} target="_blank" rel="noreferrer">Privacy</a>}
      </div>
    </div>
  </footer>
}

export default function CareersPage({ organizationPath, jobSlug, embed }: { organizationPath: string; jobSlug?: string; embed: boolean }) {
  const [site, setSite] = useState<CareersSite | null>(null)
  const [jobs, setJobs] = useState<CareersJob[]>([])
  const [job, setJob] = useState<CareersJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const widget = useMemo(() => {
    if (!embed) return { enabled: false, parentOrigin: "", theme: "light" }
    const params = new URLSearchParams(window.location.search)
    const candidate = params.get("parentOrigin")
    try {
      const parsed = candidate ? new URL(candidate) : null
      const parentOrigin = parsed && (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.origin : ""
      return { enabled: params.get("widget") === "1" && Boolean(parentOrigin), parentOrigin, theme: params.get("theme") ?? "auto" }
    } catch {
      return { enabled: false, parentOrigin: "", theme: "light" }
    }
  }, [embed])
  const postWidgetMessage = useCallback((type: "ready" | "height" | "navigate" | "close", extra: Record<string, unknown> = {}) => {
    if (!widget.enabled || window.parent === window) return
    window.parent.postMessage({ channel: "inboundr:recruitment:v1", type, ...extra }, widget.parentOrigin)
  }, [widget])
  const tasks = useMemo(() => jobSlug
    ? [careersApi.site(organizationPath), careersApi.job(organizationPath, jobSlug)]
    : [careersApi.site(organizationPath), careersApi.jobs(organizationPath)], [jobSlug, organizationPath])
  useEffect(() => {
    let cancelled = false
    Promise.all(tasks).then(([siteResult, contentResult]) => {
      if (cancelled) return
      const careers = (siteResult as { careers: CareersSite }).careers
      // Applied before the branded UI renders so brand-derived colors never flash defaults.
      applyBrandPalette(careers.branding.primaryColor)
      setSite(careers)
      if ("job" in contentResult) setJob(contentResult.job)
      else if ("items" in contentResult) setJobs(contentResult.items)
    }).catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Careers page unavailable")).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [tasks])
  useEffect(() => {
    if (!widget.enabled) return
    const root = document.getElementById("root")
    if (!root) return
    let frame = 0
    const report = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => postWidgetMessage("height", { height: Math.ceil(root.scrollHeight) }))
    }
    const observer = new ResizeObserver(report)
    observer.observe(root)
    postWidgetMessage("ready", { path: window.location.pathname })
    report()
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [postWidgetMessage, widget])
  if (loading) return <Loading />
  if (error || !site) return <ErrorPage message={error || "The organization could not be found."} />
  if (jobSlug) return job ? <JobDetail site={site} job={job} embed={embed} onClose={widget.enabled ? () => postWidgetMessage("close") : undefined} /> : <ErrorPage message="This role could not be found." />
  return <CareersListing site={site} jobs={jobs} embed={embed} onNavigate={widget.enabled ? (path) => postWidgetMessage("navigate", { path }) : undefined} />
}
