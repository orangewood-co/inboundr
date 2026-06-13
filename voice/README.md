# Inboundr Voice Agent

LiveKit agent worker that answers inbound phone calls for organizations. Calls arrive via a Vobiz SIP trunk, route into a LiveKit room, and this worker is dispatched as the org's AI receptionist: it answers questions about the business and its products, and the backend logs the call (transcript, summary, extracted lead) into the CRM.

```text
Phone caller → Vobiz number/trunk → LiveKit SIP (dispatch rule) → this worker
                                                                      │
                              Inboundr backend ◄── internal API ──────┘
                       (config lookup, product search, call records)
```

This package runs on **Node 22+** (the `@livekit/agents` SDK requirement), unlike the rest of the monorepo which uses Bun. Dependencies are still installed with `bun install` at the repo root.

## One-time setup (Phase 1)

### 1. LiveKit Cloud

1. Create a project at [LiveKit Cloud](https://cloud.livekit.io/).
2. From **Settings > API Keys** copy `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` into `voice/.env.local` (see `.env.example`).
3. From **Settings > Project** copy the **SIP URI** (looks like `sip:xxxxxxxx.sip.livekit.cloud`) — needed in step 2.3 below.

### 2. Vobiz

1. In the [Vobiz Console](https://console.vobiz.ai/), go to **SIP Trunk > Outbound Trunks > Trunks**, create a trunk with a credential, and note the SIP domain / username / password (only needed later for outbound or SIP transfer).
2. Buy a phone number (used as the inbound number callers dial).
3. Point the trunk's inbound destination at LiveKit — **strip the `sip:` prefix**:

```text
PATCH https://api.vobiz.ai/api/v1/Account/{auth_id}/trunks/{trunk_id}
{ "inbound_destination": "xxxxxxxx.sip.livekit.cloud" }
```

### 3. LiveKit telephony config

1. **Telephony > Trunks > Create new trunk > Inbound**:
   - Phone Numbers: your Vobiz number in E.164 (e.g. `+918071387434`)
   - Allowed Addresses: `0.0.0.0/0` to start (tighten to Vobiz IPs in production)
2. **Telephony > Dispatch Rules > Create new dispatch rule**:
   - Rule Type: **Individual**, Room Prefix: `call-`
   - Match Trunks: the inbound trunk from the previous step
   - Agent dispatch > Agent Name: `inboundr-voice` (must match `VOICE_AGENT_NAME` exactly)

### 4. Backend pairing

Set the same shared secret on both sides:

- `backend/.env`: `VOICE_INTERNAL_API_KEY=<long random secret>`
- `voice/.env.local`: `VOICE_INTERNAL_API_KEY=<same secret>` and `BACKEND_URL=<backend origin>`

Then, as a platform admin, assign the purchased number to an organization (Super Admin > Phone Numbers) and have the org fill in its agent settings (Calls > Agent Settings).

## Running

```console
bun install                 # from the repo root
cd voice
npm run download-files      # one-time: Silero VAD + turn-detector models
npm run dev                 # development
npm run start               # production
```

Run scripts with npm/node (not bun) — the agents SDK needs the Node runtime.

### Testing without a phone

Set `VOICE_DEFAULT_NUMBER` in `voice/.env.local` to a number assigned in the admin panel, then connect from the [LiveKit Agents playground](https://agents-playground.livekit.io/). The worker treats web sessions as calls to that number.

### Phase 1 exit criterion

Call the Vobiz number from a real phone and hold a conversation with the agent. If the call connects but no agent joins, check that the worker is running and the dispatch rule's agent name matches `VOICE_AGENT_NAME`.

## Call recording (optional)

When the four `VOICE_RECORDING_S3_*` variables are set, the worker starts an audio-only room-composite egress per call, uploading OGG audio to `voice-recordings/<orgId>/<year>/<month>/<room>.ogg` in your bucket. The backend serves playback via presigned URLs. Without these variables, calls work normally but are not recorded.

## Production deployment

Deployed as a second systemd service (`inboundr-voice`) on the same EC2 instance as the backend.

One-time on the EC2 box (Node 22+ must be installed, e.g. `sudo apt install -y nodejs` from NodeSource):

```bash
cd /home/ubuntu/inboundr/voice
cp .env.example .env && nano .env && chmod 600 .env
bun run build && npm run download-files
sudo cp /home/ubuntu/inboundr/docs/deployment/inboundr-voice.service /etc/systemd/system/inboundr-voice.service
sudo systemctl daemon-reload && sudo systemctl enable --now inboundr-voice
journalctl -u inboundr-voice -f
```

After that, `scripts/deploy/ec2-deploy.sh` (run by the backend GitHub workflow) rebuilds and restarts the service on every deploy. If the unit is not installed, the deploy script skips it.
