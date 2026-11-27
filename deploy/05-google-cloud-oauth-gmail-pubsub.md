# Step 05 — Google Cloud: OAuth, Gmail API, Pub/Sub

**Sequence:** 05 of 12 · **Depends on:** 01 (domain known) · **Blocks:** 08, 11

## What part of the project this step deploys

The **Google integrations of `backend/`**:
- **Google sign-in** through Better Auth (`socialProviders.google` in `backend/src/lib/auth.ts`).
- **Gmail connect** (OAuth at `/api/v1/gmail/callback`, scopes `gmail.readonly` and `gmail.send`) for inbox sync, replying to quotes on the original thread, and invoice/reminder sends.
- **Gmail push notifications**: `gmail.users.watch` publishes to a Pub/Sub topic, and Pub/Sub pushes to `POST /api/v1/email/webhook`. That is the start of the RFQ pipeline.

## What to use

- **Google Cloud** project (free). Pub/Sub's free quota (10 GB/month) is far more than Gmail notifications use. A billing account may be required to enable Pub/Sub, but usage stays $0.

## How to do it

1. https://console.cloud.google.com → create a project `inboundr-prod`. Note the **Project ID**.
2. **APIs & Services → Library** → enable **Gmail API** and **Cloud Pub/Sub API**.
3. **OAuth consent screen**:
   - User type: **Internal** if only your Google Workspace users will connect. Otherwise **External**.
   - App domain / authorized domains: `yourdomain.com`.
   - Scopes: `openid`, `email`, `profile`, `.../auth/gmail.readonly`, `.../auth/gmail.send`.
4. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - Authorized JavaScript origins: `https://app.yourdomain.com`, `https://api.yourdomain.com`
   - Authorized redirect URIs:
     - `https://api.yourdomain.com/api/auth/callback/google` (Better Auth sign-in)
     - `https://api.yourdomain.com/api/v1/gmail/callback` (Gmail connect; must equal `GMAIL_OAUTH_REDIRECT_URI`)
   - Save `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Pub/Sub → Topics → Create topic** `gmail-inbound`. Its full name is `projects/<PROJECT_ID>/topics/gmail-inbound` (= `GMAIL_PUBSUB_TOPIC`).
6. On the topic → **Permissions → Add principal** `gmail-api-push@system.gserviceaccount.com` with role **Pub/Sub Publisher**. Without this, `users.watch` fails.
7. **Create subscription** on the topic. Do this in Step 11, once `api.yourdomain.com` is live:
   - Delivery type: **Push**
   - Endpoint: `https://api.yourdomain.com/api/v1/email/webhook`
   - Acknowledgement deadline: 60 s. Retry policy: exponential backoff.

The backend registers and renews Gmail watches itself (`startWatchesForConnectedAccounts`, `scheduleWatchRenewal`). You don't need any manual `watch` calls.

## Verify

After Step 11: connect a Gmail account in **Settings**, send a test email to it, and look for `Gmail Notification: <email>, historyId: ...` in `journalctl -u inboundr-backend`.

## Gotchas

- **External + Testing mode**: only listed test users can connect, and **refresh tokens expire after 7 days**. Gmail sync will silently stop. `gmail.readonly` is a *restricted* scope, so publishing an External app requires Google verification (and possibly a security assessment). Use **Internal** if you can.
- If you are moving from an existing deployment, you can keep the existing OAuth client and topic. Just add the new redirect URIs and point the push subscription at the new API.
- The webhook endpoint currently doesn't check who is calling it. Optionally, turn on Pub/Sub push authentication later.

## Role in the bigger picture

This is the **input pipe of the quoting engine**. An inbound RFQ email triggers Gmail → Pub/Sub → backend webhook → LangGraph agents → drafted quote → reply sent through Gmail. It also gives users one-click Google sign-in.
