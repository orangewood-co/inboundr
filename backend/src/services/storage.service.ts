import crypto from "crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
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

export interface MultipartUploadSession {
  key: string;
  bucket: string;
  uploadId: string;
}

export interface CompletedMultipartPart {
  partNumber: number;
  etag: string;
}

const PRESIGN_EXPIRES_IN_SECONDS = 60 * 5;
// Long expiry so signed URLs held by open SPA tabs survive the session.
// Stable, non-expiring access still goes through backend redirect routes.
const VIEW_EXPIRES_IN_SECONDS = 60 * 60 * 12;

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

export function storageBucket(): string {
  return getStorageConfig().bucket;
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

function sanitizeDownloadFileName(fileName: string): string {
  const fallback = sanitizeFileName(fileName)
    .replace(/["\\;]/g, "_")
    .slice(0, 140);

  return fallback || "download";
}

function attachmentDisposition(fileName: string): string {
  const fallback = sanitizeDownloadFileName(fileName);
  const encoded = encodeURIComponent(fileName.trim() || fallback).replace(/['()]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function createPresignedViewUrl(
  key: string,
  options: { downloadFileName?: string } = {}
): Promise<{ url: string; expiresInSeconds: number }> {
  const { bucket } = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(options.downloadFileName
      ? { ResponseContentDisposition: attachmentDisposition(options.downloadFileName) }
      : {}),
  });
  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: VIEW_EXPIRES_IN_SECONDS,
  });

  return { url, expiresInSeconds: VIEW_EXPIRES_IN_SECONDS };
}

export async function getObjectMetadata(key: string): Promise<{
  contentType: string;
  size: number;
}> {
  const { bucket } = getStorageConfig();
  const response = await getS3Client().send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  return {
    contentType: String(response.ContentType ?? "").toLowerCase(),
    size: Number(response.ContentLength ?? 0),
  };
}

export async function createMultipartUpload(input: PresignUploadInput): Promise<MultipartUploadSession> {
  const { bucket } = getStorageConfig();
  const key = createUploadKey(input);
  const response = await getS3Client().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
    })
  );

  if (!response.UploadId) {
    throw new Error("Storage did not return a multipart upload id");
  }

  return { key, bucket, uploadId: response.UploadId };
}

export async function createPresignedUploadPartUrl(input: {
  key: string;
  uploadId: string;
  partNumber: number;
}): Promise<{ url: string; expiresInSeconds: number }> {
  const { bucket } = getStorageConfig();
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });
  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_IN_SECONDS,
  });

  return { url, expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS };
}

export async function completeMultipartUpload(input: {
  key: string;
  uploadId: string;
  parts: CompletedMultipartPart[];
}): Promise<void> {
  const { bucket } = getStorageConfig();
  const parts: CompletedPart[] = input.parts
    .map((part) => ({
      PartNumber: part.partNumber,
      ETag: part.etag,
    }))
    .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

  await getS3Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  const { bucket } = getStorageConfig();
  await getS3Client().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: input.key,
      UploadId: input.uploadId,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  const { bucket } = getStorageConfig();
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function copyObject(input: {
  sourceKey: string;
  destinationKey: string;
  contentType?: string;
}): Promise<void> {
  const { bucket } = getStorageConfig();
  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: input.destinationKey,
      CopySource: `${bucket}/${encodeURIComponent(input.sourceKey).replace(/%2F/g, "/")}`,
      ...(input.contentType
        ? {
            ContentType: input.contentType,
            MetadataDirective: "REPLACE",
          }
        : {}),
    })
  );
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const { bucket } = getStorageConfig();
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    })
  );
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { bucket } = getStorageConfig();
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error("Storage object has no body");
  }

  const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (body.transformToByteArray) {
    return Buffer.from(await body.transformToByteArray());
  }

  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function keyBelongsToPrefix(key: string, prefixParts: string[]): boolean {
  const prefix = prefixParts.map(sanitizePathPart).filter(Boolean).join("/");
  return key === prefix || key.startsWith(`${prefix}/`);
}
