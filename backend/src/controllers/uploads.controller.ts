import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Form } from "../models/form.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { createPresignedUpload, createPresignedViewUrl, keyBelongsToPrefix } from "../services/storage.service";

const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const SUPPORT_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
];
const SUPPORT_ALLOWED_MIME_TYPES = [...DEFAULT_ALLOWED_MIME_TYPES, ...SUPPORT_AUDIO_MIME_TYPES];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const BRANDING_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const BRANDING_MAX_FILE_SIZE = 2 * 1024 * 1024;
const AVATAR_ALLOWED_MIME_TYPES = ["image/webp", "image/jpeg", "image/png"];
const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024;
const IMAGE_UPLOAD_SCOPES = ["branding", "letterhead", "employee", "attendance"] as const;
const AUTHENTICATED_UPLOAD_SCOPES = ["form", "customer", "quote", "product", "support", "branding", "letterhead", "employee", "attendance"] as const;

function normalizeUploadRequest(body: Record<string, unknown>) {
  return {
    scope: String(body.scope ?? "").trim().toLowerCase(),
    fileName: String(body.fileName ?? "").trim(),
    contentType: String(body.contentType ?? "").trim().toLowerCase(),
    size: Number(body.size ?? 0),
    formId: String(body.formId ?? "").trim(),
    fieldId: String(body.fieldId ?? "").trim(),
  };
}

function validateUploadBasics(input: ReturnType<typeof normalizeUploadRequest>, allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES, maxFileSize = DEFAULT_MAX_FILE_SIZE): string | null {
  if (!input.fileName) return "File name is required";
  if (!input.contentType) return "Content type is required";
  if (!Number.isFinite(input.size) || input.size <= 0) return "File size is required";
  if (input.size > maxFileSize) return `File must be ${Math.round(maxFileSize / 1024 / 1024)}MB or smaller`;
  if (!allowedMimeTypes.includes(input.contentType)) return "This file type is not allowed";
  return null;
}

function allowedMimeTypesForScope(scope: string): string[] {
  if (scope === "employee" || scope === "attendance") return AVATAR_ALLOWED_MIME_TYPES;
  if (scope === "support") return SUPPORT_ALLOWED_MIME_TYPES;
  return IMAGE_UPLOAD_SCOPES.includes(scope as any) ? BRANDING_ALLOWED_MIME_TYPES : DEFAULT_ALLOWED_MIME_TYPES;
}

function fieldMaxBytes(maxFileSizeMb?: number): number {
  if (!maxFileSizeMb || !Number.isFinite(maxFileSizeMb)) return DEFAULT_MAX_FILE_SIZE;
  return Math.max(1, Math.min(maxFileSizeMb, 50)) * 1024 * 1024;
}

export async function createAuthenticatedPresign(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const input = normalizeUploadRequest(req.body ?? {});

    if (input.scope === "avatar") {
      const validationError = validateUploadBasics(input, AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_FILE_SIZE);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const presigned = await createPresignedUpload({
        scope: "avatar",
        organizationId: String(orgReq.user.id),
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
      });

      res.json(presigned);
      return;
    }

    if (!AUTHENTICATED_UPLOAD_SCOPES.includes(input.scope as any)) {
      res.status(400).json({ error: "Invalid upload scope" });
      return;
    }

    const validationError = validateUploadBasics(
      input,
      allowedMimeTypesForScope(input.scope),
      IMAGE_UPLOAD_SCOPES.includes(input.scope as any) ? BRANDING_MAX_FILE_SIZE : DEFAULT_MAX_FILE_SIZE
    );
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const prefixParts =
      input.scope === "form" && input.formId
        ? [input.formId]
        : input.scope === "branding"
          ? ["logo"]
          : input.scope === "employee"
            ? ["photos"]
            : input.scope === "attendance"
              ? ["evidence"]
          : [];
    const presigned = await createPresignedUpload({
      scope: input.scope,
      organizationId: String(orgReq.organization._id),
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      prefixParts,
    });

    res.json(presigned);
  } catch (err) {
    console.error("Error creating upload presign:", err);
    res.status(500).json({ error: "Failed to create upload URL" });
  }
}

export async function createAuthenticatedViewUrl(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const key = String(req.query.key ?? "").trim();
    if (!key) {
      res.status(400).json({ error: "File key is required" });
      return;
    }

    const allowed =
      keyBelongsToPrefix(key, ["avatar", String(orgReq.user.id)]) ||
      AUTHENTICATED_UPLOAD_SCOPES.some((scope) =>
        keyBelongsToPrefix(key, [scope, String(orgReq.organization._id)])
      );
    if (!allowed) {
      res.status(403).json({ error: "File access denied" });
      return;
    }

    res.json(await createPresignedViewUrl(key));
  } catch (err) {
    console.error("Error creating file view URL:", err);
    res.status(500).json({ error: "Failed to create file view URL" });
  }
}

export async function createPublicFormPresign(req: Request, res: Response): Promise<void> {
  try {
    const input = normalizeUploadRequest({ ...(req.body ?? {}), scope: "form" });
    const form = await Form.findOne({ slug: req.params.slug, status: "published" }).lean();
    if (!form) {
      res.status(404).json({ error: "Form not found" });
      return;
    }

    const fileField = form.fields.find((field) => field.id === input.fieldId && field.type === "file");
    if (!fileField) {
      res.status(400).json({ error: "File field not found" });
      return;
    }

    const validationError = validateUploadBasics(
      input,
      fileField.allowedMimeTypes?.length ? fileField.allowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES,
      fieldMaxBytes(fileField.maxFileSizeMb)
    );
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const presigned = await createPresignedUpload({
      scope: "form",
      organizationId: String(form.organizationId),
      fileName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      prefixParts: [String((form._id as mongoose.Types.ObjectId).toString()), input.fieldId],
    });

    res.json(presigned);
  } catch (err) {
    console.error("Error creating public form upload presign:", err);
    res.status(500).json({ error: "Failed to create upload URL" });
  }
}
