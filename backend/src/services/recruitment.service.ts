import mongoose, { type Types } from "mongoose";
import {
  DEFAULT_RECRUITMENT_STAGES,
  RecruitmentSettings,
  type IRecruitmentStage,
} from "../models/recruitment-settings.model";
import {
  RECRUITMENT_JOB_STATUSES,
  RecruitmentJob,
  type RecruitmentJobStatus,
} from "../models/recruitment-job.model";
import { RecruitmentCandidate } from "../models/recruitment-candidate.model";
import {
  RecruitmentApplication,
  type IRecruitmentApplication,
  type RecruitmentApplicationStatus,
} from "../models/recruitment-application.model";
import { RecruitmentApplicationRevision } from "../models/recruitment-application-revision.model";
import { RecruitmentActivity, type RecruitmentActivityType } from "../models/recruitment-activity.model";
import { RecruitmentNote } from "../models/recruitment-note.model";
import { RecruitmentAttachment } from "../models/recruitment-attachment.model";
import { RecruitmentRankingJob } from "../models/recruitment-ranking-job.model";
import { RecruitmentAcknowledgementDelivery } from "../models/recruitment-acknowledgement-delivery.model";
import { Employee } from "../models/employee.model";
import {
  createPresignedUpload,
  createPresignedViewUrl,
  deleteObject,
  fileUrlForKey,
  getObjectMetadata,
  keyBelongsToPrefix,
  storageBucket,
} from "./storage.service";
import {
  normalizeRecruitmentForm,
  validateRecruitmentAnswers,
} from "./recruitment-form.service";
import {
  BRANDING_ALLOWED_MIME_TYPES,
  BRANDING_MAX_FILE_SIZE,
} from "../config/upload-constraints.config";
import {
  enqueueApplicationRanking,
  ensureRubricDraft,
} from "./recruitment-ranking.service";

type OrganizationId = Types.ObjectId;

export interface RecruitmentActor {
  userId: string;
  name: string;
}

export class RecruitmentServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "RecruitmentServiceError";
  }
}

const text = (value: unknown) => String(value ?? "").trim();
const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function optionalUrl(value: unknown, label: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new RecruitmentServiceError(`${label} must be a valid HTTP URL`);
  }
  return raw.slice(0, 2000);
}

function organizationPath(value: unknown): string | null {
  const slug = text(value).toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{1,70}[a-z0-9])?$/.test(slug)) {
    throw new RecruitmentServiceError(
      "Organization path must be 3-72 lowercase letters, numbers, or hyphens"
    );
  }
  return slug;
}

function publicSlug(value: unknown): string | null {
  const slug = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || null;
}

function objectId(value: unknown, label: string): Types.ObjectId {
  const raw = text(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw new RecruitmentServiceError(`${label} is invalid`);
  }
  return new mongoose.Types.ObjectId(raw);
}

function normalizeStages(value: unknown): IRecruitmentStage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RecruitmentServiceError("At least one recruitment stage is required");
  }
  const seen = new Set<string>();
  const stages: IRecruitmentStage[] = value.map((item, order) => {
    const raw = objectValue(item);
    const id = text(raw.id).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 80);
    const name = text(raw.name).slice(0, 80);
    if (!id || !name || seen.has(id)) {
      throw new RecruitmentServiceError("Stages require unique ids and names");
    }
    seen.add(id);
    const terminalOutcome: "hired" | "rejected" | null =
      raw.terminalOutcome === "hired" || raw.terminalOutcome === "rejected"
        ? raw.terminalOutcome
        : null;
    return {
      id,
      name,
      order,
      color: text(raw.color) || null,
      isTerminal: Boolean(raw.isTerminal || terminalOutcome),
      terminalOutcome,
    };
  });
  if (stages.every((stage) => stage.isTerminal)) {
    throw new RecruitmentServiceError("At least one active stage is required");
  }
  return stages;
}

export async function getRecruitmentSettings(organizationId: OrganizationId) {
  return RecruitmentSettings.findOneAndUpdate(
    { organizationId },
    {
      $setOnInsert: {
        organizationId,
        defaultStages: DEFAULT_RECRUITMENT_STAGES,
        defaultApplicationForm: { fields: [] },
        publicCareersEnabled: false,
        organizationPath: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function updateRecruitmentSettings(
  organizationId: OrganizationId,
  body: Record<string, unknown>
) {
  await getRecruitmentSettings(organizationId);
  const update: Record<string, unknown> = {};
  if ("defaultStages" in body) update.defaultStages = normalizeStages(body.defaultStages);
  if ("defaultApplicationForm" in body) {
    update.defaultApplicationForm = normalizeRecruitmentForm(body.defaultApplicationForm);
  }
  if ("publicCareersEnabled" in body) update.publicCareersEnabled = Boolean(body.publicCareersEnabled);
  if ("organizationPath" in body) update.organizationPath = organizationPath(body.organizationPath);
  if ("headline" in body) update.headline = text(body.headline).slice(0, 240);
  if ("intro" in body) update.intro = text(body.intro).slice(0, 5000);
  if ("seoTitle" in body) update.seoTitle = text(body.seoTitle).slice(0, 120);
  if ("seoDescription" in body) update.seoDescription = text(body.seoDescription).slice(0, 320);
  if ("socialShareText" in body) {
    update.socialShareText = text(body.socialShareText).slice(0, 500);
  }
  if ("bannerUrl" in body) {
    if (text(body.bannerUrl)) {
      throw new RecruitmentServiceError("Use the careers banner upload endpoint");
    }
    update.bannerUrl = null;
    update.banner = null;
  }
  if ("privacyPolicyUrl" in body) {
    update.privacyPolicyUrl = optionalUrl(body.privacyPolicyUrl, "Privacy policy URL");
  }
  if ("inheritOrganizationBranding" in body) {
    update.inheritOrganizationBranding = Boolean(body.inheritOrganizationBranding);
  }
  if ("branding" in body) {
    const branding = objectValue(body.branding);
    update.branding = {
      primaryColor: text(branding.primaryColor).slice(0, 32) || "#f5b400",
      logoUrl: optionalUrl(branding.logoUrl, "Brand logo URL"),
    };
  }
  if ("socialLinks" in body) {
    if (!Array.isArray(body.socialLinks)) {
      throw new RecruitmentServiceError("Social links must be a list");
    }
    update.socialLinks = body.socialLinks.slice(0, 20).map((item) => {
      const link = objectValue(item);
      const label = text(link.label).slice(0, 80);
      const url = optionalUrl(link.url, "Social link URL");
      if (!label || !url) throw new RecruitmentServiceError("Social links require a label and URL");
      return { label, url };
    });
  }
  if ("consent" in body) {
    const consent = objectValue(body.consent);
    const version = text(consent.version).slice(0, 80);
    const consentText = text(consent.text).slice(0, 5000);
    if ((version && !consentText) || (!version && consentText)) {
      throw new RecruitmentServiceError("Consent version and text must be configured together");
    }
    update.consent = { version, text: consentText };
  }
  if (Boolean(update.publicCareersEnabled ?? (await getRecruitmentSettings(organizationId)).publicCareersEnabled)) {
    const current = await RecruitmentSettings.findOne({ organizationId }).lean();
    const effectivePath = (update.organizationPath ?? current?.organizationPath) as string | null;
    const effectiveConsent = (update.consent ?? current?.consent) as { version?: string; text?: string } | undefined;
    if (!effectivePath) throw new RecruitmentServiceError("Organization path is required to publish careers");
    if (!effectiveConsent?.version || !effectiveConsent.text) {
      throw new RecruitmentServiceError("Versioned candidate consent is required to publish careers");
    }
  }
  try {
    return await RecruitmentSettings.findOneAndUpdate(
      { organizationId },
      { $set: update },
      { new: true, runValidators: true }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new RecruitmentServiceError("This organization path is already in use", 409);
    }
    throw error;
  }
}

function careersBannerInput(body: Record<string, unknown>) {
  const fileName = text(body.fileName || body.originalName).slice(0, 200);
  const contentType = text(body.contentType).toLowerCase();
  const size = Number(body.size);
  if (!fileName || !BRANDING_ALLOWED_MIME_TYPES.includes(contentType as any)) {
    throw new RecruitmentServiceError("Banner must be a JPG, PNG, WebP, or SVG image");
  }
  if (!Number.isFinite(size) || size <= 0 || size > BRANDING_MAX_FILE_SIZE) {
    throw new RecruitmentServiceError("Banner must be 2MB or smaller");
  }
  return { fileName, contentType, size };
}

export async function presignRecruitmentBanner(
  organizationId: OrganizationId,
  body: Record<string, unknown>
) {
  const file = careersBannerInput(body);
  return createPresignedUpload({
    scope: "branding",
    organizationId: organizationId.toString(),
    prefixParts: ["careers", "banner"],
    ...file,
  });
}

export async function saveRecruitmentBanner(
  organizationId: OrganizationId,
  body: Record<string, unknown>
) {
  const file = careersBannerInput(body);
  const key = text(body.key);
  if (!keyBelongsToPrefix(key, [
    "branding",
    organizationId.toString(),
    "careers",
    "banner",
  ])) {
    throw new RecruitmentServiceError("Banner key is invalid");
  }
  let stored: { contentType: string; size: number };
  try {
    stored = await getObjectMetadata(key);
  } catch {
    throw new RecruitmentServiceError("Banner upload could not be verified");
  }
  if (stored.contentType !== file.contentType || stored.size !== file.size) {
    throw new RecruitmentServiceError("Banner metadata does not match the uploaded image");
  }
  const banner = {
    key,
    bucket: storageBucket(),
    originalName: file.fileName,
    contentType: file.contentType,
    size: file.size,
    url: fileUrlForKey(key),
    uploadedAt: new Date(),
  };
  const settings = await RecruitmentSettings.findOneAndUpdate(
    { organizationId },
    {
      $set: { banner, bannerUrl: banner.url },
      $setOnInsert: {
        organizationId,
        defaultStages: DEFAULT_RECRUITMENT_STAGES,
        defaultApplicationForm: { fields: [] },
        publicCareersEnabled: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  return settings;
}

async function activity(input: {
  organizationId: OrganizationId;
  actor: RecruitmentActor;
  type: RecruitmentActivityType;
  message: string;
  jobId?: Types.ObjectId;
  candidateId?: Types.ObjectId;
  applicationId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
}) {
  return RecruitmentActivity.create({
    organizationId: input.organizationId,
    actorUserId: input.actor.userId,
    actorName: input.actor.name,
    type: input.type,
    message: input.message,
    jobId: input.jobId ?? null,
    candidateId: input.candidateId ?? null,
    applicationId: input.applicationId ?? null,
    metadata: input.metadata ?? {},
  });
}

function jobFields(body: Record<string, unknown>) {
  const workplaceType = text(body.workplaceType) || null;
  if (workplaceType && !["onsite", "hybrid", "remote"].includes(workplaceType)) {
    throw new RecruitmentServiceError("Workplace type is invalid");
  }
  const openings = Math.min(10000, Math.max(1, Number(body.openings) || 1));
  const applicationDeadline = text(body.applicationDeadline)
    ? new Date(text(body.applicationDeadline))
    : null;
  if (applicationDeadline && Number.isNaN(applicationDeadline.getTime())) {
    throw new RecruitmentServiceError("Application deadline is invalid");
  }
  const salaryMin =
    body.salaryMin === null || text(body.salaryMin) === "" ? null : Number(body.salaryMin);
  const salaryMax =
    body.salaryMax === null || text(body.salaryMax) === "" ? null : Number(body.salaryMax);
  if (
    (salaryMin !== null && (!Number.isFinite(salaryMin) || salaryMin < 0)) ||
    (salaryMax !== null && (!Number.isFinite(salaryMax) || salaryMax < 0))
  ) {
    throw new RecruitmentServiceError("Salary values must be positive numbers");
  }
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
    throw new RecruitmentServiceError("Maximum salary cannot be lower than minimum salary");
  }
  const salaryCurrency = (text(body.salaryCurrency) || "INR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(salaryCurrency)) {
    throw new RecruitmentServiceError("Salary currency must be a 3-letter currency code");
  }
  const salaryPeriod = text(body.salaryPeriod) || "year";
  if (!["hour", "month", "year"].includes(salaryPeriod)) {
    throw new RecruitmentServiceError("Salary period is invalid");
  }
  return {
    title: text(body.title),
    department: text(body.department),
    location: text(body.location),
    employmentType: text(body.employmentType),
    workplaceType: workplaceType as "onsite" | "hybrid" | "remote" | null,
    description: text(body.description),
    requirements: text(body.requirements),
    openings,
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryPeriod: salaryPeriod as "hour" | "month" | "year",
    salaryVisible: Boolean(body.salaryVisible),
    hiringManagerIds: Array.isArray(body.hiringManagerIds)
      ? body.hiringManagerIds.map((id) => objectId(id, "Hiring manager id"))
      : [],
    publicApplicationForm: normalizeRecruitmentForm(body.publicApplicationForm),
    aiConfiguration: objectValue(body.aiConfiguration),
    applicationDeadline,
    publicSlug: publicSlug(body.publicSlug),
    seoTitle: text(body.seoTitle).slice(0, 120),
    seoDescription: text(body.seoDescription).slice(0, 320),
    socialShareText: text(body.socialShareText).slice(0, 500),
  };
}

export async function createRecruitmentJob(
  organizationId: OrganizationId,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const fields = jobFields(body);
  if (!fields.title) throw new RecruitmentServiceError("Job title is required");
  const settings = await getRecruitmentSettings(organizationId);
  const job = await RecruitmentJob.create({
    organizationId,
    ...fields,
    stages: "stages" in body ? normalizeStages(body.stages) : settings.defaultStages,
    publicApplicationForm:
      "publicApplicationForm" in body
        ? fields.publicApplicationForm
        : normalizeRecruitmentForm(settings.defaultApplicationForm),
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
  });
  await activity({
    organizationId,
    actor,
    type: "job_created",
    jobId: job._id,
    message: `Created job ${job.title}`,
  });
  return job;
}

async function findJob(organizationId: OrganizationId, id: unknown) {
  const job = await RecruitmentJob.findOne({ _id: objectId(id, "Job id"), organizationId });
  if (!job) throw new RecruitmentServiceError("Job not found", 404);
  return job;
}

export async function updateRecruitmentJob(
  organizationId: OrganizationId,
  id: unknown,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const job = await findJob(organizationId, id);
  if (job.status === "archived") throw new RecruitmentServiceError("Archived jobs cannot be edited", 409);
  const fields = jobFields({ ...job.toObject(), ...body });
  if (!fields.title) throw new RecruitmentServiceError("Job title is required");
  job.set(fields);
  if ("stages" in body) {
    const stages = normalizeStages(body.stages);
    const used = await RecruitmentApplication.distinct("stageId", { organizationId, jobId: job._id });
    const available = new Set(stages.map((stage) => stage.id));
    if (used.some((stage) => !available.has(stage))) {
      throw new RecruitmentServiceError("Stages containing applications cannot be removed", 409);
    }
    job.stages = stages;
  }
  job.updatedByUserId = actor.userId;
  if (job.status === "open" && !job.publicSlug) {
    job.publicSlug = `${publicSlug(job.title) || "job"}-${job._id.toString().slice(-6)}`;
  }
  await job.save();
  await activity({
    organizationId,
    actor,
    type: "job_updated",
    jobId: job._id,
    message: `Updated job ${job.title}`,
  });
  return job;
}

const transitions: Record<RecruitmentJobStatus, RecruitmentJobStatus[]> = {
  draft: ["open", "archived"],
  open: ["paused", "closed"],
  paused: ["open", "closed", "archived"],
  closed: ["open", "archived"],
  archived: [],
};

export async function changeRecruitmentJobStatus(
  organizationId: OrganizationId,
  id: unknown,
  statusValue: unknown,
  actor: RecruitmentActor
) {
  const job = await findJob(organizationId, id);
  const status = text(statusValue) as RecruitmentJobStatus;
  if (!RECRUITMENT_JOB_STATUSES.includes(status) || !transitions[job.status].includes(status)) {
    throw new RecruitmentServiceError(`Cannot change job from ${job.status} to ${status || "unknown"}`, 409);
  }
  const previous = job.status;
  if (status === "open") {
    await ensureRubricDraft(organizationId, job._id, actor);
  }
  job.status = status;
  job.updatedByUserId = actor.userId;
  if (status === "open") {
    job.publicSlug ??= `${publicSlug(job.title) || "job"}-${job._id.toString().slice(-6)}`;
    job.publishedAt ??= new Date();
    job.closedAt = null;
  }
  if (status === "closed") job.closedAt = new Date();
  if (status === "archived") job.archivedAt = new Date();
  await job.save();
  await activity({
    organizationId,
    actor,
    type: "job_status_changed",
    jobId: job._id,
    message: `Changed job status from ${previous} to ${status}`,
    metadata: { previous, status },
  });
  return job;
}

export async function deleteRecruitmentJob(organizationId: OrganizationId, id: unknown) {
  const job = await findJob(organizationId, id);
  if (job.status !== "draft") throw new RecruitmentServiceError("Only draft jobs can be deleted", 409);
  if (await RecruitmentApplication.exists({ organizationId, jobId: job._id })) {
    throw new RecruitmentServiceError("Jobs with applications cannot be deleted", 409);
  }
  await job.deleteOne();
}

export async function createCandidate(
  organizationId: OrganizationId,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const fullName = text(body.fullName);
  const email = text(body.email).toLowerCase();
  if (!fullName || !email) throw new RecruitmentServiceError("Candidate name and email are required");
  try {
    return await RecruitmentCandidate.create({
      organizationId,
      fullName,
      email,
      phone: text(body.phone),
      location: text(body.location),
      headline: text(body.headline),
      currentCompany: text(body.currentCompany),
      links: Array.isArray(body.links) ? body.links : [],
      skills: Array.isArray(body.skills) ? body.skills.map(text).filter(Boolean) : [],
      tags: Array.isArray(body.tags) ? body.tags.map(text).filter(Boolean) : [],
      source: text(body.source) || "manual",
      consent: objectValue(body.consent),
      metadata: objectValue(body.metadata),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new RecruitmentServiceError("A candidate with this email already exists", 409);
    }
    throw error;
  }
}

async function revision(
  application: IRecruitmentApplication,
  reason: string,
  actor: RecruitmentActor
) {
  await RecruitmentApplicationRevision.create({
    organizationId: application.organizationId,
    applicationId: application._id,
    revision: application.revision,
    reason,
    actorUserId: actor.userId,
    snapshot: application.toObject({ depopulate: true }) as unknown as Record<string, unknown>,
  });
}

export async function createApplication(
  organizationId: OrganizationId,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const job = await findJob(organizationId, body.jobId);
  const candidateId = objectId(body.candidateId, "Candidate id");
  const candidate = await RecruitmentCandidate.findOne({ _id: candidateId, organizationId });
  if (!candidate) throw new RecruitmentServiceError("Candidate not found", 404);
  const firstStage = [...job.stages].sort((a, b) => a.order - b.order).find((stage) => !stage.isTerminal);
  if (!firstStage) throw new RecruitmentServiceError("Job has no active pipeline stage", 409);
  const formSchemaSnapshot = normalizeRecruitmentForm(job.publicApplicationForm);
  const answers = validateRecruitmentAnswers(formSchemaSnapshot, body.answers);
  try {
    const application = await RecruitmentApplication.create({
      organizationId,
      jobId: job._id,
      candidateId,
      stageId: firstStage.id,
      source: text(body.source) || candidate.source,
      answers,
      formSchemaSnapshot,
      pipelineOrder: Date.now(),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    });
    await revision(application, "created", actor);
    await activity({
      organizationId,
      actor,
      type: "application_created",
      jobId: job._id,
      candidateId,
      applicationId: application._id,
      message: `Added ${candidate.fullName} to ${job.title}`,
    });
    await enqueueApplicationRanking({
      organizationId,
      jobId: job._id,
      applicationId: application._id,
      inputRevision: application.revision,
      requestedByUserId: actor.userId,
    });
    return application;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new RecruitmentServiceError("Candidate already has an application for this job", 409);
    }
    throw error;
  }
}

async function findApplication(organizationId: OrganizationId, id: unknown) {
  const application = await RecruitmentApplication.findOne({
    _id: objectId(id, "Application id"),
    organizationId,
  });
  if (!application) throw new RecruitmentServiceError("Application not found", 404);
  return application;
}

export async function moveApplicationStage(
  organizationId: OrganizationId,
  id: unknown,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const application = await findApplication(organizationId, id);
  const job = await findJob(organizationId, application.jobId);
  const stageId = text(body.stageId);
  const stage = job.stages.find((item) => item.id === stageId);
  if (!stage) throw new RecruitmentServiceError("Pipeline stage is invalid");
  if (application.stageId === stageId) return application;
  const previous = application.stageId;
  application.stageId = stageId;
  application.status = (stage.terminalOutcome ?? "active") as RecruitmentApplicationStatus;
  application.pipelineOrder = Number.isFinite(Number(body.pipelineOrder))
    ? Number(body.pipelineOrder)
    : Date.now();
  application.lastStageChangedAt = new Date();
  application.updatedByUserId = actor.userId;
  application.revision += 1;
  await application.save();
  await revision(application, "stage_changed", actor);
  await activity({
    organizationId,
    actor,
    type: "application_stage_changed",
    jobId: application.jobId,
    candidateId: application.candidateId,
    applicationId: application._id,
    message: `Moved application from ${previous} to ${stageId}`,
    metadata: { previous, stageId },
  });
  return application;
}

export async function addApplicationNote(
  organizationId: OrganizationId,
  id: unknown,
  bodyValue: unknown,
  actor: RecruitmentActor
) {
  const application = await findApplication(organizationId, id);
  const body = text(bodyValue);
  if (!body) throw new RecruitmentServiceError("Note body is required");
  const note = await RecruitmentNote.create({
    organizationId,
    applicationId: application._id,
    candidateId: application.candidateId,
    body,
    authorUserId: actor.userId,
    authorName: actor.name,
  });
  await activity({
    organizationId,
    actor,
    type: "note_added",
    jobId: application.jobId,
    candidateId: application.candidateId,
    applicationId: application._id,
    message: "Added an internal note",
    metadata: { noteId: note._id },
  });
  return note;
}

const mimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
];
const maxAttachmentSize = 15 * 1024 * 1024;

function attachmentInput(body: Record<string, unknown>) {
  const fileName = text(body.fileName || body.originalName);
  const contentType = text(body.contentType).toLowerCase();
  const size = Number(body.size);
  if (!fileName || !mimeTypes.includes(contentType) || !Number.isFinite(size) || size <= 0) {
    throw new RecruitmentServiceError("Attachment metadata is invalid");
  }
  if (size > maxAttachmentSize) throw new RecruitmentServiceError("Attachment must be 15MB or smaller");
  return { fileName, contentType, size };
}

export async function presignRecruitmentAttachment(
  organizationId: OrganizationId,
  id: unknown,
  body: Record<string, unknown>
) {
  const application = await findApplication(organizationId, id);
  const file = attachmentInput(body);
  return createPresignedUpload({
    scope: "recruitment",
    organizationId: organizationId.toString(),
    ...file,
    prefixParts: [application.candidateId.toString(), application._id.toString()],
  });
}

export async function saveRecruitmentAttachment(
  organizationId: OrganizationId,
  id: unknown,
  body: Record<string, unknown>,
  actor: RecruitmentActor
) {
  const application = await findApplication(organizationId, id);
  const file = attachmentInput(body);
  const key = text(body.key);
  if (!keyBelongsToPrefix(key, [
    "recruitment",
    organizationId.toString(),
    application.candidateId.toString(),
    application._id.toString(),
  ])) {
    throw new RecruitmentServiceError("Attachment key is invalid");
  }
  let stored: { contentType: string; size: number };
  try {
    stored = await getObjectMetadata(key);
  } catch {
    throw new RecruitmentServiceError("Attachment upload could not be verified");
  }
  if (stored.contentType !== file.contentType || stored.size !== file.size) {
    throw new RecruitmentServiceError("Attachment metadata does not match the uploaded file");
  }
  const rawKind = text(body.kind);
  const kind: "resume" | "cover_letter" | "portfolio" | "other" =
    rawKind === "resume" || rawKind === "cover_letter" || rawKind === "portfolio"
      ? rawKind
      : "other";
  const attachment = await RecruitmentAttachment.create({
    organizationId,
    candidateId: application.candidateId,
    applicationId: application._id,
    kind,
    key,
    bucket: storageBucket(),
    originalName: file.fileName,
    contentType: file.contentType,
    size: file.size,
    uploadedByUserId: actor.userId,
  });
  if (kind === "resume") {
    let beforeResumeAttachmentId = application.resumeAttachmentId;
    let replaced:
      | { resumeAttachmentId: Types.ObjectId | null }
      | null = null;
    for (let attempt = 0; attempt < 10 && !replaced; attempt += 1) {
      replaced = await RecruitmentApplication.findOneAndUpdate(
        {
          _id: application._id,
          organizationId,
          resumeAttachmentId: beforeResumeAttachmentId,
        },
        {
          $set: {
            resumeAttachmentId: attachment._id,
            updatedByUserId: actor.userId,
          },
        },
        { new: false }
      ).select("resumeAttachmentId");
      if (!replaced) {
        const refreshed = await RecruitmentApplication.findOne({
          _id: application._id,
          organizationId,
        }).select("resumeAttachmentId");
        if (!refreshed) {
          throw new RecruitmentServiceError("Application not found", 404);
        }
        beforeResumeAttachmentId = refreshed.resumeAttachmentId;
      }
    }
    if (!replaced) {
      throw new RecruitmentServiceError("Application is being updated; please retry", 409);
    }
    const previousResumeAttachmentId = replaced.resumeAttachmentId;
    if (
      previousResumeAttachmentId &&
      previousResumeAttachmentId.toString() !== attachment._id.toString() &&
      !(await RecruitmentApplication.exists({
        organizationId,
        resumeAttachmentId: previousResumeAttachmentId,
      }))
    ) {
      const previous = await RecruitmentAttachment.findOneAndDelete({
        _id: previousResumeAttachmentId,
        organizationId,
        applicationId: application._id,
        kind: "resume",
      })
        .select("key")
        .lean();
      if (previous) {
        try {
          await deleteObject(previous.key);
        } catch (error) {
          console.error("Failed to delete superseded recruitment resume object:", error);
        }
      }
    }
  }
  await activity({
    organizationId,
    actor,
    type: "attachment_added",
    jobId: application.jobId,
    candidateId: application.candidateId,
    applicationId: application._id,
    message: `Added attachment ${attachment.originalName}`,
    metadata: { attachmentId: attachment._id, kind },
  });
  return attachment;
}

export async function viewRecruitmentAttachment(
  organizationId: OrganizationId,
  applicationId: unknown,
  attachmentId: unknown,
  download: boolean
) {
  const application = await findApplication(organizationId, applicationId);
  const attachment = await RecruitmentAttachment.findOne({
    _id: objectId(attachmentId, "Attachment id"),
    organizationId,
    applicationId: application._id,
  }).lean();
  if (!attachment) throw new RecruitmentServiceError("Attachment not found", 404);
  return createPresignedViewUrl(
    attachment.key,
    download ? { downloadFileName: attachment.originalName } : {}
  );
}

function queryPage(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

function safeRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export async function listRecruitmentJobs(
  organizationId: OrganizationId,
  query: Record<string, unknown>
) {
  const paging = queryPage(query);
  const filter: Record<string, unknown> = { organizationId };
  const statuses = text(query.status)
    .split(",")
    .filter((status) => RECRUITMENT_JOB_STATUSES.includes(status as RecruitmentJobStatus));
  if (statuses.length) filter.status = { $in: statuses };
  const search = text(query.search);
  if (search) {
    const match = safeRegex(search);
    filter.$or = [{ title: match }, { department: match }, { location: match }];
  }
  const [jobs, total] = await Promise.all([
    RecruitmentJob.find(filter)
      .sort({ updatedAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    RecruitmentJob.countDocuments(filter),
  ]);
  const counts = jobs.length
    ? await RecruitmentApplication.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { organizationId, jobId: { $in: jobs.map((job) => job._id) } } },
        { $group: { _id: "$jobId", count: { $sum: 1 } } },
      ])
    : [];
  const countByJob = new Map(counts.map((item) => [item._id.toString(), item.count]));
  return {
    items: jobs.map((job) => ({
      ...job,
      applicationCount: countByJob.get(job._id.toString()) ?? 0,
    })),
    page: paging.page,
    limit: paging.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
}

export async function getRecruitmentJob(organizationId: OrganizationId, id: unknown) {
  const job = await findJob(organizationId, id);
  const [stageCounts, recentActivity] = await Promise.all([
    RecruitmentApplication.aggregate<{ _id: string; count: number }>([
      { $match: { organizationId, jobId: job._id } },
      { $group: { _id: "$stageId", count: { $sum: 1 } } },
    ]),
    RecruitmentActivity.find({ organizationId, jobId: job._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);
  return { job, stageCounts, recentActivity };
}

export async function getRecruitmentPipeline(
  organizationId: OrganizationId,
  jobId: unknown,
  includeArchived = false
) {
  const job = await findJob(organizationId, jobId);
  const applications = await RecruitmentApplication.find({
    organizationId,
    jobId: job._id,
    ...(includeArchived ? {} : { status: { $ne: "archived" } }),
  })
    .populate("candidateId")
    .sort({ stageId: 1, pipelineOrder: 1, appliedAt: 1 })
    .lean();
  return {
    job,
    applications,
    byStage: Object.fromEntries(
      job.stages.map((stage) => [
        stage.id,
        applications.filter((application) => application.stageId === stage.id),
      ])
    ),
  };
}

export async function listRecruitmentCandidates(
  organizationId: OrganizationId,
  query: Record<string, unknown>
) {
  const paging = queryPage(query);
  const filter: Record<string, unknown> = { organizationId };
  const search = text(query.search);
  if (search) {
    const match = safeRegex(search);
    filter.$or = [
      { fullName: match },
      { email: match },
      { headline: match },
      { skills: match },
      { tags: match },
    ];
  }
  if (text(query.tag)) filter.tags = text(query.tag);
  const [candidates, total] = await Promise.all([
    RecruitmentCandidate.find(filter)
      .sort({ updatedAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    RecruitmentCandidate.countDocuments(filter),
  ]);
  return {
    items: candidates,
    page: paging.page,
    limit: paging.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
}

export async function getRecruitmentCandidate(organizationId: OrganizationId, id: unknown) {
  const candidateId = objectId(id, "Candidate id");
  const candidate = await RecruitmentCandidate.findOne({ _id: candidateId, organizationId }).lean();
  if (!candidate) throw new RecruitmentServiceError("Candidate not found", 404);
  const [applications, attachments] = await Promise.all([
    RecruitmentApplication.find({ organizationId, candidateId })
      .populate("jobId", "title department status stages")
      .sort({ updatedAt: -1 })
      .lean(),
    RecruitmentAttachment.find({ organizationId, candidateId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return { candidate, applications, attachments };
}

export async function listRecruitmentApplications(
  organizationId: OrganizationId,
  query: Record<string, unknown>
) {
  const paging = queryPage(query);
  const filter: Record<string, unknown> = { organizationId };
  if (query.jobId) filter.jobId = objectId(query.jobId, "Job id");
  if (query.candidateId) filter.candidateId = objectId(query.candidateId, "Candidate id");
  if (text(query.stageId)) filter.stageId = text(query.stageId);
  const statuses = text(query.status)
    .split(",")
    .filter((status) =>
      ["active", "hired", "rejected", "withdrawn", "archived"].includes(status)
    );
  if (statuses.length) filter.status = { $in: statuses };
  const [applications, total] = await Promise.all([
    RecruitmentApplication.find(filter)
      .populate("jobId", "title department status stages")
      .populate("candidateId", "fullName email phone headline tags")
      .sort({ updatedAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    RecruitmentApplication.countDocuments(filter),
  ]);
  return {
    items: applications,
    page: paging.page,
    limit: paging.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
}

export async function getRecruitmentApplication(organizationId: OrganizationId, id: unknown) {
  const application = await findApplication(organizationId, id);
  await application.populate(["jobId", "candidateId"]);
  const match = { organizationId, applicationId: application._id };
  const [revisions, activities, notes, attachments] = await Promise.all([
    RecruitmentApplicationRevision.find(match).sort({ revision: -1 }).lean(),
    RecruitmentActivity.find(match).sort({ createdAt: -1 }).lean(),
    RecruitmentNote.find(match).sort({ createdAt: -1 }).lean(),
    RecruitmentAttachment.find(match).sort({ createdAt: -1 }).lean(),
  ]);
  return { application, revisions, activities, activity: activities, notes, attachments };
}

export async function listRecruitmentNotes(organizationId: OrganizationId, applicationId: unknown) {
  const application = await findApplication(organizationId, applicationId);
  return RecruitmentNote.find({ organizationId, applicationId: application._id })
    .sort({ createdAt: -1 })
    .lean();
}

export async function listRecruitmentActivity(
  organizationId: OrganizationId,
  query: Record<string, unknown>
) {
  const paging = queryPage(query);
  const filter: Record<string, unknown> = { organizationId };
  if (query.jobId) filter.jobId = objectId(query.jobId, "Job id");
  if (query.candidateId) filter.candidateId = objectId(query.candidateId, "Candidate id");
  if (query.applicationId) {
    filter.applicationId = objectId(query.applicationId, "Application id");
  }
  if (text(query.type)) filter.type = text(query.type);
  const [items, total] = await Promise.all([
    RecruitmentActivity.find(filter)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    RecruitmentActivity.countDocuments(filter),
  ]);
  return {
    items,
    page: paging.page,
    limit: paging.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.limit)),
  };
}

export async function getRecruitmentDashboard(organizationId: OrganizationId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [jobs, applicationMetrics, reachedStages, rankingRows, newCandidates, recentActivity] =
    await Promise.all([
      RecruitmentJob.find({ organizationId })
        .select("_id title status stages")
        .lean(),
      RecruitmentApplication.aggregate([
        { $match: { organizationId } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalApplications: { $sum: 1 },
                  activeApplications: {
                    $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                  },
                  newApplications: {
                    $sum: { $cond: [{ $gte: ["$appliedAt", since] }, 1, 0] },
                  },
                  hires: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$status", "hired"] },
                            { $gte: ["$updatedAt", since] },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            byStage: [
              { $match: { status: { $ne: "archived" } } },
              {
                $group: {
                  _id: { jobId: "$jobId", stageId: "$stageId" },
                  count: { $sum: 1 },
                  averageCurrentStageAgeMs: {
                    $avg: { $subtract: ["$$NOW", "$lastStageChangedAt"] },
                  },
                },
              },
            ],
            byJob: [
              { $match: { status: { $ne: "archived" } } },
              { $group: { _id: "$jobId", count: { $sum: 1 } } },
            ],
            bySource: [
              { $match: { status: { $ne: "archived" } } },
              {
                $group: {
                  _id: { $ifNull: ["$source", "unknown"] },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],
            aging: [
              { $match: { status: "active" } },
              {
                $group: {
                  _id: null,
                  averageAgeMs: { $avg: { $subtract: ["$$NOW", "$appliedAt"] } },
                  averageCurrentStageAgeMs: {
                    $avg: { $subtract: ["$$NOW", "$lastStageChangedAt"] },
                  },
                  oldestAppliedAt: { $min: "$appliedAt" },
                  oldestStageChangedAt: { $min: "$lastStageChangedAt" },
                },
              },
            ],
          },
        },
      ]),
      RecruitmentApplicationRevision.aggregate([
        { $match: { organizationId } },
        {
          $group: {
            _id: {
              applicationId: "$applicationId",
              jobId: "$snapshot.jobId",
              stageId: "$snapshot.stageId",
            },
          },
        },
        {
          $group: {
            _id: { jobId: "$_id.jobId", stageId: "$_id.stageId" },
            reached: { $sum: 1 },
          },
        },
      ]),
      RecruitmentRankingJob.aggregate([
        { $match: { organizationId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      RecruitmentCandidate.countDocuments({ organizationId, createdAt: { $gte: since } }),
      RecruitmentActivity.find({ organizationId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
  const metrics = applicationMetrics[0] ?? {};
  const totals = metrics.totals?.[0] ?? {};
  const aging = metrics.aging?.[0] ?? {};
  const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));
  const days = (milliseconds: number | null | undefined) =>
    milliseconds == null ? null : Math.round((milliseconds / 86_400_000) * 10) / 10;
  const applicationsByStage = (metrics.byStage ?? []).map((row: any) => {
    const job = jobMap.get(row._id.jobId.toString());
    const stage = job?.stages.find((item) => item.id === row._id.stageId);
    return {
      jobId: row._id.jobId,
      jobTitle: job?.title ?? "",
      stageId: row._id.stageId,
      stageName: stage?.name ?? row._id.stageId,
      stageOrder: stage?.order ?? null,
      count: row.count,
      averageCurrentStageAgeDays: days(row.averageCurrentStageAgeMs),
    };
  });
  const reachedMap = new Map<string, number>(
    reachedStages.map((row: any) => [
      `${row._id.jobId?.toString()}:${row._id.stageId}`,
      row.reached,
    ])
  );
  const applicationCountByJob = new Map<string, number>(
    (metrics.byJob ?? []).map((row: any) => [row._id.toString(), row.count])
  );
  const conversionFunnel = jobs
    .filter((job) => (applicationCountByJob.get(job._id.toString()) ?? 0) > 0)
    .map((job) => {
      const total = applicationCountByJob.get(job._id.toString()) ?? 0;
      return {
        jobId: job._id,
        jobTitle: job.title,
        totalApplications: total,
        stages: [...job.stages]
          .sort((left, right) => left.order - right.order)
          .map((stage) => {
            const reached = reachedMap.get(`${job._id.toString()}:${stage.id}`) ?? 0;
            return {
              stageId: stage.id,
              stageName: stage.name,
              order: stage.order,
              terminalOutcome: stage.terminalOutcome,
              reached,
              conversionRate: total ? Math.round((reached / total) * 1000) / 10 : 0,
            };
          }),
      };
    });
  const rankingByStatus = Object.fromEntries(
    rankingRows.map((row) => [String(row._id), row.count])
  ) as Record<string, number>;
  return {
    periodDays: 30,
    summary: {
      openJobs: jobs.filter((job) => job.status === "open").length,
      totalApplications: totals.totalApplications ?? 0,
      activeApplications: totals.activeApplications ?? 0,
      newApplications: totals.newApplications ?? 0,
      newCandidates,
      hires: totals.hires ?? 0,
    },
    applicationsByStage,
    applicationsByJob: (metrics.byJob ?? []).map((row: any) => ({
      jobId: row._id,
      jobTitle: jobMap.get(row._id.toString())?.title ?? "",
      count: row.count,
    })),
    applicationsBySource: (metrics.bySource ?? []).map((row: any) => ({
      source: row._id || "unknown",
      count: row.count,
    })),
    conversionFunnel,
    aging: {
      averageApplicationAgeDays: days(aging.averageAgeMs),
      averageCurrentStageAgeDays: days(aging.averageCurrentStageAgeMs),
      oldestApplicationAgeDays: aging.oldestAppliedAt
        ? days(Date.now() - new Date(aging.oldestAppliedAt).getTime())
        : null,
      oldestCurrentStageAgeDays: aging.oldestStageChangedAt
        ? days(Date.now() - new Date(aging.oldestStageChangedAt).getTime())
        : null,
      byStage: applicationsByStage.map((stage: any) => ({
        jobId: stage.jobId,
        jobTitle: stage.jobTitle,
        stageId: stage.stageId,
        stageName: stage.stageName,
        averageCurrentStageAgeDays: stage.averageCurrentStageAgeDays,
        currentApplications: stage.count,
      })),
    },
    ranking: {
      byStatus: rankingByStatus,
      queued: rankingByStatus.queued ?? 0,
      processing: rankingByStatus.processing ?? 0,
      backlog: (rankingByStatus.queued ?? 0) + (rankingByStatus.processing ?? 0),
      failures: rankingByStatus.failed ?? 0,
      manualReview: rankingByStatus.manual_review ?? 0,
    },
    recentActivity,
  };
}

export async function getEmployeeHandoff(
  organizationId: OrganizationId,
  applicationIdValue: unknown
) {
  const application = await findApplication(organizationId, applicationIdValue);
  const [candidate, job] = await Promise.all([
    RecruitmentCandidate.findOne({
      _id: application.candidateId,
      organizationId,
    }).lean(),
    RecruitmentJob.findOne({ _id: application.jobId, organizationId })
      .select("title stages")
      .lean(),
  ]);
  if (!candidate || !job) {
    throw new RecruitmentServiceError("Application data is incomplete", 409);
  }
  const stage = job.stages.find((item) => item.id === application.stageId);
  if (
    application.status !== "hired" ||
    !stage?.isTerminal ||
    stage.terminalOutcome !== "hired"
  ) {
    throw new RecruitmentServiceError(
      "Employee handoff is available only for applications in a Hired terminal stage",
      409
    );
  }
  const existingEmployee = await Employee.findOne({
    organizationId,
    email: candidate.email.toLowerCase(),
  })
    .select("_id email fullName status")
    .lean();
  const linkedIn = candidate.links.find(
    (link) => /linkedin/i.test(link.label) || /linkedin\.com/i.test(link.url)
  );
  return {
    applicationId: application._id,
    candidateId: candidate._id,
    jobId: job._id,
    jobTitle: job.title,
    prefill: {
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone || null,
      title: job.title || candidate.headline || null,
      employeeCode: null,
      profileImageUrl: null,
      startDate: null,
      status: "active",
      socials: {
        linkedinUrl: linkedIn?.url ?? null,
        instagramUrl: null,
      },
      address: {
        line1: "",
        line2: "",
        city: candidate.location,
        state: "",
        postalCode: "",
        country: "",
      },
      emergencyContact: { name: "", relationship: "", phone: "", email: "" },
      platformAccess: { enabled: false, allowedModules: [], restrictedModules: [] },
      teamId: null,
    },
    employeeEmailConflict: existingEmployee
      ? {
          exists: true,
          employeeId: existingEmployee._id,
          email: existingEmployee.email,
          fullName: existingEmployee.fullName,
          status: existingEmployee.status,
        }
      : { exists: false },
  };
}

type DeletionCollection = {
  deleteMany(
    filter: Record<string, unknown>,
    options?: { session: mongoose.ClientSession }
  ): Promise<any>;
};

async function removeApplicationDependents(
  organizationId: OrganizationId,
  applicationIds: Types.ObjectId[],
  session?: mongoose.ClientSession
) {
  const filter = { organizationId, applicationId: { $in: applicationIds } };
  const collections: DeletionCollection[] = [
    RecruitmentApplicationRevision,
    RecruitmentActivity,
    RecruitmentNote,
    RecruitmentAttachment,
    RecruitmentRankingJob,
    RecruitmentAcknowledgementDelivery,
  ];
  const results = [];
  for (const collection of collections) {
    results.push(
      await collection.deleteMany(filter, session ? { session } : undefined)
    );
  }
  return {
    revisions: results[0]?.deletedCount ?? 0,
    activities: results[1]?.deletedCount ?? 0,
    notes: results[2]?.deletedCount ?? 0,
    attachments: results[3]?.deletedCount ?? 0,
    rankingJobsAndResults: results[4]?.deletedCount ?? 0,
    acknowledgementDeliveries: results[5]?.deletedCount ?? 0,
  };
}

function transactionsUnsupported(error: unknown) {
  const value = error as { code?: number; codeName?: string; message?: string };
  return (
    value?.code === 20 ||
    value?.codeName === "IllegalOperation" ||
    /transaction numbers are only allowed|replica set member or mongos/i.test(
      value?.message ?? ""
    )
  );
}

async function cleanupAttachmentObjects(
  attachments: Array<{ _id: Types.ObjectId; key: string }>
) {
  const settled = await Promise.allSettled(
    attachments.map((attachment) => deleteObject(attachment.key))
  );
  const failedAttachmentIds = settled.flatMap((result, index) =>
    result.status === "rejected" && attachments[index]
      ? [attachments[index]._id.toString()]
      : []
  );
  return {
    requested: attachments.length,
    deleted: attachments.length - failedAttachmentIds.length,
    failed: failedAttachmentIds.length,
    failedAttachmentIds,
  };
}

export async function hardDeleteRecruitmentApplication(
  organizationId: OrganizationId,
  applicationIdValue: unknown,
  confirmationValue: unknown
) {
  if (text(confirmationValue) !== "DELETE_APPLICATION") {
    throw new RecruitmentServiceError(
      'confirmation must equal "DELETE_APPLICATION"'
    );
  }
  const application = await findApplication(organizationId, applicationIdValue);
  const attachments = await RecruitmentAttachment.find({
    organizationId,
    applicationId: application._id,
  })
    .select("_id key")
    .lean();
  const session = await mongoose.startSession();
  let deleted: Record<string, number> = {};
  const removeFromDatabase = async (transactionSession?: mongoose.ClientSession) => {
    deleted = await removeApplicationDependents(
      organizationId,
      [application._id],
      transactionSession
    );
    const applicationResult = await RecruitmentApplication.deleteOne(
      { _id: application._id, organizationId },
      transactionSession ? { session: transactionSession } : undefined
    );
    if (applicationResult.deletedCount !== 1) {
      throw new RecruitmentServiceError("Application not found", 404);
    }
    deleted.applications = 1;
  };
  try {
    try {
      await session.withTransaction(() => removeFromDatabase(session));
    } catch (error) {
      if (!transactionsUnsupported(error)) throw error;
      deleted = {};
      await removeFromDatabase();
    }
  } finally {
    await session.endSession();
  }
  const [remainingApplications, storage] = await Promise.all([
    RecruitmentApplication.countDocuments({
      organizationId,
      candidateId: application.candidateId,
    }),
    cleanupAttachmentObjects(attachments),
  ]);
  return {
    deleted,
    candidate: {
      id: application.candidateId,
      retained: true,
      remainingApplications,
    },
    storage,
  };
}

export async function hardDeleteRecruitmentCandidate(
  organizationId: OrganizationId,
  candidateIdValue: unknown,
  confirmationValue: unknown
) {
  if (text(confirmationValue) !== "DELETE_CANDIDATE") {
    throw new RecruitmentServiceError(
      'confirmation must equal "DELETE_CANDIDATE"'
    );
  }
  const candidateId = objectId(candidateIdValue, "Candidate id");
  const candidate = await RecruitmentCandidate.findOne({
    _id: candidateId,
    organizationId,
  }).lean();
  if (!candidate) throw new RecruitmentServiceError("Candidate not found", 404);
  const [applications, attachments] = await Promise.all([
    RecruitmentApplication.find({ organizationId, candidateId })
      .select("_id")
      .lean(),
    RecruitmentAttachment.find({ organizationId, candidateId })
      .select("_id key")
      .lean(),
  ]);
  const applicationIds = applications.map((application) => application._id);
  const session = await mongoose.startSession();
  let deleted: Record<string, number> = {};
  const removeFromDatabase = async (transactionSession?: mongoose.ClientSession) => {
    const options = transactionSession ? { session: transactionSession } : undefined;
    deleted = applicationIds.length
      ? await removeApplicationDependents(
          organizationId,
          applicationIds,
          transactionSession
        )
      : {};
    const candidateOwnedFilter = {
      organizationId,
      $or: [
        { candidateId },
        ...(applicationIds.length
          ? [{ applicationId: { $in: applicationIds } }]
          : []),
      ],
    };
    const activities = await RecruitmentActivity.deleteMany(
      candidateOwnedFilter,
      options
    );
    const notes = await RecruitmentNote.deleteMany(candidateOwnedFilter, options);
    const orphanAttachments = await RecruitmentAttachment.deleteMany(
      candidateOwnedFilter,
      options
    );
    deleted.activities =
      (deleted.activities ?? 0) + (activities.deletedCount ?? 0);
    deleted.notes = (deleted.notes ?? 0) + (notes.deletedCount ?? 0);
    deleted.attachments =
      (deleted.attachments ?? 0) + (orphanAttachments.deletedCount ?? 0);
    const applicationResult = await RecruitmentApplication.deleteMany(
      { organizationId, candidateId },
      options
    );
    deleted.applications = applicationResult.deletedCount ?? 0;
    const candidateResult = await RecruitmentCandidate.deleteOne(
      { _id: candidateId, organizationId },
      options
    );
    if (candidateResult.deletedCount !== 1) {
      throw new RecruitmentServiceError("Candidate not found", 404);
    }
    deleted.candidates = 1;
    deleted.rubrics = 0;
  };
  try {
    try {
      await session.withTransaction(() => removeFromDatabase(session));
    } catch (error) {
      if (!transactionsUnsupported(error)) throw error;
      deleted = {};
      await removeFromDatabase();
    }
  } finally {
    await session.endSession();
  }
  return {
    deleted,
    storage: await cleanupAttachmentObjects(attachments),
    retainedJobRubrics: true,
  };
}
