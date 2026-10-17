# WhatsApp Runbook (Meta Cloud API)

This guide covers connecting WhatsApp Business numbers and what is built on
top of them. An organization can connect up to two numbers:

- The **support number** (`purpose: "primary"`) handles:
  1. **Support** — an inbound message opens (or continues) a `whatsapp`-channel
     ticket, the AI agent replies automatically when enabled, and agents answer
     from the same inbox as live chat and phone calls.
  2. **Invoices and payment reminders** — business-initiated messages that send
     the invoice PDF via Meta-approved message templates (see
     [Templates, invoices and reminders](#templates-invoices-and-reminders)).
- The **RFQ number** (`purpose: "rfq"`) is a separate number customers message
  with quotation requests. Its chats land in the RFQ owner's Inbox next to
  email, become RFQs, and quotes are sent back on WhatsApp (see
  [RFQ number](#rfq-number)).

Keeping RFQs on their own number means a support conversation is never
mistaken for an RFQ, and an RFQ chat never opens a support ticket.

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
| Org WhatsApp settings (app UI) | `GET`/`PATCH`/`DELETE` | `/api/v1/organization/whatsapp` |
| Create/refresh message templates | `POST` | `/api/v1/organization/whatsapp/templates/sync` |
| Send an invoice PDF on WhatsApp | `POST` | `/api/v1/invoices/:id/send-whatsapp` |
| RFQ number settings (app UI) | `GET`/`PATCH`/`DELETE` | `/api/v1/organization/whatsapp/rfq` |
| Create/refresh templates for the RFQ number | `POST` | `/api/v1/organization/whatsapp/rfq/templates/sync` |
| Read an RFQ chat (marks it read) | `GET` | `/api/v1/inbox/conversations/:id` |
| Reply in an RFQ chat | `POST` | `/api/v1/inbox/conversations/:id/messages` |
| Create or refresh the RFQ for a chat | `POST` | `/api/v1/inbox/conversations/:id/rfq` |
| Send a quote (email or WhatsApp, by RFQ source) | `POST` | `/api/v1/rfq/:id/send-quote` |

With `API_ORIGIN=https://api.example.com` the callback URL to paste into Meta is
`https://api.example.com/api/v1/whatsapp/webhook`.

## Connection models

Each organization stores one `WhatsAppAccount` per purpose (`primary`, `rfq`;
unique on `organizationId + purpose`) in `backend/src/models/whatsapp-account.model.ts`,
with its phone number id and an encrypted permanent access token. A phone
number id can only be connected once across the platform. Two ways to own the
Meta app that a number sits under are supported:

1. **Org brings its own Meta app** (default, zero platform config). The org
   creates a Meta app, adds the WhatsApp product, generates a System User token,
   and pastes the phone number id, token, and the app's **App secret** into
   Settings → Integrations → WhatsApp. Inboundr generates a per-org verify token to
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

# Optional; platform app id for template media uploads (orgs can set their own in the UI).
# WHATSAPP_APP_ID=1234567890

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

Settings → **Integrations** → **WhatsApp Business** (owners/admins). The
connection is organization-level and not tied to the support feature, since
invoices and payment reminders use the same number.

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

## RFQ number

### Setup

1. Register a **second phone number** in Meta (it can sit in the same WABA and
   Meta app as the support number, or a different one).
2. Settings → **Integrations** → **WhatsApp for RFQs** (owners/admins; shown
   when the org has Quotations). Connect it exactly like the support number.
   If the number sits under the same Meta app, the existing webhook already
   covers it; otherwise paste this card's Callback URL and Verify token into
   that app. Events for both numbers arrive at the same endpoint and are
   routed by `metadata.phone_number_id`.
3. Pick the **RFQ owner**. It defaults to whoever connected the number. Every
   chat on this number, and every RFQ it produces, belongs to the owner and
   shows up in their Inbox and RFQ list. Changing the owner moves existing
   chats, WhatsApp RFQs and their quotes to the new owner.
4. Click **Create & Sync Templates** on this card too. The RFQ number uses
   `inboundr_quotation` (see the template table below); templates belong to
   the WABA, so a shared WABA only creates each template once.

### How chats become RFQs

```
Customer ──▶ RFQ number ──▶ webhook ──▶ account.purpose === "rfq"
                                          │
          dedupe by wamid ▶ InboxConversation (one per customer number)
                                          │
        mirror media to S3 ▶ InboxMessage ▶ rfqDueAt = now + 60s
                                          │
     sweeper (every 15s) claims due chats ▶ open RFQ? ─ yes ▶ re-extract whole chat
                                          │ no
                       classify latest messages (+24h context) ▶ RFQ? ▶ create RFQ (source "whatsapp")
```

- **Storage.** Chats are `InboxConversation` / `InboxMessage` documents
  (channel `whatsapp`), separate from support tickets. Media is stored under
  `inbox/{org}/{conversation}/inbound/`; quote PDFs under `.../outbound/`.
- **Quiet period.** Customers usually send a request as several messages
  (text, a photo, a PDF). Each new message pushes processing back 60 seconds,
  so the whole burst is read once.
- **Open RFQ.** While the chat's RFQ is open, new messages re-extract the RFQ
  from the full chat since it started, so "also add 10 of X" updates the same
  RFQ. The RFQ closes when the quote is sent, it is marked processed, it is
  archived, or the customer has been quiet for 7 days. After that, a new
  request starts a new RFQ.
- **Classification.** With no open RFQ, the new messages are classified with
  up to 24 hours of earlier messages as context. Small talk ("thanks",
  "ok") does not create an RFQ; the reason is shown on the chat in the Inbox.
- **Attachments.** PDFs, spreadsheets and images are read like email
  attachments, and the extracted text is cached on the message. Voice notes
  are stored and playable but not transcribed.
- **Customers.** Matched by email if the customer gives one, otherwise by the
  trailing 10 digits of the phone number (only when exactly one customer
  matches). A new CRM customer is only created when the chat includes an
  email address.
- **Manual override.** In the Inbox, **Create RFQ** turns the customer's
  recent messages into an RFQ even if the classifier said no, and
  **Reprocess** re-reads the chat for an open RFQ.
- **Paused number.** With **Create RFQs** switched off (or Quotations not on
  the plan), chats are still stored and shown in the Inbox, but no RFQs are
  created.

### Inbox and replies

The Inbox lists WhatsApp chats alongside email with a **WhatsApp** label and a
channel filter (shown once an RFQ number is connected). Opening a chat sends a
read receipt for the latest customer message. Team members can reply with
text while the 24-hour window is open; after it closes the composer explains
that WhatsApp only allows replies once the customer writes again.

### Sending the quote

On a WhatsApp RFQ, **Send on WhatsApp** renders the quote PDF and sends it to
the chat:

- **Within 24 hours** of the customer's last message: the short message is
  sent as the PDF's caption (or as a text followed by the PDF when it is
  longer than 1,024 characters).
- **After 24 hours:** the `inboundr_quotation` template is used, with the PDF
  in the header. It must be **Approved** for the send to succeed.

The send is recorded as an `RFQReply` with `channel: "whatsapp"` and the
`whatsappMessageId`; a later `failed` status webhook marks the quote as failed
with Meta's reason.

## Templates, invoices and reminders

WhatsApp only lets a business start a conversation (or write after the 24-hour
window) with a **message template** that Meta has reviewed. Inboundr manages
these UTILITY templates, each with a document header carrying the PDF:

| Template | Numbers | Used by | Body variables |
| --- | --- | --- | --- |
| `inboundr_invoice` | Support, RFQ | Invoice → **WhatsApp** button, AI chat `sendInvoice` with `channel: "whatsapp"` | name, invoice no., org, amount due, due date |
| `inboundr_payment_reminder` | Support, RFQ | Hourly payment-reminder cron when the `whatsapp` channel is enabled | name, invoice no., org, "due today / N days past due", amount due, due date |
| `inboundr_quotation` | RFQ | **Send on WhatsApp** on an RFQ when the 24-hour window has closed | name, quote reference, org |

Invoices and reminders are sent from the support number, falling back to the
RFQ number when it is the only one connected.

Definitions live in `backend/src/services/whatsapp-template.service.ts`
(`WHATSAPP_TEMPLATE_CATALOG`). Changing body text requires creating a new
template version on Meta's side; bump the template name if you edit it.

### Setting up templates

1. In Settings → Integrations → WhatsApp, make sure the **WhatsApp Business Account
   ID** is filled in. Add the **Meta App ID** as well unless `WHATSAPP_APP_ID`
   is set on the backend (the Resumable Upload API used for the PDF sample
   needs an app id).
2. Click **Create & Sync Templates**. Inboundr uploads a sample PDF, creates
   any missing templates via `POST /{waba_id}/message_templates`, and stores
   each template's status on `WhatsAppAccount.templates`.
3. Statuses update automatically through the `message_template_status_update`
   webhook field (subscribe to it alongside `messages`), or manually via
   **Refresh Status**. Sends are refused until the relevant template is
   **Approved**.

Template sync also runs best-effort whenever credentials are saved with a WABA
id present.

### Sending an invoice

Invoice detail page → **WhatsApp** (next to Send). Works for drafts (marks the
invoice sent) and already-sent invoices (re-share). The PDF is rendered, stored
under `invoices/{org}/{invoiceId}/whatsapp/` in S3, and passed to Meta as a
presigned link in the template header. Each send is logged in
`Invoice.whatsappSends` and appears in the activity timeline.

Recipient resolution: `customerSnapshot.contactNumber` is parsed with
`libphonenumber-js` using `IN` as the default country, so `98765 43210`,
`09876543210` and `+91 98765 43210` all resolve to `+919876543210`. Invalid or
missing numbers return a `400` with a clear message.

### Payment reminders

Settings → Notifications → Payment Reminders now has **Channels** (Email,
WhatsApp). Each due offset is sent on every enabled channel that can reach the
customer; one `Invoice.reminders` entry is logged per channel with
`channel` and `whatsappMessageId`/`gmailMessageId`. An offset counts as sent if
at least one channel succeeded. WhatsApp reminders are skipped (with a log
line) when the account is not connected, the template is not approved, or the
invoice has no valid mobile number.

Organizations saved before channels existed behave as email-only.

## Verification checklist

- [ ] `TOKEN_ENCRYPTION_SECRET` set in the backend `.env`.
- [ ] Number connected in Settings → Integrations → WhatsApp (status **Connected**).
- [ ] Callback URL + verify token saved in Meta; `messages` field subscribed.
- [ ] Test message creates a `whatsapp` ticket; bot reply arrives on the phone.
- [ ] Agent reply from the inbox arrives on the phone and shows **Delivered**.
- [ ] (RFQ number) A product request sent to the RFQ number appears in the owner's Inbox and becomes an RFQ about a minute later.
- [ ] (RFQ number) **Send on WhatsApp** delivers the quote PDF; `inboundr_quotation` is **Approved** for sends after 24 hours.

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
| Template shows **Not created** with "Add the Meta App ID…" | Neither the account nor `WHATSAPP_APP_ID` has an app id; the sample-PDF upload needs one. |
| Template **Rejected** | Meta's reason is shown under the template. Common causes: business not verified, or category disagreement. Fix in Meta Business Suite → Message templates, then **Refresh Status**. |
| Invoice **WhatsApp** button returns "template is not approved yet" | Wait for Meta's review (minutes to hours) and refresh status; sends are blocked until **Approved**. |
| Invoice **WhatsApp** button returns "not a valid mobile number" | `customerSnapshot.contactNumber` is a landline, has extra digits, or a non-Indian number without a `+country` prefix. Fix the customer's contact number. |
| Reminder cron logs "WhatsApp payment reminders skipped" | Account disconnected/paused or `inboundr_payment_reminder` not approved; email reminders still go out if enabled. |
| RFQ number chats show in the Inbox but no RFQ is created | **Create RFQs** is off, the org lacks Quotations, or the classifier decided the messages were not a request (the reason shows on the chat). Use **Create RFQ** to override. |
| RFQ number messages open support tickets instead | The number is connected on the **WhatsApp Business** (support) card. Disconnect it there and connect it under **WhatsApp for RFQs**. |
| RFQ chats are missing from everyone's Inbox | Chats belong to the RFQ owner. If the owner left the organization, pick a new owner on the RFQ card; existing chats and RFQs move with it. |
| **Send on WhatsApp** fails with "WhatsApp needs the approved "inboundr_quotation" template" | The customer's 24-hour window closed and `inboundr_quotation` is not **Approved** yet. Sync templates on the RFQ card and wait for Meta's review, or ask the customer to message first. |

## Local testing

Expose the backend with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`)
and set `API_ORIGIN` to the tunnel URL so the Settings card shows the right
callback URL. Meta's **API Setup** page has a "Send test message" button to
trigger a status webhook, and any message from a test-recipient number
triggers the full inbound flow. To replay a captured payload without a valid
signature, set `SKIP_SIGNATURE_VALIDATION=true` locally and `curl -X POST` the
JSON to `/api/v1/whatsapp/webhook`.
