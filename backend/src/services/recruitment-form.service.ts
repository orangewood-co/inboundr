import crypto from "crypto";
import type { FormFieldType } from "../models/form.model";

export class RecruitmentFormError extends Error {
  readonly statusCode = 400;
}

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
  "rating",
  "url",
  "yes_no",
];
const RESERVED_FIELD_IDS = new Set(["fullName", "email", "resume", "consent"]);

export interface RecruitmentVisibilityCondition {
  fieldId: string;
  operator: "equals" | "not_equals";
  value: string | number | boolean;
}

export interface RecruitmentFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  description: string | null;
  placeholder: string | null;
  options: string[];
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  multiple: boolean;
  visibilityCondition: RecruitmentVisibilityCondition | null;
}

export interface RecruitmentFormSchema {
  [key: string]: unknown;
  schemaVersion: 1;
  fields: RecruitmentFormField[];
}

const text = (value: unknown) => String(value ?? "").trim();
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function normalizeRecruitmentForm(value: unknown): RecruitmentFormSchema {
  const source = record(value);
  const rawFields = Array.isArray(source.fields) ? source.fields : [];
  const seen = new Set<string>();
  const fields = rawFields.map((item) => {
    const raw = record(item);
    const id =
      text(raw.id) ||
      `field_${crypto.randomBytes(6).toString("hex")}`;
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(id) || RESERVED_FIELD_IDS.has(id) || seen.has(id)) {
      throw new RecruitmentFormError("Application fields require unique, non-reserved ids");
    }
    seen.add(id);
    const label = text(raw.label).slice(0, 120);
    if (!label) throw new RecruitmentFormError("Application field labels are required");
    const type = raw.type as FormFieldType;
    if (!FIELD_TYPES.includes(type)) {
      throw new RecruitmentFormError(`Application field ${label} has an invalid type`);
    }
    const options = Array.isArray(raw.options)
      ? raw.options.map(text).filter(Boolean).slice(0, 50)
      : [];
    if ((type === "dropdown" || type === "checkbox") && options.length === 0) {
      throw new RecruitmentFormError(`Application field ${label} requires options`);
    }
    const conditionRaw = record(raw.visibilityCondition);
    const conditionFieldId = text(conditionRaw.fieldId);
    const visibilityCondition: RecruitmentVisibilityCondition | null =
      conditionFieldId &&
      (conditionRaw.operator === "equals" || conditionRaw.operator === "not_equals")
        ? {
            fieldId: conditionFieldId,
            operator: conditionRaw.operator as "equals" | "not_equals",
            value: conditionRaw.value as string | number | boolean,
          }
        : null;
    return {
      id,
      label,
      type,
      required: Boolean(raw.required),
      description: text(raw.description).slice(0, 500) || null,
      placeholder: text(raw.placeholder).slice(0, 180) || null,
      options,
      maxFileSizeMb: Math.min(10, Math.max(1, Number(raw.maxFileSizeMb) || 10)),
      allowedMimeTypes: Array.isArray(raw.allowedMimeTypes)
        ? raw.allowedMimeTypes.map((item) => text(item).toLowerCase()).filter(Boolean).slice(0, 20)
        : [],
      multiple: Boolean(raw.multiple),
      visibilityCondition,
    };
  });
  for (const field of fields) {
    const dependency = field.visibilityCondition?.fieldId;
    if (dependency && !seen.has(dependency)) {
      throw new RecruitmentFormError(`Application field ${field.label} has an invalid visibility condition`);
    }
  }
  return { schemaVersion: 1, fields };
}

function isVisible(field: RecruitmentFormField, answers: Record<string, unknown>): boolean {
  const condition = field.visibilityCondition;
  if (!condition) return true;
  const equal = String(answers[condition.fieldId] ?? "") === String(condition.value ?? "");
  return condition.operator === "equals" ? equal : !equal;
}

function validateAnswer(field: RecruitmentFormField, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  switch (field.type) {
    case "number":
    case "rating": {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new RecruitmentFormError(`${field.label} must be a number`);
      if (field.type === "rating" && (parsed < 1 || parsed > 5)) {
        throw new RecruitmentFormError(`${field.label} must be between 1 and 5`);
      }
      return parsed;
    }
    case "checkbox": {
      if (!Array.isArray(value)) throw new RecruitmentFormError(`${field.label} must be a list`);
      const values = value.map(text).filter(Boolean);
      if (values.some((item) => !field.options.includes(item))) {
        throw new RecruitmentFormError(`${field.label} contains an invalid option`);
      }
      return values;
    }
    case "dropdown": {
      const selected = text(value);
      if (!field.options.includes(selected)) {
        throw new RecruitmentFormError(`${field.label} contains an invalid option`);
      }
      return selected;
    }
    case "yes_no":
      if (typeof value !== "boolean") throw new RecruitmentFormError(`${field.label} must be yes or no`);
      return value;
    case "email": {
      const email = text(value).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new RecruitmentFormError(`${field.label} must be a valid email`);
      }
      return email;
    }
    case "url": {
      const url = text(value);
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        throw new RecruitmentFormError(`${field.label} must be a valid URL`);
      }
      return url;
    }
    case "date": {
      const date = text(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
        throw new RecruitmentFormError(`${field.label} must be a valid date`);
      }
      return date;
    }
    case "file":
      if (field.multiple) {
        if (!Array.isArray(value) || value.length === 0) {
          throw new RecruitmentFormError(`${field.label} must be a file list`);
        }
        return value.slice(0, 10).map(record);
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new RecruitmentFormError(`${field.label} must be a file`);
      }
      return record(value);
    default:
      return text(value).slice(0, field.type === "long_text" ? 10000 : 2000);
  }
}

export function validateRecruitmentAnswers(
  schemaValue: unknown,
  answersValue: unknown
): Record<string, unknown> {
  const schema = normalizeRecruitmentForm(schemaValue);
  const rawAnswers = record(answersValue);
  const answers: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (!isVisible(field, rawAnswers)) continue;
    const value = validateAnswer(field, rawAnswers[field.id]);
    if (field.required && (value === undefined || (Array.isArray(value) && value.length === 0))) {
      throw new RecruitmentFormError(`${field.label} is required`);
    }
    if (value !== undefined) answers[field.id] = value;
  }
  return answers;
}

export function publicRecruitmentForm(schemaValue: unknown, consent: { version: string; text: string }) {
  const schema = normalizeRecruitmentForm(schemaValue);
  return {
    ...schema,
    lockedFields: [
      { id: "fullName", label: "Full name", type: "short_text", required: true, locked: true },
      { id: "email", label: "Email", type: "email", required: true, locked: true },
      {
        id: "resume",
        label: "Resume",
        type: "file",
        required: true,
        locked: true,
        allowedMimeTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        maxFileSizeMb: 10,
      },
      {
        id: "consent",
        label: consent.text,
        type: "yes_no",
        required: true,
        locked: true,
        version: consent.version,
      },
    ],
  };
}
