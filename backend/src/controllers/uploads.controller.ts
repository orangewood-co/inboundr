import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Form } from "../models/form.model";
import {
  Feedback,
  FEEDBACK_ATTACHMENT_MIME_TYPES,
  FEEDBACK_IMAGE_MIME_TYPES,
  FEEDBACK_IMAGE_MAX_BYTES,
  FEEDBACK_VIDEO_MAX_BYTES,
} from "../models/feedback.model";
import { OrganizationMember } from "../models/organization-member.model";
import {
  isPlatformAdmin,
  type AuthenticatedRequest,
  type OrganizationRequest,
} from "../middleware/auth.middleware";
import { getOrganizationContextForUser } from "../services/organization.service";
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
const AUTHENTICATED_UPLOAD_SCOPES = ["form", "customer", "quote", "product", "support", "branding", "letterhead", "employee", "attendance", "asset"] as const;

function normalizeUploadRequest(body: Record<string, unknown>) {
  return {
    scope: String(body.scope ?? "").trim().toLowerCase(),
    fileName: String(body.fileName ?? "").trim(),
    contentType: String(body.contentType ?? "").trim().toLowerCase(),
    size: Number(body.size ?? 0),
    formId: String(body.formId ?? "").trim(),
    fieldId: String(body.fieldId ?? "").trim(),
    feedbackId: String(body.feedbackId ?? "").trim(),
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

function validateFeedbackUpload(input: ReturnType<typeof normalizeUploadRequest>): string | null {
  const contentType = input.contentType;
  const maxSize = FEEDBACK_IMAGE_MIME_TYPES.includes(contentType as any)
    ? FEEDBACK_IMAGE_MAX_BYTES
    : FEEDBACK_VIDEO_MAX_BYTES;
  return validateUploadBasics(input, [...FEEDBACK_ATTACHMENT_MIME_TYPES], maxSize);
}

async function getOrganizationContext(req: Request) {
  const authReq = req as AuthenticatedRequest;
  return getOrganizationContextForUser(authReq.user, req.header("x-organization-id"));
}

function organizationContextErrorStatus(error: unknown): number {
  return error instanceof Error && error.message === "Organization access denied" ? 403 : 400;
}

function fieldMaxBytes(maxFileSizeMb?: number): number {
  if (!maxFileSizeMb || !Number.isFinite(maxFileSizeMb)) return DEFAULT_MAX_FILE_SIZE;
  return Math.max(1, Math.min(maxFileSizeMb, 50)) * 1024 * 1024;
}

function avatarOwnerUserIdFromKey(key: string): string | null {
  const [scope, userId] = key.split("/");
  if (scope !== "avatar" || !userId) return null;
  return userId;
}

async function canViewOrganizationMemberAvatar(orgReq: OrganizationRequest, key: string): Promise<boolean> {
  const avatarOwnerUserId = avatarOwnerUserIdFromKey(key);
  if (!avatarOwnerUserId) return false;

  const member = await OrganizationMember.exists({
    organizationId: orgReq.organization._id,
    userId: avatarOwnerUserId,
  });

  return Boolean(member);
}

async function canViewFeedbackAttachment(req: AuthenticatedRequest, key: string): Promise<boolean> {
  if (!keyBelongsToPrefix(key, ["feedback"])) return false;

  const ownedThread = await Feedback.exists({
    userId: req.user.id,
    "messages.attachments.key": key,
  });
  if (ownedThread) return true;

  if (!(await isPlatformAdmin(req.user))) return false;
  return Boolean(await Feedback.exists({ "messages.attachments.key": key }));
}

export async function createAuthenticatedPresign(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const input = normalizeUploadRequest(req.body ?? {});

    if (input.scope === "avatar") {
      const validationError = validateUploadBasics(input, AVATAR_ALLOWED_MIME_TYPES, AVATAR_MAX_FILE_SIZE);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const presigned = await createPresignedUpload({
        scope: "avatar",
        organizationId: String(authReq.user.id),
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
      });

      res.json(presigned);
      return;
    }

    if (input.scope === "feedback") {
      const validationError = validateFeedbackUpload(input);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const prefixParts = input.feedbackId ? [input.feedbackId] : ["draft"];
      const presigned = await createPresignedUpload({
        scope: "feedback",
        organizationId: String(authReq.user.id),
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
        prefixParts,
      });

      res.json(presigned);
      return;
    }

    if (!AUTHENTICATED_UPLOAD_SCOPES.includes(input.scope as any)) {
      res.status(400).json({ error: "Invalid upload scope" });
      return;
    }

    let orgContext: Awaited<ReturnType<typeof getOrganizationContext>>;
    try {
      orgContext = await getOrganizationContext(req);
    } catch (err) {
      res.status(organizationContextErrorStatus(err)).json({
        error: err instanceof Error ? err.message : "Invalid organization context",
      });
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
      organizationId: String(orgContext.organization._id),
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
    const authReq = req as AuthenticatedRequest;
    const key = String(req.query.key ?? "").trim();
    if (!key) {
      res.status(400).json({ error: "File key is required" });
      return;
    }

    let allowed =
      keyBelongsToPrefix(key, ["avatar", String(authReq.user.id)]) ||
      (await canViewFeedbackAttachment(authReq, key));

    if (!allowed) {
      let orgContext: Awaited<ReturnType<typeof getOrganizationContext>> | null;
      try {
        orgContext = await getOrganizationContext(req);
      } catch {
        orgContext = null;
      }

      if (!orgContext) {
        res.status(403).json({ error: "File access denied" });
        return;
      }

      const orgReq = {
        ...authReq,
        organization: orgContext.organization,
        organizationMembership: orgContext.membership,
      } as OrganizationRequest;

      allowed =
        (key.startsWith("avatar/") && (await canViewOrganizationMemberAvatar(orgReq, key))) ||
        AUTHENTICATED_UPLOAD_SCOPES.some((scope) =>
          keyBelongsToPrefix(key, [scope, String(orgContext.organization._id)])
        );
    }
    if (!allowed) {
      res.status(403).json({ error: "File access denied" });
      return;
    }

    const download = req.query.download === "1" || req.query.download === "true";
    const fileName = String(req.query.filename ?? "").trim() || key.split("/").pop() || "download";
    res.json(await createPresignedViewUrl(key, download ? { downloadFileName: fileName } : {}));
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
