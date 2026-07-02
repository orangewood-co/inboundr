import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getStorageBucket } from "./config";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({});
  }
  return client;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: getStorageBucket(), Key: key })
  );
  if (!response.Body) {
    throw new Error(`Storage object ${key} has no body`);
  }
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getStorageBucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    })
  );
}
