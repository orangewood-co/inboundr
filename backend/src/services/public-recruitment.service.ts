import crypto from "node:crypto";
import mongoose, { type Types } from "mongoose";
import { RecruitmentSettings } from "../models/recruitment-settings.model";
import { RecruitmentJob, type IRecruitmentJob } from "../models/recruitment-job.model";
import { RecruitmentCandidate } from "../models/recruitment-candidate.model";
import {
  RecruitmentApplication,
  type IRecruitmentApplication,
} from "../models/recruitment-application.model";
import { RecruitmentApplicationRevision } from "../models/recruitment-application-revision.model";
import { RecruitmentAttachment } from "../models/recruitment-attachment.model";
import { RecruitmentActivity } from "../models/recruitment-activity.model";
import { RecruitmentUploadSession } from "../models/recruitment-upload-session.model";
import { Organization } from "../models/organization.model";
import {
  createPresignedUpload,
  createPresignedViewUrl,
  deleteObject,
  getObjectMetadata,
  keyBelongsToPrefix,
  storageBucket,
} from "./storage.service";
import {
  normalizeRecruitmentForm,
  publicRecruitmentForm,
  validateRecruitmentAnswers,
} from "./recruitment-form.service";
import { RecruitmentServiceError } from "./recruitment.service";
import { queueRecruitmentAcknowledgement } from "./recruitment-acknowledgement.service";
import { enqueueApplicationRanking } from "./recruitment-ranking.service";

const RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
const MAX_RESUME_SIZE = 10 * 1024 * 1024;
const UPLOAD_SESSION_TTL_MS = 10 * 60_000;
const UPLOAD_SESSION_MAX_FILES = 12;
const text = (value: unknown) => String(value ?? "").trim();
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

interface PublicContext {
  ip: string;
  userAgent: string;
  referrer: string;
}

function isAccepting(job: Pick<IRecruitmentJob, "status" | "publishedAt" | "applicationDeadline">) {
  return (
    job.status === "open" &&
    Boolean(job.publishedAt) &&
    (!job.applicationDeadline || job.applicationDeadline.getTime() > Date.now())
  );
}

async function publicSettings(pathValue: unknown) {
  const organizationPath = text(pathValue).toLowerCase();
  const settings = await RecruitmentSettings.findOne({
    organizationPath,
    publicCareersEnabled: true,
  }).lean();
  if (!settings) throw new RecruitmentServiceError("Careers site not found", 404);
  return settings;
}

async function publicJob(pathValue: unknown, slugValue: unknown) {
  const settings = await publicSettings(pathValue);
  const job = await RecruitmentJob.findOne({
    organizationId: settings.organizationId,
    publicSlug: text(slugValue).toLowerCase(),
    status: "open",
    publishedAt: { $ne: null },
  }).lean();
  if (!job) throw new RecruitmentServiceError("Job not found", 404);
  return { settings, job };
}

function serializeJob(
  job: Record<string, any>,
  organizationPath: string,
  consent: { version: string; text: string },
  detail = false
) {
  const deadlineClosed =
    Boolean(job.applicationDeadline) &&
    new Date(job.applicationDeadline).getTime() <= Date.now();
  const url = `/careers/${organizationPath}/jobs/${job.publicSlug}`;
  const summary = text(job.description).replace(/\s+/g, " ").slice(0, 180);
  return {
    id: String(job._id),
    slug: job.publicSlug,
    title: job.title,
    department: job.department,
    location: job.location,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    openings: job.openings,
    salaryMin: job.salaryVisible ? job.salaryMin : null,
    salaryMax: job.salaryVisible ? job.salaryMax : null,
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod ?? "year",
    salaryVisible: Boolean(job.salaryVisible),
    publishedAt: job.publishedAt,
    applicationDeadline: job.applicationDeadline,
    acceptingApplications: !deadlineClosed,
    deadlineClosed,
    ...(detail
      ? {
          description: job.description,
          requirements: job.requirements,
          applicationForm: publicRecruitmentForm(job.publicApplicationForm, consent),
        }
      : {}),
    seo: {
      title: text(job.seoTitle) || `${job.title}`,
      description: text(job.seoDescription) || summary,
      canonicalPath: url,
    },
    share: {
      path: url,
      title: text(job.seoTitle) || job.title,
      text: text(job.socialShareText) || text(job.seoDescription) || summary,
    },
  };
}

function isAbsoluteImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("data:");
}

// Logo values may be internal S3 keys (the internal app resolves them through an
// authenticated endpoint). The public site must emit a URL a browser can load.
async function resolvePublicImageUrl(value: unknown): Promise<string | null> {
  const raw = text(value);
  if (!raw) return null;
  if (isAbsoluteImageUrl(raw)) return raw;
  try {
    const { url } = await createPresignedViewUrl(raw);
    return url;
  } catch {
    return null;
  }
}

async function effectiveBranding(settings: any) {
  if (!settings.inheritOrganizationBranding) {
    return {
      primaryColor: settings.branding?.primaryColor,
      logoUrl: await resolvePublicImageUrl(settings.branding?.logoUrl),
    };
  }
  const organization = await Organization.findById(settings.organizationId)
    .select("name logoUrl preferences.primaryColor")
    .lean();
  return {
    primaryColor: organization?.preferences?.primaryColor || settings.branding?.primaryColor,
    logoUrl: await resolvePublicImageUrl(organization?.logoUrl || settings.branding?.logoUrl),
  };
}

export async function getPublicCareersSite(pathValue: unknown) {
  const settings = await publicSettings(pathValue);
  const [organization, branding] = await Promise.all([
    Organization.findById(settings.organizationId).select("name website").lean(),
    effectiveBranding(settings),
  ]);
  return {
    organizationPath: settings.organizationPath,
    organizationName: organization?.name ?? "",
    website: organization?.website ?? "",
    headline: settings.headline,
    intro: settings.intro,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    socialShareText: settings.socialShareText,
    bannerUrl: settings.bannerUrl,
    socialLinks: settings.socialLinks,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    branding,
    seo: {
      title: settings.seoTitle || settings.headline || `${organization?.name ?? ""} Careers`,
      description: settings.seoDescription || settings.intro.slice(0, 180),
      image: [settings.bannerUrl, branding?.logoUrl].find(
        (value) => typeof value === "string" && isAbsoluteImageUrl(value)
      ) ?? null,
      canonicalPath: `/careers/${settings.organizationPath}`,
    },
    share: {
      path: `/careers/${settings.organizationPath}`,
      title: settings.seoTitle || settings.headline || `${organization?.name ?? ""} Careers`,
      text: settings.socialShareText || settings.seoDescription || settings.intro.slice(0, 180),
    },
  };
}

export async function listPublicRecruitmentJobs(
  pathValue: unknown,
  query: Record<string, unknown>
) {
  const settings = await publicSettings(pathValue);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filter: Record<string, unknown> = {
    organizationId: settings.organizationId,
    status: "open",
    publishedAt: { $ne: null },
    publicSlug: { $type: "string" },
  };
  const publicFilterScope = { ...filter };
  for (const key of ["department", "location", "employmentType", "workplaceType"] as const) {
    if (text(query[key])) filter[key] = text(query[key]);
  }
  const [items, total, filterRows] = await Promise.all([
    RecruitmentJob.find(filter)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RecruitmentJob.countDocuments(filter),
    RecruitmentJob.aggregate([
      { $match: publicFilterScope },
      {
        $facet: {
          departments: [
            { $match: { department: { $type: "string", $ne: "" } } },
            { $group: { _id: "$department" } },
            { $sort: { _id: 1 } },
          ],
          locations: [
            { $match: { location: { $type: "string", $ne: "" } } },
            { $group: { _id: "$location" } },
            { $sort: { _id: 1 } },
          ],
          employmentTypes: [
            { $match: { employmentType: { $type: "string", $ne: "" } } },
            { $group: { _id: "$employmentType" } },
            { $sort: { _id: 1 } },
          ],
          workplaceTypes: [
            { $match: { workplaceType: { $in: ["onsite", "hybrid", "remote"] } } },
            { $group: { _id: "$workplaceType" } },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
  ]);
  const safeFilters = filterRows[0] ?? {};
  const values = (key: string) =>
    ((safeFilters as Record<string, Array<{ _id: unknown }>>)[key] ?? [])
      .map((row) => text(row._id))
      .filter(Boolean);
  return {
    items: items.map((job) =>
      serializeJob(job, settings.organizationPath!, settings.consent)
    ),
    filters: {
      departments: values("departments"),
      locations: values("locations"),
      employmentTypes: values("employmentTypes"),
      workplaceTypes: values("workplaceTypes"),
    },
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPublicRecruitmentJob(pathValue: unknown, slugValue: unknown) {
  const { settings, job } = await publicJob(pathValue, slugValue);
  return serializeJob(job, settings.organizationPath!, settings.consent, true);
}

function fileInput(
  body: Record<string, unknown>,
  constraints: {
    label: string;
    allowedMimeTypes: readonly string[];
    maxSize: number;
  }
) {
  const fileName = text(body.fileName || body.originalName);
  const contentType = text(body.contentType).toLowerCase();
  const size = Number(body.size);
  if (
    !fileName ||
    !constraints.allowedMimeTypes.includes(contentType) ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > constraints.maxSize
  ) {
    throw new RecruitmentServiceError(
      `${constraints.label} must use an allowed file type and be no larger than ${Math.ceil(
        constraints.maxSize / (1024 * 1024)
      )}MB`
    );
  }
  return { fileName, contentType, size };
}

function resumeInput(body: Record<string, unknown>) {
  return fileInput(body, {
    label: "Resume",
    allowedMimeTypes: RESUME_TYPES,
    maxSize: MAX_RESUME_SIZE,
  });
}

function uploadSessionHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function requestIpHash(ip: string) {
  const secret = process.env.RECRUITMENT_UPLOAD_SESSION_SECRET?.trim()
    || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim()
    || "recruitment-upload-session";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

async function createUploadSession(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  ip: string
) {
  const token = crypto.randomBytes(32).toString("base64url");
  await RecruitmentUploadSession.create({
    organizationId,
    jobId,
    tokenHash: uploadSessionHash(token),
    ipHash: requestIpHash(ip),
    maxUploads: UPLOAD_SESSION_MAX_FILES,
    expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
  });
  return token;
}

async function claimUploadSlot(input: {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  ip: string;
  uploadSession: string;
}) {
  const session = await RecruitmentUploadSession.findOneAndUpdate(
    {
      organizationId: input.organizationId,
      jobId: input.jobId,
      tokenHash: uploadSessionHash(input.uploadSession),
      ipHash: requestIpHash(input.ip),
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ["$uploadCount", "$maxUploads"] },
    },
    { $inc: { uploadCount: 1 } },
    { new: true }
  );
  if (!session) {
    throw new RecruitmentServiceError("Upload verification expired or is invalid", 403);
  }
}

export async function presignPublicResume(
  pathValue: unknown,
  slugValue: unknown,
  body: Record<string, unknown>,
  context: Pick<PublicContext, "ip">
) {
  const { settings, job } = await publicJob(pathValue, slugValue);
  if (!isAccepting(job as IRecruitmentJob)) {
    throw new RecruitmentServiceError("This job is no longer accepting applications", 409);
  }
  const fieldId = text(body.fieldId);
  const schema = normalizeRecruitmentForm(job.publicApplicationForm);
  const customField = fieldId
    ? schema.fields.find((field) => field.id === fieldId && field.type === "file")
    : null;
  if (fieldId && !customField) {
    throw new RecruitmentServiceError("File field is invalid");
  }
  let uploadSession = text(body.uploadSession);
  if (uploadSession) {
    await claimUploadSlot({
      organizationId: settings.organizationId,
      jobId: job._id,
      ip: context.ip,
      uploadSession,
    });
  } else {
    await verifyTurnstile(body.turnstileToken, context.ip);
    uploadSession = await createUploadSession(settings.organizationId, job._id, context.ip);
    await claimUploadSlot({
      organizationId: settings.organizationId,
      jobId: job._id,
      ip: context.ip,
      uploadSession,
    });
  }
  const allowedMimeTypes =
    customField && customField.allowedMimeTypes.length
      ? customField.allowedMimeTypes
      : RESUME_TYPES;
  const file = customField
    ? fileInput(body, {
        label: customField.label,
        allowedMimeTypes,
        maxSize: customField.maxFileSizeMb * 1024 * 1024,
      })
    : resumeInput(body);
  const presigned = await createPresignedUpload({
    scope: "recruitment-public",
    organizationId: settings.organizationId.toString(),
    prefixParts: [job._id.toString(), customField?.id ?? "resume"],
    ...file,
  });
  return { ...presigned, uploadSession };
}

async function verifyTurnstile(tokenValue: unknown, ip: string) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  const localBypass =
    !isProduction &&
    (!secret || process.env.RECRUITMENT_TURNSTILE_LOCAL_BYPASS === "true");
  if (localBypass) return;
  if (!secret) {
    throw new RecruitmentServiceError("Application verification is unavailable", 503);
  }
  const token = text(tokenValue);
  if (!token) throw new RecruitmentServiceError("Application verification failed");
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Turnstile returned ${response.status}`);
    const result = (await response.json()) as { success?: boolean };
    if (!result.success) throw new RecruitmentServiceError("Application verification failed");
  } catch (error) {
    if (error instanceof RecruitmentServiceError) throw error;
    throw new RecruitmentServiceError("Application verification is unavailable", 503);
  }
}

function submissionMetadata(body: Record<string, unknown>, context: PublicContext) {
  const raw = record(body.metadata);
  const utm = record(raw.utm);
  return {
    source: text(raw.source || body.source).slice(0, 80) || "careers_site",
    referrer: text(raw.referrer || context.referrer).slice(0, 2000),
    utm: Object.fromEntries(
      ["source", "medium", "campaign", "term", "content"].map((key) => [
        key,
        text(utm[key] ?? raw[`utm_${key}`]).slice(0, 250),
      ])
    ),
    device: {
      userAgent: context.userAgent.slice(0, 1000),
      ip: context.ip,
      language: text(raw.language).slice(0, 80),
      timezone: text(raw.timezone).slice(0, 80),
      screen: text(raw.screen).slice(0, 80),
    },
    submittedAt: new Date(),
  };
}

async function assertResume(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  bodyValue: unknown
) {
  const body = record(bodyValue);
  const file = resumeInput(body);
  const key = text(body.key);
  if (!keyBelongsToPrefix(key, [
    "recruitment-public",
    organizationId.toString(),
    jobId.toString(),
    "resume",
  ])) {
    throw new RecruitmentServiceError("Resume key is invalid");
  }
  let stored: { contentType: string; size: number };
  try {
    stored = await getObjectMetadata(key);
  } catch {
    throw new RecruitmentServiceError("Resume upload could not be verified");
  }
  if (stored.contentType !== file.contentType || stored.size !== file.size) {
    throw new RecruitmentServiceError("Resume metadata does not match the uploaded file");
  }
  return { ...file, key };
}

async function assertCustomFiles(
  organizationId: Types.ObjectId,
  jobId: Types.ObjectId,
  schemaValue: unknown,
  answers: Record<string, unknown>
) {
  const schema = normalizeRecruitmentForm(schemaValue);
  const files: Array<ReturnType<typeof resumeInput> & { key: string; fieldId: string }> = [];
  for (const field of schema.fields.filter((item) => item.type === "file")) {
    const answer = answers[field.id];
    const values = Array.isArray(answer) ? answer : answer ? [answer] : [];
    if (!field.multiple && values.length > 1) {
      throw new RecruitmentServiceError(`${field.label} accepts only one file`);
    }
    if (values.length > 10) {
      throw new RecruitmentServiceError(`${field.label} accepts at most 10 files`);
    }
    const allowedMimeTypes = field.allowedMimeTypes.length
      ? field.allowedMimeTypes
      : RESUME_TYPES;
    for (const value of values) {
      const body = record(value);
      const file = fileInput(body, {
        label: field.label,
        allowedMimeTypes,
        maxSize: field.maxFileSizeMb * 1024 * 1024,
      });
      const key = text(body.key);
      if (!keyBelongsToPrefix(key, [
        "recruitment-public",
        organizationId.toString(),
        jobId.toString(),
        field.id,
      ])) {
        throw new RecruitmentServiceError(`${field.label} upload key is invalid`);
      }
      let stored: { contentType: string; size: number };
      try {
        stored = await getObjectMetadata(key);
      } catch {
        throw new RecruitmentServiceError(`${field.label} upload could not be verified`);
      }
      if (stored.contentType !== file.contentType || stored.size !== file.size) {
        throw new RecruitmentServiceError(`${field.label} upload metadata does not match`);
      }
      files.push({ ...file, key, fieldId: field.id });
    }
  }
  return files;
}

export async function submitPublicApplication(
  pathValue: unknown,
  slugValue: unknown,
  body: Record<string, unknown>,
  context: PublicContext
) {
  if (text(body.website || body.company || body.honeypot)) {
    return;
  }
  const { settings, job } = await publicJob(pathValue, slugValue);
  const uploadSession = text(body.uploadSession);
  if (uploadSession) {
    const consumed = await RecruitmentUploadSession.findOneAndUpdate(
      {
        organizationId: settings.organizationId,
        jobId: job._id,
        tokenHash: uploadSessionHash(uploadSession),
        ipHash: requestIpHash(context.ip),
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        uploadCount: { $gt: 0 },
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );
    if (!consumed) {
      throw new RecruitmentServiceError("Application verification expired or was already used", 403);
    }
  } else {
    // Backward-compatible for direct submission clients that do not upload through
    // the public presign endpoint.
    await verifyTurnstile(body.turnstileToken, context.ip);
  }
  if (!isAccepting(job as IRecruitmentJob)) {
    throw new RecruitmentServiceError("This job is no longer accepting applications", 409);
  }
  const fullName = text(body.fullName).slice(0, 200);
  const email = text(body.email).toLowerCase().slice(0, 320);
  if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RecruitmentServiceError("Full name and a valid email are required");
  }
  const consent = record(body.consent);
  if (
    consent.accepted !== true ||
    text(consent.version) !== settings.consent.version ||
    !settings.consent.version ||
    !settings.consent.text
  ) {
    throw new RecruitmentServiceError("Current candidate consent is required");
  }
  const resume = await assertResume(settings.organizationId, job._id, body.resume);
  const metadata = submissionMetadata(body, context);
  const candidateUpdate = {
    $set: {
      fullName,
      source: metadata.source,
      consent: {
        accepted: true,
        version: settings.consent.version,
        text: settings.consent.text,
        acceptedAt: new Date(),
      },
      metadata,
      updatedByUserId: null,
    },
    $setOnInsert: {
      organizationId: settings.organizationId,
      email,
      createdByUserId: null,
    },
  };
  let candidate;
  try {
    candidate = await RecruitmentCandidate.findOneAndUpdate(
      { organizationId: settings.organizationId, email },
      candidateUpdate,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    candidate = await RecruitmentCandidate.findOneAndUpdate(
      { organizationId: settings.organizationId, email },
      candidateUpdate.$set,
      { new: true }
    );
  }
  if (!candidate) {
    throw new RecruitmentServiceError("Application could not be submitted", 409);
  }
  let existing = await RecruitmentApplication.findOne({
    organizationId: settings.organizationId,
    jobId: job._id,
    candidateId: candidate._id,
  });
  if (
    existing &&
    ["hired", "rejected", "archived"].includes(existing.status)
  ) {
    return;
  }
  const schemaSnapshot = existing?.formSchemaSnapshot ?? normalizeRecruitmentForm(job.publicApplicationForm);
  const answers = validateRecruitmentAnswers(schemaSnapshot, body.answers);
  const customFiles = await assertCustomFiles(
    settings.organizationId,
    job._id,
    schemaSnapshot,
    answers
  );
  const firstStage = [...job.stages]
    .sort((a, b) => a.order - b.order)
    .find((stage) => !stage.isTerminal);
  if (!firstStage) throw new RecruitmentServiceError("This job is not accepting applications", 409);
  let created = false;
  if (!existing) {
    try {
      existing = await RecruitmentApplication.create({
        organizationId: settings.organizationId,
        jobId: job._id,
        candidateId: candidate._id,
        stageId: firstStage.id,
        status: "active",
        source: metadata.source,
        answers,
        formSchemaSnapshot: schemaSnapshot,
        submissionMetadata: metadata,
        pipelineOrder: Date.now(),
        createdByUserId: null,
        updatedByUserId: null,
      });
      created = true;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      existing = await RecruitmentApplication.findOne({
        organizationId: settings.organizationId,
        jobId: job._id,
        candidateId: candidate._id,
      });
      if (
        !existing ||
        ["hired", "rejected", "archived"].includes(existing.status)
      ) {
        return;
      }
    }
  }
  if (!existing) {
    throw new RecruitmentServiceError("Application could not be submitted", 409);
  }
  const attachment =
    (await RecruitmentAttachment.findOne({
      organizationId: settings.organizationId,
      key: resume.key,
    })) ??
    (await RecruitmentAttachment.create({
      organizationId: settings.organizationId,
      candidateId: candidate._id,
      applicationId: existing._id,
      kind: "resume",
      key: resume.key,
      bucket: storageBucket(),
      originalName: resume.fileName,
      contentType: resume.contentType,
      size: resume.size,
      uploadedByUserId: null,
    }));
  if (
    attachment.applicationId?.toString() !== existing._id.toString() ||
    attachment.candidateId.toString() !== candidate._id.toString()
  ) {
    throw new RecruitmentServiceError("Resume upload is already associated with another application");
  }
  for (const file of customFiles) {
    const customAttachment = await RecruitmentAttachment.findOneAndUpdate(
      { organizationId: settings.organizationId, key: file.key },
      {
        $setOnInsert: {
          candidateId: candidate._id,
          applicationId: existing._id,
          kind: "other",
          bucket: storageBucket(),
          originalName: file.fileName,
          contentType: file.contentType,
          size: file.size,
          uploadedByUserId: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    if (
      customAttachment.applicationId?.toString() !== existing._id.toString() ||
      customAttachment.candidateId.toString() !== candidate._id.toString()
    ) {
      throw new RecruitmentServiceError("File upload is already associated with another application");
    }
  }
  let previousResumeAttachmentId: Types.ObjectId | null = null;
  let application = created
    ? await RecruitmentApplication.findOneAndUpdate(
        {
          _id: existing._id,
          organizationId: settings.organizationId,
          revision: 1,
          resumeAttachmentId: null,
        },
        {
          $set: {
            answers,
            source: metadata.source,
            submissionMetadata: metadata,
            resumeAttachmentId: attachment._id,
          },
        },
        { new: true }
      )
    : null;
  if (!application) {
    const refreshBeforeRetry = created;
    created = false;
    let before: IRecruitmentApplication;
    if (refreshBeforeRetry) {
      const refreshedAfterCreate = await RecruitmentApplication.findOne({
          _id: existing._id,
          organizationId: settings.organizationId,
        });
      if (!refreshedAfterCreate) return;
      before = refreshedAfterCreate;
    } else {
      before = existing;
    }
    for (let attempt = 0; attempt < 10 && !application; attempt += 1) {
      if (!["active", "withdrawn"].includes(before.status)) return;
      const reactivating = before.status === "withdrawn";
      application = await RecruitmentApplication.findOneAndUpdate(
        {
          _id: before._id,
          organizationId: settings.organizationId,
          status: before.status,
          revision: before.revision,
        },
        {
          $set: {
            answers,
            source: metadata.source,
            submissionMetadata: metadata,
            resumeAttachmentId: attachment._id,
            status: "active",
            ...(reactivating
              ? {
                  stageId: firstStage.id,
                  pipelineOrder: Date.now(),
                  lastStageChangedAt: new Date(),
                }
              : {}),
            updatedByUserId: null,
          },
          $inc: { revision: 1 },
        },
        { new: true }
      );
      if (application) {
        previousResumeAttachmentId = before.resumeAttachmentId;
        break;
      }
      const refreshed: IRecruitmentApplication | null =
        await RecruitmentApplication.findOne({
        _id: before._id,
        organizationId: settings.organizationId,
      });
      if (!refreshed) return;
      before = refreshed;
    }
  }
  if (!application) {
    throw new RecruitmentServiceError("Application is being updated; please retry", 409);
  }
  await RecruitmentApplicationRevision.findOneAndUpdate(
    {
      organizationId: settings.organizationId,
      applicationId: application._id,
      revision: application.revision,
    },
    {
      $setOnInsert: {
        reason: created ? "public_submission" : "public_resubmission",
        actorUserId: null,
        snapshot: application.toObject({ depopulate: true }),
      },
    },
    { upsert: true }
  );
  await RecruitmentActivity.create({
    organizationId: settings.organizationId,
    jobId: job._id,
    candidateId: candidate._id,
    applicationId: application._id,
    type: created ? "application_created" : "application_updated",
    actorUserId: null,
    actorName: "Careers site",
    message: created ? "Candidate submitted an application" : "Candidate updated their application",
    metadata: { source: metadata.source, revision: application.revision },
  });
  if (
    previousResumeAttachmentId &&
    previousResumeAttachmentId.toString() !== attachment._id.toString()
  ) {
    const referenced = await RecruitmentApplication.exists({
      organizationId: settings.organizationId,
      resumeAttachmentId: previousResumeAttachmentId,
    });
    if (!referenced) {
      const superseded = await RecruitmentAttachment.findOneAndDelete({
        _id: previousResumeAttachmentId,
        organizationId: settings.organizationId,
        applicationId: application._id,
        kind: "resume",
      })
        .select("key")
        .lean();
      if (superseded) {
        try {
          await deleteObject(superseded.key);
        } catch (error) {
          console.error("Failed to delete superseded recruitment resume object:", error);
        }
      }
    }
  }
  try {
    await queueRecruitmentAcknowledgement({
      organizationId: settings.organizationId,
      jobId: job._id,
      applicationId: application._id,
      applicationRevision: application.revision,
      recipient: candidate.email,
      candidateName: candidate.fullName,
      jobTitle: job.title,
    });
  } catch (error) {
    console.error("Failed to record recruitment acknowledgement delivery:", error);
  }
  try {
    await enqueueApplicationRanking({
      organizationId: settings.organizationId,
      jobId: job._id,
      applicationId: application._id,
      inputRevision: application.revision,
      requestedByUserId: null,
    });
  } catch (error) {
    console.error("Failed to queue recruitment ranking:", error);
  }
}
