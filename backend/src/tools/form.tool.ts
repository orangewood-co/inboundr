import { tool } from "ai";
import mongoose from "mongoose";
import { z } from "zod";

import { formsShareOrigin } from "../config/origins.config";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { Form, type IFormField } from "../models/form.model";
import { FormSubmission } from "../models/form-submission.model";
import { getEmployeeAccessState } from "../services/employee-access.service";
import { hasEffectiveFeature } from "../services/entitlement.service";
import { normalizeFormInput, validateFormInput } from "../services/form-input.service";

type FormToolContext = {
  user: AuthenticatedRequest["user"];
  organization: OrganizationRequest["organization"];
  organizationMembership: OrganizationRequest["organizationMembership"];
};

const fieldSchema = z.object({
  id: z
    .string()
    .optional()
    .describe(
      "Existing field id. Include it when editing a form so submissions stay linked to the question; omit for new fields."
    ),
  label: z.string().min(1).describe("The question shown to the respondent."),
  type: z
    .enum([
      "short_text",
      "long_text",
      "email",
      "phone",
      "number",
      "dropdown",
      "checkbox",
      "date",
      "file",
      "rating",
      "url",
      "yes_no",
    ])
    .describe(
      "Field type. dropdown = single choice, checkbox = multiple choice, rating = 1-5 stars, yes_no = yes/no buttons."
    ),
  required: z.boolean().optional(),
  description: z.string().optional().nullable().describe("Helper text shown under the question."),
  placeholder: z.string().optional().nullable(),
  options: z
    .array(z.string())
    .optional()
    .describe("Choices for dropdown and checkbox fields. Required for those types."),
  maxFileSizeMb: z.number().optional().describe("File fields only. 1-50, default 10."),
  allowedMimeTypes: z.array(z.string()).optional().describe("File fields only, e.g. application/pdf."),
  multiple: z.boolean().optional().describe("File fields only: allow multiple uploads."),
});

const settingsSchema = z.object({
  submitButtonLabel: z.string().optional(),
  successMessage: z.string().optional(),
  notifyOnSubmission: z.boolean().optional(),
  collectDeviceInfo: z.boolean().optional(),
});

async function ensureFormsModuleAccess(context: FormToolContext): Promise<void> {
  if (!hasEffectiveFeature(context.organization, "forms")) {
    throw new Error("Forms are not enabled for this organization.");
  }

  const access = await getEmployeeAccessState({
    organizationId: context.organization._id,
    organizationMemberId: context.organizationMembership?._id ?? null,
    role: context.organizationMembership.role,
  });

  if (!access.enabled) {
    throw new Error("Forms access is disabled for this organization.");
  }

  if (access.restricted && !access.allowedModules.includes("forms")) {
    throw new Error("You do not have access to the forms module.");
  }
}

function ensureFormsManager(context: FormToolContext): void {
  const role = context.organizationMembership.role;
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only organization owners and admins can create or change forms.");
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicFormUrl(slug: string): string {
  return `${formsShareOrigin}/f/${encodeURIComponent(slug)}`;
}

function serializeFieldSummary(field: IFormField) {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    ...(field.options?.length ? { options: field.options } : {}),
  };
}

function serializeForm(form: {
  _id: unknown;
  title: string;
  description?: string | null;
  slug: string;
  status: string;
  fields: IFormField[];
  updatedAt?: Date;
  submissionCount?: number;
  newSubmissionCount?: number;
}) {
  return {
    id: String(form._id),
    title: form.title,
    description: form.description ?? null,
    status: form.status,
    slug: form.slug,
    publicUrl: publicFormUrl(form.slug),
    fieldCount: form.fields.length,
    fields: form.fields.map(serializeFieldSummary),
    ...(form.submissionCount !== undefined ? { submissionCount: form.submissionCount } : {}),
    ...(form.newSubmissionCount !== undefined ? { newSubmissionCount: form.newSubmissionCount } : {}),
    updatedAt: form.updatedAt ?? null,
  };
}

const ANSWER_TEXT_LIMIT = 200;

function formatAnswerValue(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) {
    return value.map((item) => formatAnswerValue(item)).filter((item) => item !== null);
  }
  if (typeof value === "object") {
    const file = value as Record<string, unknown>;
    if (typeof file.originalName === "string") return file.originalName;
    return null;
  }
  const text = String(value);
  return text.length > ANSWER_TEXT_LIMIT ? `${text.slice(0, ANSWER_TEXT_LIMIT)}…` : text;
}

export function createFormTools(context: FormToolContext) {
  return {
    searchForms: tool({
      description:
        "List or search the organization's forms. Returns each form's id, status, questions (with field ids), public link, and submission counts. Use this to find a form before updating it or reading its submissions.",
      inputSchema: z.object({
        query: z.string().optional().describe("Optional title search. Omit to list recent forms."),
        status: z
          .enum(["draft", "published", "archived"])
          .optional()
          .describe("Filter by status. By default archived forms are excluded."),
        limit: z.number().int().min(1).max(10).optional().default(5),
      }),
      execute: async ({ query, status, limit }) => {
        await ensureFormsModuleAccess(context);

        const match: Record<string, unknown> = {
          organizationId: context.organization._id,
          status: status ?? { $ne: "archived" },
        };
        if (query?.trim()) {
          match.title = { $regex: escapeRegex(query.trim()), $options: "i" };
        }

        const forms = await Form.aggregate([
          { $match: match },
          { $sort: { updatedAt: -1, createdAt: -1 } },
          { $limit: limit ?? 5 },
          {
            $lookup: {
              from: "formsubmissions",
              let: { formId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$formId", "$$formId"] } } },
                {
                  $group: {
                    _id: null,
                    submissionCount: { $sum: 1 },
                    newSubmissionCount: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
                  },
                },
              ],
              as: "submissionStats",
            },
          },
          {
            $addFields: {
              submissionCount: { $ifNull: [{ $first: "$submissionStats.submissionCount" }, 0] },
              newSubmissionCount: { $ifNull: [{ $first: "$submissionStats.newSubmissionCount" }, 0] },
            },
          },
          { $project: { submissionStats: 0 } },
        ]);

        return {
          query: query ?? null,
          status: forms.length > 0 ? "ok" : "empty",
          forms: forms.map(serializeForm),
        };
      },
    }),

    createForm: tool({
      description:
        "Create a new form for the organization. Forms are always created as drafts; the user reviews design and publishing in the form editor. dropdown and checkbox fields need at least one option.",
      inputSchema: z.object({
        title: z.string().min(1).describe("Form title, shown to respondents."),
        description: z.string().optional().describe("Intro text shown on the form's welcome screen."),
        fields: z.array(fieldSchema).min(1).describe("The form's questions, in order."),
        settings: settingsSchema.optional(),
      }),
      execute: async ({ title, description, fields, settings }) => {
        await ensureFormsModuleAccess(context);
        ensureFormsManager(context);

        const input = normalizeFormInput({
          title,
          description,
          fields,
          settings,
          status: "draft",
        });
        const validationError = validateFormInput(input);
        if (validationError) {
          return { status: "invalid", error: validationError };
        }

        try {
          const form = await Form.create({ ...input, organizationId: context.organization._id });
          return { status: "created", form: serializeForm(form.toObject()) };
        } catch (err: any) {
          if (err?.code !== 11000) throw err;
          const form = await Form.create({
            ...input,
            slug: `${input.slug}-${Date.now().toString(36)}`,
            organizationId: context.organization._id,
          });
          return { status: "created", form: serializeForm(form.toObject()) };
        }
      },
    }),

    updateForm: tool({
      description:
        "Update an existing form. Only the provided properties change. When editing questions, send the complete replacement fields list and keep the id of every question that already exists (get them from searchForms). Set status to published only when the user explicitly asks to publish; the public link stays the same.",
      inputSchema: z.object({
        formId: z.string().min(1).describe("The form id from searchForms or createForm."),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        fields: z
          .array(fieldSchema)
          .min(1)
          .optional()
          .describe("Complete replacement list of questions, in order."),
        settings: settingsSchema.optional(),
        status: z
          .enum(["draft", "published"])
          .optional()
          .describe("Only set when the user explicitly asks to publish or unpublish."),
      }),
      execute: async ({ formId, title, description, fields, settings, status }) => {
        await ensureFormsModuleAccess(context);
        ensureFormsManager(context);

        if (!mongoose.Types.ObjectId.isValid(formId)) {
          return { status: "invalid", error: "Invalid form id" };
        }
        const existing = await Form.findOne({
          _id: formId,
          organizationId: context.organization._id,
        }).lean();
        if (!existing) {
          return { status: "not_found", error: "Form not found" };
        }

        const input = normalizeFormInput({
          title: title !== undefined ? title : existing.title,
          description: description !== undefined ? description : existing.description,
          slug: existing.slug,
          status: status !== undefined ? status : existing.status,
          fields: fields !== undefined ? fields : existing.fields,
          branding: existing.branding,
          settings: { ...existing.settings, ...(settings ?? {}) },
        });
        // The slug is never regenerated so existing public/share links stay valid.
        input.slug = existing.slug;

        const validationError = validateFormInput(input);
        if (validationError) {
          return { status: "invalid", error: validationError };
        }

        const form = await Form.findOneAndUpdate(
          { _id: formId, organizationId: context.organization._id },
          input,
          { new: true, runValidators: true }
        ).lean();
        if (!form) {
          return { status: "not_found", error: "Form not found" };
        }

        return { status: "updated", form: serializeForm(form) };
      },
    }),

    getFormSubmissions: tool({
      description:
        "Get submission counts and the most recent responses for a form. Answers are keyed by question label. Use it to answer questions like how many responses a form has or to summarize what respondents said.",
      inputSchema: z.object({
        formId: z.string().min(1).describe("The form id from searchForms."),
        limit: z.number().int().min(1).max(20).optional().default(10).describe("How many recent submissions to include."),
        status: z
          .enum(["new", "reviewed", "archived"])
          .optional()
          .describe("Only include submissions with this status."),
      }),
      execute: async ({ formId, limit, status }) => {
        await ensureFormsModuleAccess(context);

        if (!mongoose.Types.ObjectId.isValid(formId)) {
          return { status: "invalid", error: "Invalid form id" };
        }
        const form = await Form.findOne({
          _id: formId,
          organizationId: context.organization._id,
        }).lean();
        if (!form) {
          return { status: "not_found", error: "Form not found" };
        }

        const baseFilter = {
          formId: new mongoose.Types.ObjectId(formId),
          organizationId: context.organization._id,
        };

        const [statusGroups, submissions] = await Promise.all([
          FormSubmission.aggregate([
            { $match: baseFilter },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                lastSubmissionAt: { $max: "$createdAt" },
              },
            },
          ]),
          FormSubmission.find(status ? { ...baseFilter, status } : baseFilter)
            .sort({ createdAt: -1 })
            .limit(limit ?? 10)
            .lean(),
        ]);

        const counts = { total: 0, new: 0, reviewed: 0, archived: 0 };
        let lastSubmissionAt: Date | null = null;
        for (const group of statusGroups) {
          const key = String(group._id) as "new" | "reviewed" | "archived";
          if (key in counts) counts[key] = group.count;
          counts.total += group.count;
          if (!lastSubmissionAt || group.lastSubmissionAt > lastSubmissionAt) {
            lastSubmissionAt = group.lastSubmissionAt;
          }
        }

        return {
          status: "ok",
          form: { id: String(form._id), title: form.title, formStatus: form.status },
          counts,
          lastSubmissionAt,
          submissions: submissions.map((submission) => {
            const answers: Record<string, unknown> = {};
            for (const field of form.fields) {
              const value = formatAnswerValue(submission.values?.[field.id]);
              if (value !== null) answers[field.label] = value;
            }
            return {
              id: String(submission._id),
              submittedAt: submission.createdAt,
              status: submission.status,
              answers,
            };
          }),
        };
      },
    }),
  };
}
