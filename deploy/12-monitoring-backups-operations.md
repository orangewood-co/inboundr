# Step 12 — Monitoring, backups and day-2 operations

**Sequence:** 12 of 12 · **Depends on:** 11 · **Blocks:** nothing (ongoing)

## What part of the project this step deploys

**Operational safety nets for everything deployed in Steps 02–10**: uptime alerts, log limits, nightly database backups to R2, and runbooks for common tasks. The only new files go on the VM (a backup script and cron entry), not into the app.

## What to use

- **UptimeRobot Free** (50 monitors, 5-minute checks, email alerts), or Better Stack's free tier.
- **cron + `mongodump` + `pg_dump` + `rclone`** on the VM for backups to Cloudflare R2 (same free 10 GB bucket quota).
- **journald** for logs, and the **Oracle budget alert** from Step 07.

## How to do it

### 1. Uptime monitoring

Create HTTP(S) monitors for:
- `https://api.yourdomain.com/health` (keyword or status 200)
- `https://app.yourdomain.com`, `https://forms.yourdomain.com`, `https://yourdomain.com`

Send alerts to the team email (and Slack if you connect it).

### 2. Log retention on the VM

```bash
sudo sed -i 's/^#\?SystemMaxUse=.*/SystemMaxUse=500M/' /etc/systemd/journald.conf
sudo systemctl restart systemd-journald
```
Useful commands: `journalctl -u inboundr-backend -f`, `journalctl -u inboundr-backend --since "1 hour ago" -p err`.

### 3. Nightly backups to R2

1. Install the tools: `mongodump` (MongoDB Database Tools, **Ubuntu arm64** package from mongodb.com/try/download/database-tools), `postgresql-client` (from Step 07; must be the same or newer major version than Supabase's Postgres, so add the PGDG apt repo if needed), and `rclone` (`sudo apt install -y rclone`).
2. Create a separate bucket `inboundr-backups` and an R2 token limited to it. Configure `rclone config` → remote `r2` (type `s3`, provider `Cloudflare`, endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
3. `/home/ubuntu/backup.sh` (chmod 700). It reads the connection details from `backend/.env` without sourcing it, because unquoted values such as `MONGODB_URI=...?retryWrites=true&w=majority` break when Bash parses them:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ENV_FILE=/home/ubuntu/inboundr/backend/.env
   env_get() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
   for k in MONGODB_URI DB_HOST DB_PORT DB_USER DB_NAME DB_PASSWORD; do
     v=$(env_get "$k" || true); [ -n "$v" ] || { echo "missing $k" >&2; exit 1; }; export "$k=$v"
   done
   TS=$(date -u +%Y%m%d-%H%M)
   DIR=/home/ubuntu/backups; mkdir -p "$DIR"
   mongodump --uri "$MONGODB_URI" --archive="$DIR/mongo-$TS.archive" --gzip
   PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
     --no-owner --no-privileges -Fc -f "$DIR/pg-$TS.dump"
   rclone copy "$DIR" r2:inboundr-backups/ --include "*-$TS.*"
   rclone delete r2:inboundr-backups/ --min-age 14d
   find "$DIR" -type f -mtime +2 -delete
   ```
4. `crontab -e` → `30 20 * * * /home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1` (20:30 UTC = 02:00 IST).
5. **Test a restore** once into a scratch Atlas/Supabase project. An untested backup isn't a backup.

The nightly `pg_dump` also counts as activity, which keeps the Supabase free project from auto-pausing.

### 4. Runbooks

| Task | How |
|------|-----|
| Deploy backend | Merge to `main` (Step 09) |
| Deploy a frontend | Merge to `main` touching that workspace (Step 10) |
| Roll back backend | `git revert` + push, or on the VM `git reset --hard <sha> && sudo systemctl restart inboundr-backend` |
| Roll back a frontend | Cloudflare Pages → project → Deployments → **Rollback** |
| Change a backend env var | Edit `backend/.env` on the VM → `sudo systemctl restart inboundr-backend` |
| Change a `VITE_*` var | Update the GitHub variable → re-run that frontend workflow |
| Rotate a secret | Update it at the provider → `.env` / GitHub secret → restart / redeploy. **Never rotate** `TOKEN_ENCRYPTION_SECRET` without re-encrypting the stored tokens |
| OS updates | Ubuntu `unattended-upgrades` handles security patches. Reboot monthly: `sudo reboot` (the service starts on boot) |
| Upgrade Bun | `bun upgrade` → restart the service. Keep it ≥ 1.3.11 |

### 5. Watch the free-tier limits

| Service | Limit to watch | Where |
|---------|----------------|-------|
| Atlas M0 | 512 MB storage | Atlas → Metrics |
| Supabase | 500 MB DB, inactivity pause | Supabase → Reports |
| R2 | 10 GB storage, 1M writes/month | Cloudflare → R2 |
| SES | 12-month free allowance | AWS Billing |
| Oracle | stay within 4 OCPU / 24 GB / 200 GB | Budget alert |
| OpenRouter/OpenAI | **paid usage**: set spend limits | Provider dashboards |

## Verify

- UptimeRobot shows all monitors as green, and a test alert reaches you.
- `rclone ls r2:inboundr-backups/` lists last night's `mongo-*` and `pg-*` files.

## Role in the bigger picture

This step keeps the free setup **reliable over time**. You hear about outages before customers do, a bad deploy is a one-click rollback, and losing a free-tier database doesn't mean losing the business's customers, quotes and invoices.
