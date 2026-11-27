# Step 08 — Deploy the backend on the VM

**Sequence:** 08 of 12 · **Depends on:** 01–07 · **Blocks:** 09, 10, 11

## What part of the project this step deploys

**`backend/`**: the Bun + Express 5 API (`backend/src/server.ts`), its two WebSocket servers (`/api/v1/support/ws`, `/api/v1/notifications/ws`), the cron jobs and workers. It runs as the systemd service `inboundr-backend` behind Nginx at `https://api.yourdomain.com`.

## What to use

- **Bun** (runtime), **systemd** (process manager; reuses `docs/deployment/inboundr-backend.service`)
- **Nginx** (reverse proxy; use the new `deploy/config/nginx-inboundr-backend.conf`, which adds WebSocket, streaming and Cloudflare real-IP handling that the old config in `docs/deployment` is missing)
- **Cloudflare Origin CA certificate** (free, 15-year cert trusted by Cloudflare; no certbot renewals)

## How to do it

### 1. Give the VM read access to the repo

```bash
ssh-keygen -t ed25519 -C "inboundr-vm" -f ~/.ssh/inboundr_repo -N ""
cat ~/.ssh/inboundr_repo.pub
```
GitHub → `orangewood-co/inboundr` → **Settings → Deploy keys → Add** (read-only) → paste the key.
```bash
cat >> ~/.ssh/config <<'CFG'
Host github.com
  IdentityFile ~/.ssh/inboundr_repo
  IdentitiesOnly yes
CFG
cd /home/ubuntu
git clone git@github.com:orangewood-co/inboundr.git inboundr
cd inboundr && bun install --frozen-lockfile
```

### 2. Create `backend/.env`

```bash
cp backend/.env.production.example backend/.env && chmod 600 backend/.env && nano backend/.env
```

| Group | Variables | Source |
|-------|-----------|--------|
| Runtime | `PORT=3000`, `NODE_ENV=production` | — |
| Origins | `FRONTEND_ORIGIN=https://app.yourdomain.com`, `API_ORIGIN=https://api.yourdomain.com`, `EMBED_ORIGIN=https://forms.yourdomain.com`, `LANDING_ORIGIN=https://yourdomain.com` | Step 01. All four are **required** in production (`origins.config.ts` throws otherwise) |
| Auth | `BETTER_AUTH_URL=https://api.yourdomain.com`, `BETTER_AUTH_SECRET`, `TOKEN_ENCRYPTION_SECRET`, `OAUTH_STATE_SECRET`, `LINK_ANALYTICS_SECRET`, `RECRUITMENT_UPLOAD_SESSION_SECRET`, `SUPER_ADMIN_EMAILS`, `ORGANIZATION_LIMIT` | Generate each secret with `openssl rand -base64 48` |
| MongoDB | `MONGODB_URI` | Step 02 |
| Postgres | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PGSSLMODE=require` | Step 03 |
| Storage | `AWS_REGION=auto`, `S3_UPLOAD_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_UPLOAD_PUBLIC_BASE_URL` | Step 04 (needs the code change described there) |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI=https://api.yourdomain.com/api/v1/gmail/callback`, `GMAIL_PUBSUB_TOPIC` | Step 05 |
| Email | `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Step 06 |
| Bot check | `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Step 01 |
| AI (paid) | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `CHAT_MODEL`, `CHAT_TITLE_MODEL`, `RECRUITMENT_RANKING_MODEL`, `OPENAI_API_KEY` | OpenRouter / OpenAI dashboards |
| Optional | Voice (`OPENAI_PROJECT_ID`, `OPENAI_WEBHOOK_SECRET`, `VOBIZ_*`), WhatsApp (`WHATSAPP_*`) | `docs/telephony`, `docs/whatsapp` |

**Moving from an existing deployment?** Copy `BETTER_AUTH_SECRET` and `TOKEN_ENCRYPTION_SECRET` from the old `.env` unchanged. New values would log everyone out and make stored Gmail/WhatsApp tokens impossible to decrypt.

### 3. TLS certificate (Cloudflare Origin CA)

Cloudflare → **SSL/TLS → Origin Server → Create Certificate** (RSA, hostnames `api.yourdomain.com`, 15 years). Then:
```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/origin.pem   # paste the certificate
sudo nano /etc/ssl/cloudflare/origin.key   # paste the private key
sudo chmod 600 /etc/ssl/cloudflare/origin.key
```

### 4. Nginx

```bash
# Trust Cloudflare's edge IPs so $remote_addr becomes the real visitor IP (used by Better Auth rate limiting)
{ for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"; done; } | sudo tee /etc/nginx/cloudflare-realip.conf

sudo cp deploy/config/nginx-inboundr-backend.conf /etc/nginx/sites-available/inboundr-backend
sudo sed -i 's/api.yourdomain.com/api.<your real domain>/g' /etc/nginx/sites-available/inboundr-backend
sudo ln -sf /etc/nginx/sites-available/inboundr-backend /etc/nginx/sites-enabled/inboundr-backend
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 5. DNS record for the API

Cloudflare → **DNS → Add record**: `A`, name `api`, IPv4 `<VM_PUBLIC_IP>`, **Proxied** (orange cloud).

### 6. One-time database migrations

```bash
cd /home/ubuntu/inboundr
bun run --cwd backend migrate:catalog     # idempotent; needs the products table restored in Step 03
```

### 7. Start the service

**If an old backend is running elsewhere (EC2), stop it first** (`sudo systemctl stop inboundr-backend` there). Two instances would both process Gmail push messages and cron jobs, which causes duplicate replies and reminders.
```bash
sudo cp docs/deployment/inboundr-backend.service /etc/systemd/system/inboundr-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now inboundr-backend
journalctl -u inboundr-backend -f      # expect "Server running on port 3000", "Knowledge (RAG) schema ready", "Gmail watcher initialized"
```

## Verify

```bash
curl --fail http://127.0.0.1:3000/health            # on the VM
curl --fail https://api.yourdomain.com/health       # from anywhere, through Cloudflare
curl -sI https://api.yourdomain.com/health | grep -i server   # "cloudflare"
```
WebSocket check, from a laptop with `bunx wscat`:
`bunx wscat -c wss://api.yourdomain.com/api/v1/notifications/ws`. The connection should upgrade; an auth rejection is fine, a 400/502 is not.

## Gotchas

- `502 Bad Gateway`: the service isn't running. Check `journalctl -u inboundr-backend -n 100`.
- `525/526` from Cloudflare: the origin cert is missing or the SSL mode isn't *Full (strict)*.
- Startup crash `... environment variable must be set in production`: one of the four origin variables is missing.
- The service uses `EnvironmentFile=` and `dotenv`. Don't put quotes or `export` in `.env` values that systemd would misread.

## Role in the bigger picture

This is the **API, AI and real-time hub** that every frontend talks to. It owns auth, all data access, the RFQ → quote agents, the AI assistant, invoicing, Gmail/SES email, file presigning, live support chat and every scheduled job. Once it's healthy, the platform's logic is live. The remaining steps automate it (09), put the UIs in front of it (10) and connect the external services to it (11).
