import crypto from "crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { IResult } from "ua-parser-js";

const UAParser: (ua: string) => IResult = require("ua-parser-js");
import { Form, type FormFieldType, type IFormField } from "../models/form.model";
import { FormSubmission } from "../models/form-submission.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { keyBelongsToPrefix } from "../services/storage.service";

const FIELD_TYPES: FormFieldType[] = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "checkbox",
  "date",
  "file",
];

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function makeFieldId(): string {
  return `field_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeFields(value: unknown): IFormField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((field) => {
      const source = field as Record<string, unknown>;
      const type = FIELD_TYPES.includes(source.type as FormFieldType)
        ? (source.type as FormFieldType)
        : "short_text";
      const options = Array.isArray(source.options)
        ? source.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 30)
        : [];

      return {
        id: String(source.id || makeFieldId()),
        label: String(source.label ?? "").trim().slice(0, 120),
        type,
        required: Boolean(source.required),
        placeholder: String(source.placeholder ?? "").trim().slice(0, 180) || null,
        options: type === "dropdown" || type === "checkbox" ? options : [],
        maxFileSizeMb: Math.max(1, Math.min(Number(source.maxFileSizeMb ?? 10), 50)),
        allowedMimeTypes: Array.isArray(source.allowedMimeTypes)
          ? source.allowedMimeTypes.map((mime) => String(mime).trim().toLowerCase()).filter(Boolean).slice(0, 20)
          : [],
        multiple: Boolean(source.multiple),
      };
    })
    .filter((field) => field.label);
}

function normalizeFormInput(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const slug = slugify(String(body.slug ?? title));
  const rawStatus = String(body.status);
  const status: "draft" | "published" | "archived" =
    rawStatus === "published" ? "published" : rawStatus === "archived" ? "archived" : "draft";
  const branding = (body.branding ?? {}) as Record<string, unknown>;
  const settings = (body.settings ?? {}) as Record<string, unknown>;

  return {
    title,
    description: String(body.description ?? "").trim() || null,
    slug,
    status,
    fields: normalizeFields(body.fields),
    branding: {
      accentColor: String(branding.accentColor ?? "#111827").trim() || "#111827",
      logoUrl: String(branding.logoUrl ?? "").trim() || null,
    },
    settings: {
      submitButtonLabel: String(settings.submitButtonLabel ?? "Submit").trim() || "Submit",
      successMessage:
        String(settings.successMessage ?? "Thanks. Your response has been submitted.").trim() ||
        "Thanks. Your response has been submitted.",
      notifyOnSubmission: Boolean(settings.notifyOnSubmission ?? true),
      collectDeviceInfo: Boolean(settings.collectDeviceInfo ?? false),
    },
  };
}

function validateFormInput(input: ReturnType<typeof normalizeFormInput>): string | null {
  if (!input.title) return "Form title is required";
  if (!input.slug) return "Form slug is required";
  if (input.status === "published" && input.fields.length === 0) {
    return "Published forms need at least one field";
  }
  for (const field of input.fields) {
    if ((field.type === "dropdown" || field.type === "checkbox") && field.options?.length === 0) {
      return `${field.label} needs at least one option`;
    }
  }
  return null;
}

function serializeForm(form: any) {
  return {
    ...form,
    submissionCount: form.submissionCount ?? 0,
  };
}

export async function listForms(req: Request, res: Response): Promise<void> {
  try {
    const { organization } = req as OrganizationRequest;
    const forms = await Form.aggregate([
      { $match: { organizationId: organization._id, status: { $ne: "archived" } } },
      { $sort: { updatedAt: -1, createdAt: -1 } },
      {
        $lookup: {
          from: "formsubmissions",
          localField: "_id",
          foreignField: "formId",
          as: "submissions",
        },
      },
      { $addFields: { submissionCount: { $size: "$submissions" } } },
      { $project: { submissions: 0 } },
    ]);

    res.json({ forms: forms.map(serializeForm) });
  } catch (err) {
    console.error("Error listing forms:", err);
    res.status(500).json({ error: "Failed to fetch forms" });
  }
}

export async function createForm(req: Request, res: Response): Promise<void> {
  try {
    const { organization } = req as OrganizationRequest;
    const input = normalizeFormInput(req.body ?? {});
    const validationError = validateFormInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const form = await Form.create({ ...input, organizationId: organization._id });
    res.status(201).json(form);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "A form with this slug already exists" });
      return;
    }
    console.error("Error creating form:", err);
    res.status(500).json({ error: "Failed to create form" });
  }
}

export async function getForm(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const form = await Form.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    res.json(form);
  } catch (err) {
    console.error("Error fetching form:", err);
    res.status(500).json({ error: "Failed to fetch form" });
  }
}

export async function updateForm(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const input = normalizeFormInput(req.body ?? {});
    const validationError = validateFormInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const form = await Form.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      input,
      { new: true, runValidators: true }
    ).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    res.json(form);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "A form with this slug already exists" });
      return;
    }
    console.error("Error updating form:", err);
    res.status(500).json({ error: "Failed to update form" });
  }
}

export async function duplicateForm(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const form = await Form.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const copy = await Form.create({
      organizationId: organization._id,
      title: `${form.title} Copy`,
      description: form.description,
      slug: `${form.slug}-${Date.now().toString(36)}`,
      status: "draft",
      fields: form.fields,
      branding: form.branding,
      settings: form.settings,
    });
    res.status(201).json(copy);
  } catch (err) {
    console.error("Error duplicating form:", err);
    res.status(500).json({ error: "Failed to duplicate form" });
  }
}

export async function archiveForm(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const form = await Form.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { status: "archived" },
      { new: true }
    ).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    res.json(form);
  } catch (err) {
    console.error("Error archiving form:", err);
    res.status(500).json({ error: "Failed to archive form" });
  }
}

export async function listSubmissions(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const filter = { formId: new mongoose.Types.ObjectId(id), organizationId: organization._id };

    const [submissions, total] = await Promise.all([
      FormSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FormSubmission.countDocuments(filter),
    ]);

    res.json({ submissions, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Error listing form submissions:", err);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
}

export async function updateSubmissionStatus(req: Request, res: Response): Promise<void> {
  try {
    const submissionId = String(req.params.submissionId ?? "");
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      res.status(400).json({ error: "Invalid submission id" });
      return;
    }
    const status = String(req.body?.status ?? "");
    if (!["new", "reviewed", "archived"].includes(status)) {
      res.status(400).json({ error: "Invalid submission status" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const submission = await FormSubmission.findOneAndUpdate(
      { _id: submissionId, organizationId: organization._id },
      { status },
      { new: true }
    ).lean();
    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }
    res.json(submission);
  } catch (err) {
    console.error("Error updating submission:", err);
    res.status(500).json({ error: "Failed to update submission" });
  }
}

export async function exportSubmissionsCsv(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid form id" });
      return;
    }
    const { organization } = req as OrganizationRequest;
    const form = await Form.findOne({ _id: id, organizationId: organization._id }).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const submissions = await FormSubmission.find({ formId: form._id, organizationId: organization._id })
      .sort({ createdAt: -1 })
      .lean();
    const deviceHeaders = form.settings.collectDeviceInfo ? ["device", "os", "browser"] : [];
    const headers = ["submittedAt", "status", "source", ...deviceHeaders, ...form.fields.map((field) => field.label)];
    const formatSubmissionValue = (value: unknown): string => {
      if (Array.isArray(value)) {
        return value
          .map((item) =>
            item && typeof item === "object" && "originalName" in item
              ? `${(item as any).originalName} (${(item as any).key})`
              : String(item)
          )
          .join("; ");
      }
      if (value && typeof value === "object" && "originalName" in value) {
        return `${(value as any).originalName} (${(value as any).key})`;
      }
      return String(value ?? "");
    };
    const rows = submissions.map((submission) => {
      const deviceCols = form.settings.collectDeviceInfo
        ? [submission.metadata?.device ?? "", submission.metadata?.os ?? "", submission.metadata?.browser ?? ""]
        : [];
      return [
        submission.createdAt.toISOString(),
        submission.status,
        submission.source,
        ...deviceCols,
        ...form.fields.map((field) => formatSubmissionValue(submission.values?.[field.id])),
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${form.slug}-submissions.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("Error exporting submissions:", err);
    res.status(500).json({ error: "Failed to export submissions" });
  }
}

function isUploadedFileMetadata(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const file = value as Record<string, unknown>;
  return Boolean(file.key && file.bucket && file.originalName && file.contentType && file.size);
}

function sanitizeUploadedFileMetadata(file: Record<string, unknown>) {
  return {
    key: String(file.key),
    bucket: String(file.bucket),
    originalName: String(file.originalName),
    contentType: String(file.contentType).toLowerCase(),
    size: Number(file.size),
    uploadedAt: typeof file.uploadedAt === "string" && file.uploadedAt
      ? file.uploadedAt
      : new Date().toISOString(),
  };
}

function validateSubmission(fields: IFormField[], values: Record<string, unknown>, form: { _id: unknown; organizationId: unknown }) {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values[field.id];
    const text = typeof value === "string" ? value.trim() : value;

    if (field.required && (text === undefined || text === null || text === "" || (Array.isArray(text) && text.length === 0))) {
      errors[field.id] = "This field is required";
      continue;
    }
    if (text === undefined || text === null || text === "") continue;

    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text))) {
      errors[field.id] = "Enter a valid email";
      continue;
    }
    if (field.type === "number" && !Number.isFinite(Number(text))) {
      errors[field.id] = "Enter a valid number";
      continue;
    }
    if (field.type === "dropdown" && !field.options?.includes(String(text))) {
      errors[field.id] = "Choose a valid option";
      continue;
    }
    if (field.type === "checkbox") {
      const selected = Array.isArray(value) ? value.map(String) : [String(value)];
      sanitized[field.id] = selected.filter((option) => field.options?.includes(option));
      continue;
    }
    if (field.type === "file") {
      const files = Array.isArray(value) ? value : [value];
      const validFiles = files.filter(isUploadedFileMetadata);
      if (field.required && validFiles.length === 0) {
        errors[field.id] = "This field is required";
        continue;
      }
      if (!field.multiple && validFiles.length > 1) {
        errors[field.id] = "Only one file is allowed";
        continue;
      }
      const expectedPrefix = ["form", String(form.organizationId), String(form._id), field.id];
      const invalidFile = validFiles.find((file) => {
        const key = String(file.key ?? "");
        const contentType = String(file.contentType ?? "").toLowerCase();
        const size = Number(file.size ?? 0);
        const maxBytes = Math.max(1, Math.min(Number(field.maxFileSizeMb ?? 10), 50)) * 1024 * 1024;
        return (
          !keyBelongsToPrefix(key, expectedPrefix) ||
          size <= 0 ||
          size > maxBytes ||
          Boolean(field.allowedMimeTypes?.length && !field.allowedMimeTypes.includes(contentType))
        );
      });
      if (invalidFile) {
        errors[field.id] = "Uploaded file is not valid for this form";
        continue;
      }
      if (validFiles.length > 0) {
        const sanitizedFiles = validFiles.map(sanitizeUploadedFileMetadata);
        sanitized[field.id] = field.multiple
          ? sanitizedFiles
          : sanitizedFiles[0];
      }
      continue;
    }
    sanitized[field.id] = field.type === "number" ? Number(text) : String(text).slice(0, 5000);
  }

  return { errors, sanitized };
}

export async function getPublicForm(req: Request, res: Response): Promise<void> {
  try {
    const form = await Form.findOne({ slug: req.params.slug, status: "published" }).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    res.json(form);
  } catch (err) {
    console.error("Error fetching public form:", err);
    res.status(500).json({ error: "Failed to fetch form" });
  }
}

export async function submitPublicForm(req: Request, res: Response): Promise<void> {
  try {
    if (req.body?.website) {
      res.status(204).send();
      return;
    }
    const form = await Form.findOne({ slug: req.params.slug, status: "published" });
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }
    const { errors, sanitized } = validateSubmission(form.fields, (req.body?.values ?? {}) as Record<string, unknown>, form);
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ error: "Please fix the highlighted fields", errors });
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || "";
    const ua = req.get("user-agent") ?? null;

    let device: string | null = null;
    let os: string | null = null;
    let browser: string | null = null;
    if (form.settings.collectDeviceInfo && ua) {
      const parsed = UAParser(ua);
      device = parsed.device.model || parsed.device.type || "Desktop";
      os = [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") || null;
      browser = [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ") || null;
    }

    const submission = await FormSubmission.create({
      organizationId: form.organizationId,
      formId: form._id,
      values: sanitized,
      source: req.body?.source === "embed" ? "embed" : "link",
      metadata: {
        userAgent: ua,
        referrer: req.get("referer") ?? null,
        ipHash: ip ? crypto.createHash("sha256").update(ip).digest("hex") : null,
        device,
        os,
        browser,
      },
    });

    res.status(201).json({
      submissionId: submission._id,
      message: form.settings.successMessage,
    });
  } catch (err) {
    console.error("Error submitting public form:", err);
    res.status(500).json({ error: "Failed to submit form" });
  }
}
