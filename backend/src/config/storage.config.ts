export interface StorageConfig {
  region: string;
  bucket: string;
  publicBaseUrl: string | null;
}

export function getStorageConfig(): StorageConfig {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "";
  const bucket = process.env.S3_UPLOAD_BUCKET ?? "";
  const publicBaseUrl = process.env.S3_UPLOAD_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? null;

  if (!region) {
    throw new Error("AWS_REGION environment variable is required for uploads");
  }

  if (!bucket) {
    throw new Error("S3_UPLOAD_BUCKET environment variable is required for uploads");
  }

  return { region, bucket, publicBaseUrl };
}
