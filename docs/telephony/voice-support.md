# Voice Support Runbook (OpenAI Realtime + Vobiz SIP)

This guide covers configuring inbound voice support: callers dial a phone number,
OpenAI's Realtime API answers over SIP, an AI agent handles the conversation
(knowledge-base lookups + ticket creation), and a background job pulls the call
recording from the Vobiz Recordings API and attaches it to the support ticket.

## Architecture

```
Caller ──▶ Vobiz number ──(SIP origination)──▶ OpenAI Realtime (sip.api.openai.com)
                                                     │
                                  realtime.call.incoming webhook
                                                     ▼
                         POST /api/v1/telephony/openai/webhook  (backend)
                                                     │
                          verify signature ▶ resolve org by dialed number
                                                     │
                          accept call + open realtime control WebSocket
                                                     │
                          tools: lookup_knowledge_base, create_support_ticket
                                                     │
                          on hangup: persist transcript + AI summary as a ticket
                                                     ▼
              call-recording cron (every 2 min) ▶ Vobiz Recordings API (list)
                                                     │
                  match by caller/callee number + time ▶ download ▶ S3
                                                     ▼
                          recording attached to the support ticket
```

The OpenAI webhook is mounted **before** the JSON body parser in `app.ts`
because signature verification requires the exact raw request bytes. Recordings
are not delivered by webhook; the backend polls the Vobiz Recordings API.

## Endpoints

| Purpose | Method | Path |
| --- | --- | --- |
| OpenAI realtime call webhook | `POST` | `/api/v1/telephony/openai/webhook` |
| Org voice-agent settings (app UI) | `GET`/`PATCH` | `/api/v1/support/call/settings` |
| Admin: assign org phone numbers | — | Admin → Organization page |

With `API_ORIGIN=https://api.example.com` the public webhook URL is:

- `https://api.example.com/api/v1/telephony/openai/webhook`

Recordings are pulled from Vobiz by a backend cron, so no inbound Vobiz webhook
is required.

## Environment variables

Add these to the production `.env` (see `backend/.env.production.example`):

```bash
# OpenAI Realtime (voice). Reuses the existing OPENAI_API_KEY used for embeddings.
OPENAI_API_KEY=sk-your-openai-key
OPENAI_PROJECT_ID=proj_your-project-id        # owns the realtime SIP endpoint
OPENAI_WEBHOOK_SECRET=whsec_your-webhook-secret
OPENAI_REALTIME_MODEL=gpt-realtime-2          # optional; this is the default

# Vobiz REST credentials (Recordings API: the backend polls for call recordings)
VOBIZ_AUTH_ID=your-vobiz-auth-id
VOBIZ_AUTH_TOKEN=your-vobiz-auth-token
VOBIZ_API_BASE_URL=https://api.vobiz.ai/api/v1  # optional; this is the default
```

Notes:
- `OPENAI_API_KEY` + `OPENAI_WEBHOOK_SECRET` are **required** for voice support to
  initialize (`isVoiceSupportConfigured()`); without them inbound calls are rejected.
- `VOBIZ_AUTH_ID` + `VOBIZ_AUTH_TOKEN` are **required** for the recording cron to
  list/download recordings (`isVobizConfigured()`); without them the cron is skipped.
- `SKIP_SIGNATURE_VALIDATION=true` bypasses OpenAI webhook signature checks. Use it
  only for local testing; never set it in production.

## 1. OpenAI setup (platform.openai.com)

1. Use (or create) the project whose id you put in `OPENAI_PROJECT_ID`
   (`proj_...`). The realtime SIP endpoint is scoped to this project.
2. Go to the project's **Webhooks** settings and add an endpoint:
   - URL: `https://api.example.com/api/v1/telephony/openai/webhook`
   - Subscribe to the **`realtime.call.incoming`** event.
3. Copy the webhook **signing secret** (`whsec_...`) into `OPENAI_WEBHOOK_SECRET`.
4. The backend verifies the signature with the OpenAI SDK
   (`webhooks.unwrap`), responds `200 ok` immediately, then accepts the call and
   opens the realtime control WebSocket out of band. On accept it applies the
   org's configured voice, greeting, and instruction overrides.

The agent has two tools available during the call:
- `lookup_knowledge_base` — retrieves the org's enabled knowledge articles (same
  retrieval used by the chat copilot).
- `create_support_ticket` — opens a `phone`-channel ticket, linking/creating the
  caller as a customer.

A 15-minute safety timeout hangs up runaway calls. On hangup the transcript is
persisted as ticket messages, an AI summary is generated, the `CallSession` is
completed, and owners/admins are notified.

## 2. Vobiz setup (vobiz.ai)

### a. Origination (route inbound calls to OpenAI)

Configure the number's **SIP origination URI** to point at OpenAI's realtime SIP
endpoint, using your project id as the user part:

```
proj_your-project-id@sip.api.openai.com:5061
```

(Transport TLS, port `5061`.) This is what causes OpenAI to fire the
`realtime.call.incoming` webhook for calls to that number.

### b. Trunk / number assignment

1. Provision (or port) the inbound number in Vobiz.
2. Point the number/trunk's inbound route at the OpenAI origination URI above.
3. In this app, an **admin** must assign the number to the organization:
   Admin → Organization → **Voice Support Phone Numbers** → add the number in
   E.164 form (e.g. `+14155550123`) and set it **active**. The webhook resolves
   the dialed `To` number against active `OrgPhoneNumber` records; unmapped or
   inactive numbers are rejected (SIP `404`).

### c. Recording capture (polled from the Recordings API)

1. Enable call recording on the trunk/number in Vobiz so recordings are produced.
2. No callback/webhook setup is needed. A backend cron (`call-recording-cron`,
   every 2 minutes) lists recent recordings via the Vobiz Recordings API
   (`GET /Account/{authId}/Recording/` with `X-Auth-ID`/`X-Auth-Token`).
3. Each recently completed call (within the last ~2h, recording not yet stored)
   is matched to a recording by caller/callee number (compared on the last 10
   digits to tolerate `+91`/`0` formatting) and `add_time` within the call's time
   window. If the Vobiz `call_uuid` is known it is used as an exact fast-path.
4. The matched recording is downloaded (following redirects, with the auth
   headers), uploaded to S3, and attached to the call's ticket. If no recording
   is found within ~1h the session's `recordingStatus` is marked `failed`.

## 3. Per-organization configuration (app UI)

Settings → **Support** → **Voice Agent** card:
- **Enable/disable** the voice agent for inbound calls.
- View the **connected phone numbers** assigned by an admin.
- Pick the **voice** (default `marin`).
- Set the spoken **greeting** and agent **instructions**.
- Toggle **call recording**.

These persist to `organization.preferences.supportCall` and are read by the
webhook when accepting a call. A call is only answered when the org has the
`support` feature **and** `supportCall.enabled !== false`; otherwise it is
rejected (SIP `603`).

## Verification checklist

- [ ] `OPENAI_API_KEY`, `OPENAI_PROJECT_ID`, `OPENAI_WEBHOOK_SECRET` set in prod.
- [ ] OpenAI webhook subscribed to `realtime.call.incoming`, pointing at the
      `/openai/webhook` URL.
- [ ] Vobiz origination URI = `proj_...@sip.api.openai.com:5061`.
- [ ] Number assigned + **active** for the org in Admin → Organization.
- [ ] Call recording enabled on the Vobiz trunk/number so recordings are produced.
- [ ] `VOBIZ_AUTH_ID` / `VOBIZ_AUTH_TOKEN` set so the cron can list/download recordings.
- [ ] Voice Agent enabled in Settings → Support for the org.
- [ ] Place a test call; confirm: agent answers → ticket created (channel
      `phone`) → recording attached to the ticket.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Call rejected immediately (404) | Dialed number not assigned/active for any org. |
| Call rejected (603) | Org lacks `support` feature, or Voice Agent disabled. |
| Webhook 400 "Invalid signature" | `OPENAI_WEBHOOK_SECRET` mismatch, or a proxy altered the raw body. |
| Agent never answers | `OPENAI_API_KEY`/`OPENAI_WEBHOOK_SECRET` missing; or origination URI/project id wrong. |
| No recording on ticket | `VOBIZ_AUTH_ID`/`TOKEN` missing, recording not enabled on the Vobiz trunk, the call wasn't answered, or no number/time match yet (cron retries for ~1h; check logs). |
| Recording slow to appear | Normal — the cron runs every 2 min and Vobiz needs a little time to publish the recording after a call ends. |
