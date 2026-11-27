# Step 01 — Domain, Cloudflare and Turnstile

**Sequence:** 01 of 12 · **Depends on:** nothing · **Blocks:** 04, 08, 10, 11

## What part of the project this step deploys

Nothing runs yet. This step sets up the **DNS zone** that every app will use (`api.`, `app.`, `forms.`, apex). It also creates the **Cloudflare Turnstile** keys that `embed/` (`VITE_TURNSTILE_SITE_KEY`) and `backend/` (`CLOUDFLARE_TURNSTILE_SECRET_KEY`) use for bot checks on public forms.

## What to use

- A domain from any registrar (Cloudflare Registrar, Namecheap, GoDaddy, ...). About $10/year. This is the only unavoidable non-AI cost.
- **Cloudflare Free plan**: DNS, HTTPS proxy, WebSocket proxying, redirect rules, Turnstile.

## How to do it

1. Create a free account at https://dash.cloudflare.com.
2. **Add a site** → enter `yourdomain.com` → choose the **Free** plan.
3. At your registrar, replace the nameservers with the two Cloudflare gives you. Wait until Cloudflare shows the zone as **Active** (minutes to a few hours).
4. **SSL/TLS → Overview**: set the encryption mode to **Full (strict)**.
5. **SSL/TLS → Edge Certificates**: turn on **Always Use HTTPS**.
6. **Network**: make sure **WebSockets** is on (it is by default).
7. **Turnstile → Add widget**:
   - Name: `inboundr-forms`
   - Hostnames: `forms.yourdomain.com` (add `localhost` if you want to test locally)
   - Mode: Managed
   - Save the **Site Key** (goes into `embed/`, Step 10) and the **Secret Key** (goes into `backend/.env`, Step 08).
8. Write down your **Cloudflare Account ID** (dashboard sidebar → Account home). Step 04 and Step 10 need it.

Do **not** create the `api`/`app`/`forms` records yet. They are created in Steps 08 and 10, once their targets exist.

## Verify

- `dig NS yourdomain.com +short` returns the Cloudflare nameservers.
- The Turnstile widget appears in the dashboard with both keys.

## Gotchas

- Moving nameservers drops any DNS records Cloudflare didn't import. Check existing MX/TXT records (Google Workspace mail, SPF) on the **DNS → Records** page before switching.
- Records added later for email verification (SES DKIM in Step 06) must be **DNS only** (grey cloud), not proxied.

## Role in the bigger picture

Cloudflare is the **front door**. Every public URL resolves through this zone. It terminates HTTPS for visitors, proxies `api.` (including WebSockets) to the Oracle VM, serves the three frontends from Pages, and hides the VM's IP. Turnstile keeps bots out of the public forms and recruitment pages.
