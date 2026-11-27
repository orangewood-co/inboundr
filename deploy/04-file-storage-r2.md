# Step 04 — File storage (Cloudflare R2)

**Sequence:** 04 of 12 · **Depends on:** 01 · **Blocks:** 08

## What part of the project this step deploys

The **object storage behind `backend/src/services/storage.service.ts`**: Drive files, product/CRM uploads, form attachments, attendance selfies, support-chat attachments, recruitment resumes, and ZIP exports. The backend issues presigned PUT/GET URLs (including multipart uploads), so browsers upload **directly** to the bucket.

## What to use

- **Cloudflare R2** (free: 10 GB storage, 1M writes and 10M reads per month, **no egress fees**). It speaks the S3 API, so the existing `@aws-sdk/client-s3` code keeps working once the endpoint is configured.
- Alternative with **no code change**: keep **AWS S3** (5 GB free for 12 months only).

## Required code change (small, not done yet)

Today `getS3Client()` builds `new S3Client({ region })`. That always talks to AWS, and it takes credentials from the default chain (`AWS_ACCESS_KEY_ID`), which is also what SES uses in Step 06. R2 needs its own endpoint and its own keys:

- `backend/src/config/storage.config.ts`: read optional `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `backend/src/services/storage.service.ts`: when they are set, pass
  `{ region, endpoint, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }` to `S3Client`.
  (Recent AWS SDK v3 versions add CRC32 checksum params to presigned URLs by default, which can break direct browser uploads to R2.)
- Add the three variables to `backend/.env.production.example`.

When they are unset, behavior stays exactly as today (AWS S3).

## How to do it

1. Cloudflare dashboard → **R2 Object Storage** → enable R2. This asks for a payment method but stays $0 inside the free limits.
2. **Create bucket**: `inboundr-uploads`, location hint close to your users (e.g. APAC).
3. **Settings → CORS policy** on the bucket (browsers PUT directly to R2):
   ```json
   [
     {
       "AllowedOrigins": ["https://app.yourdomain.com", "https://forms.yourdomain.com"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   `ETag` must be exposed, because multipart upload completion reads it.
4. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**, scoped to `inboundr-uploads`. Save the **Access Key ID** and **Secret Access Key**.
5. **Keep the bucket private** (no custom domain, no `r2.dev` URL) and leave `S3_UPLOAD_PUBLIC_BASE_URL` unset. The app then serves files through signed URLs and backend redirect routes (`fileUrlForKey` returns `null`). A public domain on this bucket would expose every object, including private Drive files and résumés, to anyone who has the URL.
6. Values for Step 08:
   ```env
   AWS_REGION=auto
   S3_UPLOAD_BUCKET=inboundr-uploads
   S3_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<r2-access-key-id>
   S3_SECRET_ACCESS_KEY=<r2-secret>
   ```
   `AWS_REGION` is only read by the storage config. SES uses `AWS_SES_REGION`.

### Migrating existing files from S3

Use `rclone` with two remotes (`s3` and `r2`, both `type = s3`, with `provider = AWS` and `provider = Cloudflare`):
```bash
rclone sync s3:<old-bucket> r2:inboundr-uploads --progress
```
Object keys stay the same, so the stored keys in MongoDB keep working.

## Verify

After Step 08: upload a file in **Drive**, open it, and download a ZIP export. Submit an embed form with an attachment. Check that the objects appear in the R2 bucket.

## Gotchas

- A CORS mistake looks like "upload failed" in the browser console, with nothing in the backend logs.
- Keep the bucket **private**. Only enable a custom domain if you really need permanent public URLs.

## Role in the bigger picture

This is the **file system** of the platform. Everything users attach, upload, or generate (PDF quotes and invoices, exports) lives here. Because uploads go browser → R2 directly, large files never pass through the small VM or Cloudflare's 100 MB request limit.
