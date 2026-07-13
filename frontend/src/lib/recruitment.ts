import { API_ORIGIN } from "@/lib/env"
import { getEmbedOrigin } from "@/lib/env"
import type { FieldType } from "@/components/forms/types"

const BASE = `${API_ORIGIN}/api/v1/recruitment`

export type JobStatus = "draft" | "open" | "paused" | "closed" | "archived"
export type ApplicationStatus = "active" | "hired" | "rejected" | "withdrawn" | "archived"
export type RankingStatus = "not_requested" | "queued" | "processing" | "succeeded" | "failed" | "manual_review"

export interface RecruitmentRubricCriterion {
  id: string
  name: string
  description: string
  weight: number
  required: boolean
}

export interface RecruitmentRubric {
  _id: string
  jobId: string
  version: number
  status: "draft" | "approved" | "superseded"
  criteria: RecruitmentRubricCriterion[]
  instructions: string
  modelName: string
  promptVersion: string
  generatedAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RankingCriterionScore {
  criterionId: string
  score: number
  weight: number
  evidence: string[]
  rationale: string
}

export interface RankingResult {
  overallScore: number
  confidence: number
  criterionScores: RankingCriterionScore[]
  missingRequirements: string[]
  rationale: string
  model: string
  promptVersion: string
  rubricVersion: number
  rubricId: string
  rankedAt: string
}

export interface ApplicationRanking {
  status: RankingStatus
  queueJobId?: string
  inputRevision?: number
  rubricVersion?: number
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  retryAt?: string
  error?: string | null
  result?: RankingResult | null
}

export interface RankingJob {
  _id: string
  status: Exclude<RankingStatus, "not_requested">
  provider: string | null
  inputRevision: number | null
  rubricVersion: number | null
  batchId: string | null
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
}

export interface RankingBatch {
  batchId: string
  total: number
  queued?: number
  completed?: number
  byStatus?: Partial<Record<Exclude<RankingStatus, "not_requested">, number>>
}

export interface AcknowledgementDelivery {
  _id: string
  applicationRevision: number
  recipient: string
  status: "queued" | "sending" | "sent" | "failed"
  attempts: number
  error: string | null
  queuedAt: string
  sentAt: string | null
  failedAt: string | null
  updatedAt: string
}

export interface RecruitmentStage {
  id: string
  name: string
  order: number
  color: string | null
  isTerminal: boolean
  terminalOutcome: "hired" | "rejected" | null
}

export interface RecruitmentJob {
  _id: string
  title: string
  department: string
  location: string
  employmentType: string
  workplaceType: "onsite" | "hybrid" | "remote" | null
  description: string
  requirements: string
  status: JobStatus
  stages: RecruitmentStage[]
  openings: number
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  salaryVisible: boolean
  publicSlug: string | null
  seoTitle: string
  seoDescription: string
  socialShareText: string
  publicApplicationForm: RecruitmentApplicationForm
  applicationDeadline: string | null
  publishedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RecruitmentVisibilityCondition {
  fieldId: string
  operator: "equals" | "not_equals"
  value: string | number | boolean
}

export interface RecruitmentApplicationField {
  id: string
  label: string
  type: FieldType
  required: boolean
  description: string | null
  placeholder: string | null
  options: string[]
  maxFileSizeMb: number
  allowedMimeTypes: string[]
  multiple: boolean
  visibilityCondition: RecruitmentVisibilityCondition | null
}

export interface RecruitmentApplicationForm {
  schemaVersion: 1
  fields: RecruitmentApplicationField[]
}

export interface RecruitmentSettings {
  organizationPath: string | null
  headline: string
  intro: string
  seoTitle: string
  seoDescription: string
  socialShareText: string
  bannerUrl: string | null
  banner: {
    key: string
    bucket: string
    originalName: string
    contentType: string
    size: number
    url: string | null
    uploadedAt: string
  } | null
  socialLinks: Array<{ label: string; url: string }>
  privacyPolicyUrl: string | null
  inheritOrganizationBranding: boolean
  branding: { primaryColor: string; logoUrl: string | null }
  consent: { version: string; text: string }
  publicCareersEnabled: boolean
}

export interface Candidate {
  _id: string
  fullName: string
  email: string
  phone: string
  location: string
  headline: string
  currentCompany: string
  skills: string[]
  tags: string[]
  source: string
  createdAt: string
  updatedAt: string
}

export interface Application {
  _id: string
  jobId: RecruitmentJob | string
  candidateId: Candidate | string
  stageId: string
  status: ApplicationStatus
  source: string
  ranking: ApplicationRanking
  answers: Record<string, unknown>
  formSchemaSnapshot: RecruitmentApplicationForm
  appliedAt: string
  lastStageChangedAt: string
  updatedAt: string
}

export interface Activity {
  _id: string
  type: string
  actorName: string
  message: string
  createdAt: string
}

export interface Note {
  _id: string
  body: string
  authorName: string
  visibility: "internal"
  createdAt: string
}

export interface Attachment {
  _id: string
  originalName: string
  contentType: string
  size: number
  kind: "resume" | "cover_letter" | "portfolio" | "other"
  isPrivate: true
  createdAt: string
}

export interface RecruitmentDashboard {
  periodDays: number
  summary: {
    openJobs: number
    totalApplications: number
    activeApplications: number
    newApplications: number
    newCandidates: number
    hires: number
  }
  applicationsByStage: Array<{
    jobId: string
    jobTitle: string
    stageId: string
    stageName: string
    stageOrder: number | null
    count: number
    averageCurrentStageAgeDays: number | null
  }>
  applicationsByJob: Array<{ jobId: string; jobTitle: string; count: number }>
  applicationsBySource: Array<{ source: string; count: number }>
  conversionFunnel: Array<{
    jobId: string
    jobTitle: string
    totalApplications: number
    stages: Array<{
      stageId: string
      stageName: string
      order: number
      terminalOutcome: "hired" | "rejected" | null
      reached: number
      conversionRate: number
    }>
  }>
  aging: {
    averageApplicationAgeDays: number | null
    averageCurrentStageAgeDays: number | null
    oldestApplicationAgeDays: number | null
    oldestCurrentStageAgeDays: number | null
    byStage: Array<{
      jobId: string
      jobTitle: string
      stageId: string
      stageName: string
      averageCurrentStageAgeDays: number | null
      currentApplications: number
    }>
  }
  ranking: {
    byStatus: Partial<Record<Exclude<RankingStatus, "not_requested">, number>>
    queued: number
    processing: number
    backlog: number
    failures: number
    manualReview: number
  }
  recentActivity: Activity[]
}

export interface EmployeeHandoff {
  applicationId: string
  candidateId: string
  jobId: string
  jobTitle: string
  prefill: {
    fullName: string
    email: string
    phone: string | null
    title: string | null
    employeeCode: string | null
    profileImageUrl: string | null
    startDate: string | null
    status: "active"
    socials: { linkedinUrl: string | null; instagramUrl: string | null }
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    platformAccess: { enabled: false; allowedModules: []; restrictedModules: [] }
    teamId: null
  }
  employeeEmailConflict:
    | { exists: false }
    | { exists: true; employeeId: string; email: string; fullName: string; status: string }
}

export interface RecruitmentDeletionResult {
  deleted: Record<string, number>
  storage: { requested: number; deleted: number; failed: number; failedAttachmentIds: string[] }
  candidate?: { id: string; retained: true; remainingApplications: number }
  retainedJobRubrics?: true
}

export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? "Recruitment request failed")
  return data as T
}

function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value))
  })
  const result = query.toString()
  return result ? `?${result}` : ""
}

export const recruitmentApi = {
  settings: () => request<{ settings: RecruitmentSettings }>("/settings"),
  updateSettings: (body: Partial<RecruitmentSettings>) =>
    request<{ settings: RecruitmentSettings }>("/settings", { method: "PUT", body: JSON.stringify(body) }),
  uploadBanner: async (file: File) => {
    const fileData = { fileName: file.name, originalName: file.name, contentType: file.type, size: file.size }
    const presign = await request<{
      uploadUrl?: string
      url?: string
      key?: string
      file?: { key?: string }
      headers?: Record<string, string>
    }>(
      "/settings/banner/presign",
      { method: "POST", body: JSON.stringify(fileData) }
    )
    const uploadUrl = presign.uploadUrl ?? presign.url
    const key = presign.file?.key ?? presign.key
    if (!uploadUrl || !key) throw new Error("Banner upload preparation was incomplete")
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: presign.headers, body: file })
    if (!uploaded.ok) throw new Error("Banner image could not be uploaded")
    return request<{ settings: RecruitmentSettings }>("/settings/banner", {
      method: "POST",
      body: JSON.stringify({ ...fileData, key }),
    })
  },
  dashboard: () => request<RecruitmentDashboard>("/dashboard"),
  jobs: (params: { search?: string; status?: string; page?: number } = {}) =>
    request<Page<RecruitmentJob>>(`/jobs${queryString({ ...params, limit: 50 })}`),
  job: (id: string) =>
    request<{ job: RecruitmentJob; stageCounts: Array<{ _id: string; count: number }>; recentActivity: Activity[] }>(`/jobs/${id}`),
  pipeline: (id: string) =>
    request<{ job: RecruitmentJob; applications: Application[]; byStage: Record<string, Application[]> }>(`/jobs/${id}/pipeline`),
  createJob: (body: Partial<RecruitmentJob>) =>
    request<{ job: RecruitmentJob }>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  updateJob: (id: string, body: Partial<RecruitmentJob>) =>
    request<{ job: RecruitmentJob }>(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  rubrics: (jobId: string) =>
    request<{ items: RecruitmentRubric[]; draft: RecruitmentRubric | null; approved: RecruitmentRubric | null }>(`/jobs/${jobId}/rubrics`),
  generateRubric: (jobId: string) =>
    request<{ rubric: RecruitmentRubric }>(`/jobs/${jobId}/rubrics/generate`, { method: "POST" }),
  regenerateRubric: (jobId: string) =>
    request<{ rubric: RecruitmentRubric; batch: RankingBatch | null }>(`/jobs/${jobId}/rubrics/regenerate`, {
      method: "POST",
      body: JSON.stringify({ approveAndEnqueueActiveApplications: false }),
    }),
  updateRubric: (jobId: string, rubricId: string, body: Pick<RecruitmentRubric, "criteria" | "instructions">) =>
    request<{ rubric: RecruitmentRubric }>(`/jobs/${jobId}/rubrics/${rubricId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  approveRubric: (jobId: string, rubricId: string, enqueueActiveApplications: boolean) =>
    request<{ rubric: RecruitmentRubric; batch: RankingBatch | null }>(`/jobs/${jobId}/rubrics/${rubricId}/approve`, {
      method: "POST",
      body: JSON.stringify({ enqueueActiveApplications }),
    }),
  rerankAll: (jobId: string) =>
    request<RankingBatch>(`/jobs/${jobId}/rerank-all`, { method: "POST" }),
  rankingBatch: (batchId: string) =>
    request<RankingBatch>(`/ranking-batches/${encodeURIComponent(batchId)}`),
  changeJobStatus: (id: string, status: JobStatus) =>
    request<{ job: RecruitmentJob }>(`/jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  applications: (params: { jobId?: string; stageId?: string; status?: string; page?: number } = {}) =>
    request<Page<Application>>(`/applications${queryString({ ...params, limit: 100 })}`),
  application: (id: string) =>
    request<{ application: Application; activity: Activity[]; notes: Note[]; attachments: Attachment[]; acknowledgements: AcknowledgementDelivery[] }>(`/applications/${id}`),
  employeeHandoff: (id: string) =>
    request<EmployeeHandoff>(`/applications/${id}/employee-handoff`),
  deleteApplication: (id: string) =>
    request<RecruitmentDeletionResult>(`/applications/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE_APPLICATION" }),
    }),
  deleteCandidate: (id: string) =>
    request<RecruitmentDeletionResult>(`/candidates/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE_CANDIDATE" }),
    }),
  applicationRanking: (id: string) =>
    request<{ ranking: ApplicationRanking; revision: number; jobs: RankingJob[] }>(`/applications/${id}/ranking`),
  retryApplicationRanking: (id: string) =>
    request<{ job: RankingJob }>(`/applications/${id}/ranking/retry`, { method: "POST" }),
  rerankApplication: (id: string) =>
    request<{ job: RankingJob }>(`/applications/${id}/ranking/rerank`, { method: "POST" }),
  moveApplication: (id: string, stageId: string, pipelineOrder?: number) =>
    request<{ application: Application }>(`/applications/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stageId, pipelineOrder }),
    }),
  addNote: (id: string, body: string) =>
    request<{ note: Note }>(`/applications/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  openAttachment: async (applicationId: string, attachmentId: string) => {
    const data = await request<{ url?: string; viewUrl?: string }>(`/applications/${applicationId}/attachments/${attachmentId}/view`)
    const url = data.url ?? data.viewUrl
    if (!url) throw new Error("Attachment URL unavailable")
    window.open(url, "_blank", "noopener,noreferrer")
  },
  uploadAttachment: async (applicationId: string, file: File, kind: Attachment["kind"]) => {
    const contentType = inferAttachmentMimeType(file)
    if (!contentType) throw new Error("Choose a PDF, DOC, DOCX, TXT, JPG, or PNG file")
    if (file.size <= 0 || file.size > 15 * 1024 * 1024) throw new Error("Attachment must be 15MB or smaller")
    const presign = await request<{ uploadUrl?: string; url?: string; key?: string; headers?: Record<string, string>; file?: { key?: string } }>(
      `/applications/${applicationId}/attachments/presign`,
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType, size: file.size }) }
    )
    const uploadUrl = presign.uploadUrl ?? presign.url
    const key = presign.key ?? presign.file?.key
    if (!uploadUrl || !key) throw new Error("Upload preparation was incomplete")
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: presign.headers, body: file })
    if (!uploaded.ok) throw new Error(`Failed to upload ${file.name}`)
    return request<{ attachment: Attachment }>(`/applications/${applicationId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ key, fileName: file.name, originalName: file.name, contentType, size: file.size, kind }),
    })
  },
}

export function careersUrl(organizationPath: string, jobSlug?: string | null, embed = false) {
  const suffix = jobSlug ? `/jobs/${jobSlug}` : ""
  return `${getEmbedOrigin()}/careers/${organizationPath}${suffix}${embed ? "?embed=1" : ""}`
}

const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
}

export function inferAttachmentMimeType(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().split(".").pop() ?? ""
  const inferred = ATTACHMENT_MIME_BY_EXTENSION[extension]
  if (!inferred) return null
  return !file.type || file.type === "application/octet-stream" || file.type === inferred ? inferred : null
}

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["open", "archived"],
  open: ["paused", "closed"],
  paused: ["open", "closed", "archived"],
  closed: ["open", "archived"],
  archived: [],
}

export function entity<T>(value: T | string): T | null {
  return typeof value === "string" ? null : value
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}
