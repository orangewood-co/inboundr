# WhatsApp Support Runbook (Meta Cloud API)

This guide covers connecting a WhatsApp Business number so customer messages
become support conversations: an inbound message opens (or continues) a
`whatsapp`-channel ticket, the AI agent replies automatically when enabled, and
agents answer from the same inbox as live chat and phone calls.

## Architecture

```
Customer ──▶ WhatsApp ──▶ Meta Cloud API
                              │
                webhook: object=whatsapp_business_account, field=messages
                              ▼
              POST /api/v1/whatsapp/webhook  (backend, raw body)
                              │
       verify X-Hub-Signature-256 ▶ resolve org by metadata.phone_number_id
                              │
     dedupe by wamid ▶ find/create ticket by requester.phoneNumber
                              │
     mirror media to S3 ▶ TicketMessage (visitor) ▶ WebSocket broadcast
                              │
        mark as read (+typing) ▶ bot reply (if AI autonomous) ▶ send via API
                              │
   statuses (sent/delivered/read/failed) ▶ TicketMessage.deliveryStatus ▶ broadcast

Agent reply (WebSocket `agent_message` or approved AI draft)
                              │
              deliverTicketMessageViaWhatsApp ▶ POST /{phone_number_id}/messages
```

The webhook is mounted **before** the JSON body parser in `app.ts` because
signature verification requires the exact raw request bytes.

## Endpoints

| Purpose | Method | Path |
| --- | --- | --- |
| Meta webhook verification handshake | `GET` | `/api/v1/whatsapp/webhook` |
| Meta inbound events | `POST` | `/api/v1/whatsapp/webhook` |
| Org WhatsApp settings (app UI) | `GET`/`PATCH`/`DELETE` | `/api/v1/support/whatsapp/settings` |

With `API_ORIGIN=https://api.example.com` the callback URL to paste into Meta is
`https://api.example.com/api/v1/whatsapp/webhook`.

## Connection models

Each organization stores one `WhatsAppAccount` (`backend/src/models/whatsapp-account.model.ts`)
with its phone number id and an encrypted permanent access token. Two ways to
own the Meta app that the number sits under are supported:

1. **Org brings its own Meta app** (default, zero platform config). The org
   creates a Meta app, adds the WhatsApp product, generates a System User token,
   and pastes the phone number id, token, and the app's **App secret** into
   Settings → Support → WhatsApp. Inboundr generates a per-org verify token to
   paste into Meta's webhook config. Signatures are verified with that org's
   app secret.
2. **Platform-owned Meta app.** Set `WHATSAPP_APP_SECRET` and
   `WHATSAPP_VERIFY_TOKEN` in the backend `.env`. Orgs only provide their phone
   number id + token; the app secret field is hidden. One webhook subscription
   on the platform app receives events for every connected WABA. If the org
   provides its WABA id, the backend calls `POST /{waba_id}/subscribed_apps`
   on connect.

Both can coexist: verification tries the per-account secret first, then the
platform secret.

## Environment variables

```bash
# Required: encrypts stored access tokens (also used for Gmail tokens).
TOKEN_ENCRYPTION_SECRET=generate-a-long-random-secret

# Optional; only for the platform-owned app model.
# WHATSAPP_APP_SECRET=your-meta-app-secret          # App settings → Basic → App secret (32 hex chars, NOT an EAA… access token)
# WHATSAPP_VERIFY_TOKEN=any-random-string           # alias: WHATSAPP_WEBHOOK_VERIFY_TOKEN

# Optional; Graph API version (default v23.0).
WHATSAPP_GRAPH_API_VERSION=v23.0

# Local testing only: skips signature verification. Never set in production.
# SKIP_SIGNATURE_VALIDATION=true
```

## 1. Meta setup (developers.facebook.com)

1. Create (or open) a Meta app of type **Business** and add the **WhatsApp**
   product.
2. In **WhatsApp → API Setup**, note the **Phone number ID** and the
   **WhatsApp Business Account ID**. Add and verify the business phone number
   (test numbers work for development).
3. Create a **System User** in Meta Business Suite → Business settings → Users,
   assign it the WhatsApp app with full control, and generate a **permanent
   token** with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. (Bring-your-own-app only) Copy the **App secret** from
   App settings → Basic.

## 2. Connect in Inboundr

Settings → **Support** → **WhatsApp** (owners/admins):

1. Paste the Phone number ID, optional WABA ID, the permanent token, and (if
   shown) the App secret. Click **Connect WhatsApp**. The backend validates the
   token by reading the number's profile (`GET /{phone_number_id}`) before
   saving — a bad token fails here, not on the first customer message.
2. The card then shows the **Callback URL** and **Verify token** to paste into
   Meta: WhatsApp → Configuration → Webhook → Edit. Click **Verify and save**,
   then subscribe to the **`messages`** field.
3. Send a WhatsApp message to the business number. A conversation appears in
   Support with the WhatsApp badge; if the AI agent is enabled the bot replies
   on WhatsApp within a few seconds.

The **Accept messages** switch pauses inbound processing without disconnecting
(webhooks are acknowledged and dropped). **Disconnect** deletes the stored
credentials; existing tickets remain.

## Behaviour notes

- **Threading.** Messages from a number continue its open/pending ticket. A
  resolved/closed ticket is reopened if the customer writes within 24h of the
  last activity; otherwise a new ticket is created.
- **Identity.** `requester.phoneNumber` holds the customer's number as `+E.164`.
  Customers are auto-linked when exactly one CRM customer's `contactNumber`
  matches on the trailing 10 digits. The customer-picker in the context panel
  also suggests phone matches.
- **Media.** Images, video, audio/voice notes, documents and stickers are
  downloaded from Meta and stored in S3 under `support/{org}/{ticket}/visitor/`,
  then shown inline like chat attachments. Locations and contact cards are
  rendered as text.
- **Delivery status.** Outbound messages show Sending → Sent → Delivered → Read
  under the bubble (from Meta status webhooks). Failures show the Meta reason
  inline (e.g. outside the 24h window, invalid token). A `read` status also
  updates the ticket's `lastVisitorReadAt`.
- **24-hour window.** Meta only accepts free-form business messages within 24h
  of the customer's last message. The composer shows a warning when the window
  has closed; sends still attempt and surface Meta's rejection (error 131047)
  on the message. Template messages are not implemented yet.
- **Read receipts.** Each inbound message is marked read (blue ticks) once
  stored; when the bot is about to reply, a typing indicator is shown too.
- **AI modes** (`autonomous` / `review` / `paused`) and AI drafts behave exactly
  as for live chat; approving a draft relays it to WhatsApp.
- **Idempotency.** Meta retries webhooks. Inbound messages are deduplicated on
  `TicketMessage.externalId` (the `wamid`), enforced by a unique partial index
  per organization.
- **Notifications.** Owners/admins get a `support.new_chat` notification titled
  "New WhatsApp conversation" for each new ticket.

## Verification checklist

- [ ] `TOKEN_ENCRYPTION_SECRET` set in the backend `.env`.
- [ ] Number connected in Settings → Support → WhatsApp (status **Connected**).
- [ ] Callback URL + verify token saved in Meta; `messages` field subscribed.
- [ ] Test message creates a `whatsapp` ticket; bot reply arrives on the phone.
- [ ] Agent reply from the inbox arrives on the phone and shows **Delivered**.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Meta says "The callback URL or verify token couldn't be validated" | Verify token mismatch, or the backend is not reachable from the internet on `API_ORIGIN`. |
| Backend logs `Invalid WhatsApp webhook signature` | App secret mismatch (per-account or `WHATSAPP_APP_SECRET`), or a proxy altered the raw body. |
| Backend logs `WhatsApp webhook for unknown phone_number_id` | The number is not connected to any org, or the phone number id was mistyped. |
| Messages arrive but no ticket | Org lacks the `support` feature, is suspended, or **Accept messages** is off. |
| Agent replies show **Not delivered · … 24 hours** | Customer-service window closed (Meta error 131047). Wait for the customer or use a template. |
| Agent replies show **Not delivered · … token is invalid** | Token expired/revoked. Update credentials in Settings. The account status flips to **Needs attention**. |
| Media shows as `[image could not be downloaded from WhatsApp]` | Token lacks `whatsapp_business_messaging`, or media exceeded 100 MB. |
| Bot never replies on WhatsApp | AI Agent disabled for the org, ticket in Review/Paused mode, or the ticket was escalated (attachment / "talk to a human"). |

## Local testing

Expose the backend with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`)
and set `API_ORIGIN` to the tunnel URL so the Settings card shows the right
callback URL. Meta's **API Setup** page has a "Send test message" button to
trigger a status webhook, and any message from a test-recipient number
triggers the full inbound flow. To replay a captured payload without a valid
signature, set `SKIP_SIGNATURE_VALIDATION=true` locally and `curl -X POST` the
JSON to `/api/v1/whatsapp/webhook`.
