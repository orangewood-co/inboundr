import crypto from "crypto";
import mongoose from "mongoose";

import type { FormFieldType, IFormBranding, IFormField } from "../models/form.model";
import { FormFolder } from "../models/form-folder.model";

export const FIELD_TYPES: FormFieldType[] = [
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
];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function makeFieldId(): string {
  return `field_${crypto.randomBytes(6).toString("hex")}`;
}

export function normalizeFields(value: unknown): IFormField[] {
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
        description: String(source.description ?? "").trim().slice(0, 500) || null,
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

export function normalizeBranding(value: unknown): IFormBranding {
  const branding = (value ?? {}) as Record<string, unknown>;
  return {
    accentColor: String(branding.accentColor ?? "#111827").trim() || "#111827",
    logoUrl: String(branding.logoUrl ?? "").trim() || null,
    backgroundType: ["solid", "gradient", "none"].includes(String(branding.backgroundType))
      ? (String(branding.backgroundType) as "solid" | "gradient" | "none")
      : "none",
    backgroundColor: String(branding.backgroundColor ?? "").trim() || null,
    backgroundGradient: String(branding.backgroundGradient ?? "").trim().slice(0, 500) || null,
    theme: String(branding.theme ?? "").trim().slice(0, 60) || null,
    borderRadius: ["sm", "md", "lg"].includes(String(branding.borderRadius))
      ? (String(branding.borderRadius) as "sm" | "md" | "lg")
      : "md",
  };
}

export function normalizeFormInput(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const slug = slugify(String(body.slug ?? title));
  const rawStatus = String(body.status);
  const status: "draft" | "published" | "archived" =
    rawStatus === "published" ? "published" : rawStatus === "archived" ? "archived" : "draft";
  const settings = (body.settings ?? {}) as Record<string, unknown>;
  const rawFolderId = String(body.folderId ?? "").trim();

  return {
    title,
    description: String(body.description ?? "").trim() || null,
    slug,
    status,
    folderId:
      rawFolderId && mongoose.Types.ObjectId.isValid(rawFolderId)
        ? new mongoose.Types.ObjectId(rawFolderId)
        : null,
    useFolderDesign: Boolean(body.useFolderDesign ?? true),
    fields: normalizeFields(body.fields),
    branding: normalizeBranding(body.branding),
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

// A form in a folder follows the folder's design unless it opted out (or the
// folder has since been deleted).
export async function resolveEffectiveBranding(form: {
  organizationId: mongoose.Types.ObjectId;
  folderId?: mongoose.Types.ObjectId | null;
  useFolderDesign?: boolean;
  branding: IFormBranding;
}): Promise<IFormBranding> {
  if (form.folderId && form.useFolderDesign !== false) {
    const folder = await FormFolder.findOne({
      _id: form.folderId,
      organizationId: form.organizationId,
    })
      .select("branding")
      .lean();
    if (folder?.branding) return folder.branding;
  }
  return form.branding;
}

export function validateFormInput(input: ReturnType<typeof normalizeFormInput>): string | null {
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
