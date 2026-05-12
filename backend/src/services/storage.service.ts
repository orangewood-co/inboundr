import crypto from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageConfig } from "../config/storage.config";

export interface PresignUploadInput {
  scope: string;
  organizationId: string;
  fileName: string;
  contentType: string;
  size: number;
  prefixParts?: string[];
}

export interface UploadMetadata {
  key: string;
  bucket: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadedAt: string | null;
  url: string | null;
}

export interface PresignedUpload {
  uploadUrl: string;
  method: "PUT";
  headers: {
    "Content-Type": string;
  };
  file: UploadMetadata;
  expiresInSeconds: number;
}

const PRESIGN_EXPIRES_IN_SECONDS = 60 * 5;
const VIEW_EXPIRES_IN_SECONDS = 60 * 10;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const { region } = getStorageConfig();
    s3Client = new S3Client({ region });
  }

  return s3Client;
}

function sanitizePathPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/\\/g, "/").split("/").pop() || "upload";
  const safe = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

  return safe || "upload";
}

export function createUploadKey(input: PresignUploadInput): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(10).toString("hex");
  const safeFileName = sanitizeFileName(input.fileName);
  const parts = [
    sanitizePathPart(input.scope),
    sanitizePathPart(input.organizationId),
    ...(input.prefixParts ?? []).map(sanitizePathPart).filter(Boolean),
    year,
    month,
    `${random}-${safeFileName}`,
  ];

  return parts.join("/");
}

export function fileUrlForKey(key: string): string | null {
  const { publicBaseUrl } = getStorageConfig();
  return publicBaseUrl ? `${publicBaseUrl}/${key}` : null;
}

export async function createPresignedUpload(input: PresignUploadInput): Promise<PresignedUpload> {
  const { bucket } = getStorageConfig();
  const key = createUploadKey(input);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
  });

  return {
    uploadUrl,
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
    },
    expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS,
    file: {
      key,
      bucket,
      originalName: input.fileName,
      contentType: input.contentType,
      size: input.size,
      uploadedAt: null,
      url: fileUrlForKey(key),
    },
  };
}

export async function createPresignedViewUrl(key: string): Promise<{ url: string; expiresInSeconds: number }> {
  const { bucket } = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: VIEW_EXPIRES_IN_SECONDS,
  });

  return { url, expiresInSeconds: VIEW_EXPIRES_IN_SECONDS };
}

export function keyBelongsToPrefix(key: string, prefixParts: string[]): boolean {
  const prefix = prefixParts.map(sanitizePathPart).filter(Boolean).join("/");
  return key === prefix || key.startsWith(`${prefix}/`);
}
