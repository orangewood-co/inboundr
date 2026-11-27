# Step 06 — Transactional email (AWS SES)

**Sequence:** 06 of 12 · **Depends on:** 01 (DNS for DKIM) · **Blocks:** 08

## What part of the project this step deploys

The **system email sender of `backend/`** (`backend/src/lib/email.ts`, React Email templates in `backend/src/emails/`): hourly digest emails, notifications, invites and other no-reply mail. Quote replies and invoice/reminder sends go through the **user's Gmail** (Step 05), not SES.

## What to use

- **AWS SES** (free allowance for the first 12 months, then about $0.10 per 1,000 emails). No code change is needed.

## How to do it

1. AWS console → pick a region (e.g. **ap-south-1**) → **Amazon SES**.
2. **Identities → Create identity → Domain** `yourdomain.com`, with **Easy DKIM** (RSA 2048).
3. Add the 3 DKIM CNAME records SES shows to Cloudflare DNS as **DNS only** (grey cloud). Optionally add a custom MAIL FROM (`mail.yourdomain.com`: MX + SPF TXT) and a DMARC TXT record (`_dmarc`).
4. Wait until the identity status is **Verified**.
5. **Account dashboard → Request production access**, so you can send to unverified recipients. Until it's approved you can only send to verified addresses.
6. **IAM → Users → Create user** `inboundr-ses` (no console access). Attach an inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }]
   }
   ```
   Create an **access key** (use case: application running outside AWS).
7. Values for Step 08:
   ```env
   AWS_SES_REGION=ap-south-1
   AWS_SES_FROM_EMAIL=no-reply@yourdomain.com
   AWS_ACCESS_KEY_ID=<inboundr-ses key id>
   AWS_SECRET_ACCESS_KEY=<inboundr-ses secret>
   ```
   On EC2 an instance role used to provide credentials. On Oracle there is none, so the keys must be in `backend/.env`.

## Verify

From the SES console use **Send test email** to a verified address. After Step 08, trigger a digest or invite and check the backend logs for send errors.

## Gotchas

- Keep these AWS keys limited to SES. R2 uses its own `S3_*` keys (Step 04), so the two don't collide.
- If you're already verified and out of the sandbox on SES, reuse that identity. Only create the IAM user/keys.

## Role in the bigger picture

This is the platform's **outbound voice** for system messages, such as the digests and alerts that bring users back to the app. Customer-facing conversations stay on Gmail threads.
