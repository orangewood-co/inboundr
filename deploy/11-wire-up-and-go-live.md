# Step 11 — Wire-up and go-live

**Sequence:** 11 of 12 · **Depends on:** 01–10 · **Blocks:** 12

## What part of the project this step deploys

No new hosting. This step **connects the deployed parts to each other and to outside services**, moves live data across if you're migrating, and runs an end-to-end smoke test of the whole platform.

## What to use

Cloudflare DNS, Google Cloud console, the provider dashboards, and a browser.

## How to do it

### 1. Final DNS map (Cloudflare)

| Name | Type | Target | Proxy |
|------|------|--------|-------|
| `api` | A | Oracle VM public IP | Proxied |
| `app` | CNAME | `inboundr-app.pages.dev` (auto-created) | Proxied |
| `forms` | CNAME | `inboundr-embed.pages.dev` (auto-created) | Proxied |
| `@` / `www` | CNAME | `inboundr-landing.pages.dev` (auto-created) | Proxied |
| `files` (optional) | R2 custom domain | `inboundr-uploads` | Proxied |
| SES DKIM / MAIL FROM / DMARC | CNAME / MX / TXT | from SES | **DNS only** |

### 2. Point external services at the new API

- **Google OAuth client**: both redirect URIs from Step 05 are present.
- **Pub/Sub push subscription**: create it (or edit the existing one) → endpoint `https://api.yourdomain.com/api/v1/email/webhook`.
- **Voice (optional)**: OpenAI project webhook → `https://api.yourdomain.com/api/v1/telephony/openai/webhook` (see `docs/telephony/voice-support.md`).
- **WhatsApp (optional)**: Meta app webhook → `https://api.yourdomain.com/api/v1/whatsapp/webhook` with your `WHATSAPP_VERIFY_TOKEN` (see `docs/whatsapp/whatsapp-support.md`).
- **R2 CORS**: allowed origins exactly match `https://app.yourdomain.com` and `https://forms.yourdomain.com`.

### 3. Cutover (only if migrating from the old AWS setup)

1. A day before: lower the TTL of the old DNS records, and do a trial dump/restore (Steps 02–04) to measure how long it takes.
2. Announce a short maintenance window.
3. **Stop the old backend** (`sudo systemctl stop inboundr-backend` on EC2) so no more writes or Gmail processing happen there.
4. Final `mongodump`/`mongorestore` and `pg_dump`/`pg_restore` (skip whichever stays on the same provider), plus a final `rclone sync` of S3 → R2.
5. Start or restart the backend on Oracle (`sudo systemctl restart inboundr-backend`). On boot it re-registers Gmail watches and catches up the mailbox history.
6. Switch DNS and the Pub/Sub endpoint to the new targets (sections 1–2).
7. Keep the old EC2/S3/CloudFront resources **stopped but not deleted** for a week, then remove them and the old GitHub secrets.

### 4. End-to-end smoke test

| Check | Proves |
|-------|--------|
| Sign in with Google at `app.` | OAuth, Better Auth cookies, CORS, MongoDB |
| Products page lists the catalog, search works | Postgres via the Supabase pooler |
| Connect Gmail in Settings, send an RFQ-style email to it, see it in **Inbox** with an RFQ badge, then a draft in **Quotes** | Gmail API, Pub/Sub push, AI agents (OpenRouter), Postgres matching |
| Approve and send the quote; the reply lands on the original thread | Gmail send |
| Upload and download a file in **Drive** | R2 presigned URLs and CORS |
| Open a public form on `forms.` and submit it with an attachment | Embed app, Turnstile, R2, submission flow |
| Open the support widget, send a message, and reply from the dashboard in real time | WebSockets through Cloudflare → Nginx |
| AI chat (`/chat`) streams an answer token by token | `proxy_buffering off`, OpenRouter |
| Create and send an invoice PDF | pdfkit on ARM, Gmail send |
| Invite a teammate / receive a digest email | SES |
| Landing contact form submits | `LANDING_ORIGIN` CORS |

Check `journalctl -u inboundr-backend -f` during the test. There should be no unhandled errors.

## Verify

Every row of the smoke test passes, and the first hourly cron run (`payment-reminder`, `digest`, `crm-activity-reminder`) logs without errors.

## Gotchas

- Pub/Sub keeps retrying undelivered pushes (7-day retention by default), so after downtime a backlog arrives at once. The reconciliation cron (`email-reconciliation-cron.ts`) and the boot-time history catch-up also cover any gaps.
- Cloudflare closes WebSockets that are idle for about 100 seconds. Both WS services have heartbeats, so if connections drop at regular intervals, check those first.

## Role in the bigger picture

This is the step where the separate pieces become **one working product**: each frontend reaches the API, the API reaches every data store and provider, and outside systems (Gmail, Meta, OpenAI) know where to call in. The smoke test confirms the main loop works end to end: inbound email → AI quote → reply → invoice → payment reminder.
