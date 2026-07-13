import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseBusinessIcon, Building2Icon, CalendarDaysIcon, CheckCircle2Icon, Clock3Icon, ExternalLinkIcon, MapPinIcon, SearchIcon, UploadCloudIcon } from "lucide-react"

import { Turnstile } from "../components/turnstile"
import { turnstileIsRequired } from "../lib/turnstile-config"
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

function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f4f1ea]"><div className="size-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" aria-label="Loading careers" /></div>
}

function ErrorPage({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] p-6"><div className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm"><BriefcaseBusinessIcon className="mx-auto size-8 text-stone-400" /><h1 className="mt-4 font-display text-2xl font-semibold">This careers page is unavailable</h1><p className="mt-2 text-sm leading-6 text-stone-600">{message}</p><button type="button" className="mt-6 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white active:scale-[.97]" onClick={() => window.location.reload()}>Try again</button></div></main>
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
  return <header className="border-b border-white/10 bg-stone-950"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><a href={publicCareersPath(site.organizationPath)} className="flex items-center gap-3 font-display font-semibold text-white">{showLogo && <img src={site.branding.logoUrl!} alt={showName ? "" : site.organizationName} className={showName ? "size-9 rounded-lg bg-white object-contain p-0.5" : "h-10 w-auto max-w-52 object-contain"} onError={hideBrokenLogo} />}{showName && <span>{site.organizationName}</span>}</a>{!embed && site.website && <a href={site.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-stone-400 transition-colors hover:text-white">Company site <ExternalLinkIcon className="size-3.5" /></a>}</div></header>
}

function CareersListing({ site, jobs, embed, onNavigate }: { site: CareersSite; jobs: CareersJob[]; embed: boolean; onNavigate?: (path: string) => void }) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [department, setDepartment] = useState(() => initialParams.get("department") ?? "")
  const [location, setLocation] = useState(() => initialParams.get("location") ?? "")
  const [type, setType] = useState("")
  const [query, setQuery] = useState(() => initialParams.get("query") ?? "")
  const values = (key: "department" | "location" | "employmentType") => Array.from(new Set(jobs.map((job) => job[key]).filter(Boolean))).sort()
  const filtered = jobs.filter((job) => (!department || job.department === department) && (!location || job.location === location) && (!type || job.employmentType === type) && (!query || `${job.title} ${job.department} ${job.location}`.toLowerCase().includes(query.toLowerCase())))
  return <>
    <Meta site={site} />
    <Header site={site} embed={embed} />
    <main className="bg-[#f4f1ea] text-stone-950">
      <section className={`relative overflow-hidden border-b border-black/10 ${embed ? "py-10" : "py-14 sm:py-20"}`} style={{ backgroundColor: site.branding.primaryColor }}>
        {site.bannerUrl && <><img src={site.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-stone-950/65" /></>}
        <div className="relative mx-auto max-w-6xl px-5 text-white"><p className="text-xs font-bold tracking-[.22em] uppercase opacity-75">Careers at {site.organizationName}</p><h1 className={`mt-3 max-w-3xl font-display font-semibold leading-tight ${embed ? "text-3xl" : "text-4xl sm:text-5xl"}`}>{site.headline || `Do work that moves things forward.`}</h1>{site.intro && <p className="mt-4 max-w-xl whitespace-pre-line text-base leading-7 text-white/80">{site.intro}</p>}</div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><h2 className="font-display text-2xl font-semibold">Open Roles</h2><p className="text-sm text-stone-500">{filtered.length} role{filtered.length === 1 ? "" : "s"} shown</p></div>
        <div className="mt-5 grid gap-2 rounded-xl border border-black/10 bg-white p-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-lg bg-stone-100 px-3"><SearchIcon className="size-4 text-stone-400" /><span className="sr-only">Search roles</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" /></label>
          {[["Department", department, setDepartment, values("department")], ["Location", location, setLocation, values("location")], ["Type", type, setType, values("employmentType")]].map(([label, current, setter, options]) => <label key={label as string}><span className="sr-only">{label as string}</span><select value={current as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="h-full w-full rounded-lg border-0 bg-stone-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-stone-900"><option value="">All {String(label).toLowerCase()}s</option>{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}
        </div>
        <div className="mt-5 divide-y divide-black/10 border-y border-black/10">{filtered.map((job) => { const salary = formatSalary(job); const path = job.seo.canonicalPath || publicCareersPath(site.organizationPath, job.slug); return <a key={job.id} href={`${path}${embed ? "?embed=1" : ""}`} onClick={onNavigate ? (event) => { event.preventDefault(); onNavigate(path) } : undefined} className="group grid gap-4 py-5 transition-colors hover:bg-black/[.025] sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-semibold">{job.title}</h3>{job.deadlineClosed && <span className="rounded-full bg-stone-200 px-2.5 py-1 text-[11px] font-bold tracking-wide text-stone-600 uppercase">Applications closed</span>}</div><div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500"><span className="flex items-center gap-1.5"><Building2Icon className="size-3.5" />{job.department || "General"}</span><span className="flex items-center gap-1.5"><MapPinIcon className="size-3.5" />{job.location || "Flexible"}</span><span className="flex items-center gap-1.5"><Clock3Icon className="size-3.5" />{job.employmentType || "Role"}</span>{salary && <span className="font-semibold text-stone-700">{salary}</span>}</div></div><span className="flex size-10 items-center justify-center rounded-full border border-black/15 transition-colors group-hover:bg-stone-950 group-hover:text-white"><ArrowRightIcon className="size-4" /></span></a> })}</div>
        {filtered.length === 0 && <div className="py-16 text-center"><p className="font-display text-xl font-semibold">No roles match those filters.</p><button type="button" className="mt-3 text-sm font-semibold underline underline-offset-4" onClick={() => { setQuery(""); setDepartment(""); setLocation(""); setType("") }}>Clear filters</button></div>}
      </section>
    </main>
    <Footer site={site} />
  </>
}

function Field({ field, value, onChange, onUpload, uploading }: { field: CareersField; value: unknown; onChange: (value: unknown) => void; onUpload: (files: FileList, field: CareersField) => void; uploading: boolean }) {
  const classes = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[15px] outline-none transition-[border-color,box-shadow] focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
  if (field.type === "long_text") return <textarea className={`${classes} min-h-28 resize-y`} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? undefined} />
  if (field.type === "dropdown") return <select className={classes} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Choose an option</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
  if (field.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : []
    return <div className="mt-3 space-y-2">{field.options?.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm"><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} className="size-4 accent-stone-950" />{option}</label>)}</div>
  }
  if (field.type === "yes_no") return <div className="mt-2 grid grid-cols-2 gap-2">{[true, false].map((answer) => <button key={String(answer)} type="button" onClick={() => onChange(answer)} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value === answer ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"}`}>{answer ? "Yes" : "No"}</button>)}</div>
  if (field.type === "rating") return <div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={`size-10 rounded-lg border text-sm font-semibold ${value === rating ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"}`} onClick={() => onChange(rating)}>{rating}</button>)}</div>
  if (field.type === "file") return <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"><UploadCloudIcon className="size-5 text-stone-500" /><span className="min-w-0 flex-1 text-sm">{uploading ? "Uploading…" : value ? (Array.isArray(value) ? `${value.length} file(s) uploaded` : (value as UploadedResume).fileName) : `Choose PDF or DOCX · max ${Math.min(field.maxFileSizeMb ?? 10, 10)}MB each`}</span><input className="sr-only" type="file" multiple={field.multiple} accept={(field.allowedMimeTypes?.length ? field.allowedMimeTypes : ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).join(",")} disabled={uploading} onChange={(event) => event.target.files && onUpload(event.target.files, field)} /></label>
  const type = field.type === "short_text" || field.type === "phone" ? "text" : field.type
  return <input className={classes} type={type} value={String(value ?? "")} onChange={(event) => onChange(field.type === "number" ? (event.target.value === "" ? undefined : event.target.valueAsNumber) : event.target.value)} placeholder={field.placeholder ?? undefined} />
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
    if (!field?.multiple && selected.length > 1) { setError(`“${field.label}” accepts one file.`); return }
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

  if (success) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2Icon className="mx-auto size-10 text-emerald-700" /><h2 className="mt-4 font-display text-2xl font-semibold">Application received</h2><p className="mt-2 text-sm leading-6 text-emerald-900/70">Thanks, {fullName.split(" ")[0]}. Your application is now with the hiring team.</p></div>
  return <form onSubmit={submit} className="rounded-3xl border border-black/10 bg-[#f8f6f1] p-5 sm:p-6" noValidate>
    <p className="text-xs font-bold tracking-[.2em] text-stone-500 uppercase">Apply for this role</p><h2 className="mt-2 font-display text-2xl font-semibold">Tell Us About Yourself</h2>
    <div className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">Full name <span aria-hidden="true">*</span><input className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
      <label className="block text-sm font-semibold">Email <span aria-hidden="true">*</span><input className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <Turnstile key={turnstileAttempt} onToken={onToken} />
      <label className="block text-sm font-semibold">Resume <span aria-hidden="true">*</span><span className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"><UploadCloudIcon className="size-5 text-stone-500" /><span className="min-w-0 flex-1 font-normal">{uploading === "resume" ? "Uploading…" : resume ? resume.fileName : "Upload a PDF or DOCX up to 10MB"}</span><input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={Boolean(uploading)} onChange={(event) => event.target.files && void upload(event.target.files)} /></span></label>
      {fields.filter((field) => isVisible(field, answers)).map((field) => <label key={field.id} className="block text-sm font-semibold">{field.label} {field.required && <span aria-hidden="true">*</span>}{field.description && <span className="mt-1 block text-xs font-normal leading-5 text-stone-500">{field.description}</span>}<Field field={field} value={answers[field.id]} onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))} onUpload={(files, fileField) => void upload(files, fileField)} uploading={uploading === field.id} /></label>)}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-stone-950" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{consentField?.label || "I consent to the processing of my application data."} {site.privacyPolicyUrl && <a className="font-semibold underline underline-offset-2" href={site.privacyPolicyUrl} target="_blank" rel="noreferrer">Privacy policy</a>}</span></label>
      <label className="absolute -left-[10000px]" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <button disabled={submitting || Boolean(uploading) || !job.acceptingApplications} className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-950 px-6 py-3.5 text-sm font-bold text-white transition-[transform,opacity] duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Sending application…" : "Submit application"} {!submitting && <ArrowRightIcon className="size-4" />}</button>
    </div>
  </form>
}

function JobDetail({ site, job, embed, onClose }: { site: CareersSite; job: CareersJob; embed: boolean; onClose?: () => void }) {
  const deadline = job.applicationDeadline ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(job.applicationDeadline)) : null
  const salary = formatSalary(job)
  const listingPath = publicCareersPath(site.organizationPath)
  return <><Meta site={site} job={job} /><Header site={site} embed={embed} /><main className="min-h-screen bg-[#f4f1ea] px-5 py-10 text-stone-950 sm:py-16"><div className="mx-auto max-w-6xl"><a href={`${listingPath}${embed ? "?embed=1" : ""}`} onClick={onClose ? (event) => { event.preventDefault(); onClose() } : undefined} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-950"><ArrowLeftIcon className="size-4" /> All open roles</a><div className="mt-8 grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start"><article><p className="text-xs font-bold tracking-[.2em] text-stone-500 uppercase">{job.department || "Open role"}</p><h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{job.title}</h1><div className="mt-4 flex flex-wrap gap-2 text-sm">{[job.location, job.employmentType, job.workplaceType].filter(Boolean).map((item) => <span key={item} className="rounded-full border border-black/10 bg-white px-3 py-1.5 capitalize">{item}</span>)}{salary && <span className="rounded-full bg-stone-950 px-3 py-1.5 font-semibold text-white">{salary}</span>}</div>{deadline && <p className={`mt-4 flex items-center gap-2 text-sm ${job.deadlineClosed ? "font-semibold text-red-700" : "text-stone-600"}`}><CalendarDaysIcon className="size-4" />{job.deadlineClosed ? `Applications closed on ${deadline}` : `Apply by ${deadline}`}</p>}<div className="mt-8 space-y-8"><section><h2 className="font-display text-2xl font-semibold">About the Role</h2><div className="careers-copy mt-3 whitespace-pre-line text-[15px] leading-7 text-stone-700">{job.description || "Role details will be shared during the hiring process."}</div></section>{job.requirements && <section><h2 className="font-display text-2xl font-semibold">What You’ll Bring</h2><div className="careers-copy mt-3 whitespace-pre-line text-[15px] leading-7 text-stone-700">{job.requirements}</div></section>}</div></article><aside className="lg:sticky lg:top-6">{job.deadlineClosed || !job.acceptingApplications ? <div className="rounded-3xl border border-black/10 bg-white p-8 text-center"><CalendarDaysIcon className="mx-auto size-8 text-stone-400" /><h2 className="mt-4 font-display text-2xl font-semibold">Applications are closed</h2><p className="mt-2 text-sm leading-6 text-stone-600">This role remains visible for reference, but new applications are no longer accepted.</p><a href={listingPath} className="mt-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">Explore other roles <ArrowRightIcon className="size-4" /></a></div> : <ApplicationForm site={site} job={job} />}</aside></div></div></main><Footer site={site} /></>
}

function Footer({ site }: { site: CareersSite }) {
  return <footer className="border-t border-black/10 bg-stone-950 px-5 py-6 text-stone-300"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><p className="text-sm">© {new Date().getFullYear()} {site.organizationName}</p><div className="flex flex-wrap gap-4">{site.socialLinks.map((link) => <a key={link.url} className="text-sm hover:text-white" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}{site.privacyPolicyUrl && <a className="text-sm hover:text-white" href={site.privacyPolicyUrl} target="_blank" rel="noreferrer">Privacy</a>}</div></div></footer>
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
      setSite((siteResult as { careers: CareersSite }).careers)
      if ("job" in contentResult) setJob(contentResult.job)
      else setJobs(contentResult.items)
    }).catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Careers page unavailable")).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [tasks])
  useEffect(() => {
    const dark = widget.theme === "dark" || (widget.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("widget-theme-dark", dark)
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
      document.documentElement.classList.remove("widget-theme-dark")
    }
  }, [postWidgetMessage, widget])
  if (loading) return <Loading />
  if (error || !site) return <ErrorPage message={error || "The organization could not be found."} />
  if (jobSlug) return job ? <JobDetail site={site} job={job} embed={embed} onClose={widget.enabled ? () => postWidgetMessage("close") : undefined} /> : <ErrorPage message="This role could not be found." />
  return <CareersListing site={site} jobs={jobs} embed={embed} onNavigate={widget.enabled ? (path) => postWidgetMessage("navigate", { path }) : undefined} />
}
