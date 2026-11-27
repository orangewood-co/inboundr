# Step 10 — Frontends on Cloudflare Pages (dashboard, embed, landing)

**Sequence:** 10 of 12 · **Depends on:** 01, 08 (API URL live) · **Blocks:** 11

## What part of the project this step deploys

The three static Vite apps:

| Workspace | URL | Pages project | Build env |
|-----------|-----|---------------|-----------|
| `frontend/` (authenticated dashboard) | `https://app.yourdomain.com` | `inboundr-app` | `VITE_API_URL`, `VITE_EMBED_URL`, optional `VITE_FORMS_SHARE_URL`, `VITE_POSTHOG_PROJECT_TOKEN`, `VITE_POSTHOG_HOST` |
| `embed/` (public forms, links, attendance, Drive shares, chat widget) | `https://forms.yourdomain.com` | `inboundr-embed` | `VITE_API_URL`, `VITE_TURNSTILE_SITE_KEY` |
| `landing/` (marketing site) | `https://yourdomain.com` | `inboundr-landing` | `VITE_API_URL` |

`VITE_*` values are baked in **at build time**, so changing one means rebuilding.

## What to use

- **Cloudflare Pages** (free: unlimited bandwidth and requests, 500 builds/month, custom domains with automatic HTTPS).
- **GitHub Actions + `cloudflare/wrangler-action`** ("Direct Upload"). This keeps the existing Bun build jobs in `frontend-deploy.yml`, `embed-deploy.yml` and `landing-deploy.yml` and only swaps the S3/CloudFront upload for a Pages upload. It avoids Pages' own build image, which doesn't reliably handle a Bun workspace.

## How to do it

### 1. Create the Pages projects and API token

1. Cloudflare → **Workers & Pages → Create → Pages → Direct Upload**. Create `inboundr-app`, `inboundr-embed` and `inboundr-landing` (you can upload any placeholder folder the first time). Set the **production branch** to `main`.
2. **My Profile → API Tokens → Create token** → template **Edit Cloudflare Workers**, or custom with *Account → Cloudflare Pages → Edit*.
3. GitHub → **Settings → Environments → production**:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables (already used by the build jobs): `VITE_API_URL=https://api.yourdomain.com`, `VITE_EMBED_URL=https://forms.yourdomain.com`, `VITE_TURNSTILE_SITE_KEY=<from Step 01>`, PostHog vars if used.

### 2. Change the three workflows (code change)

In each workflow keep the `build` job. In the `deploy` job, keep the `Download dist artifact` step and **replace** the AWS steps (`Configure AWS credentials`, the `aws s3` uploads, `Invalidate CloudFront`) with:

```yaml
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy frontend/dist --project-name=inboundr-app --branch=main
```
Use `embed/dist` + `inboundr-embed` in `embed-deploy.yml`, and `landing/dist` + `inboundr-landing` in `landing-deploy.yml`. Rename the jobs from "Deploy ... to S3". Afterwards, the `AWS_*`, `*_S3_BUCKET` and `*_CLOUDFRONT_DISTRIBUTION_ID` secrets and variables are no longer needed.

### 3. SPA routing and caching

- **SPA fallback is automatic**: if the build output has no top-level `404.html`, Pages serves `index.html` for unknown paths. That covers TanStack Router (`frontend`), React Router (`landing`), and `embed` paths like `/form/:slug`, `/l/:id`, `/attendance/:id`, `/d/:id`. None of the three apps has a `404.html` today. Keep it that way.
- Hashed assets in `assets/` are cached by Cloudflare automatically, and `index.html` is revalidated on every deploy. No CloudFront invalidation is needed.

### 4. Custom domains

Each Pages project → **Custom domains → Set up a domain**:
- `inboundr-app` → `app.yourdomain.com`
- `inboundr-embed` → `forms.yourdomain.com`
- `inboundr-landing` → `yourdomain.com` and `www.yourdomain.com`

Because the zone is on Cloudflare, the DNS records are created for you. Then add **Rules → Redirect Rules**: `www.yourdomain.com/*` → `https://yourdomain.com/$1` (301), so the site has one origin (`LANDING_ORIGIN`).

### 5. First deploy

Push to `main` (or use **Run workflow** / re-run) for each of the three workflows.

## Verify

- `https://app.yourdomain.com/settings` loads directly (deep link), not a 404.
- Browser devtools → Network: API calls go to `https://api.yourdomain.com`, with no CORS errors, and the login cookie is set.
- `https://forms.yourdomain.com/form/<slug>` renders a form with the Turnstile widget.
- `https://yourdomain.com` loads the landing page, and the contact form submits.

## Gotchas

- Don't use the `*.pages.dev` URLs for real use. Auth cookies from `api.yourdomain.com` won't be sent from a different site.
- CORS errors usually mean the backend's `FRONTEND_ORIGIN`/`EMBED_ORIGIN`/`LANDING_ORIGIN` don't exactly match these URLs (no trailing slash).
- Wrong API URL in the bundle? Fix the GitHub variable and **rebuild**. Editing Pages env vars does nothing for Direct Upload builds.

## Role in the bigger picture

These are the **faces of the platform**. `landing/` brings visitors in, `embed/` is the public surface (lead-capture forms, short links, attendance check-in, the support widget) that feeds leads and tickets into the backend, and `frontend/` is where the team works the inbox, approves quotes, sends invoices and chats with the AI. They're static files on Cloudflare's CDN, so they're fast everywhere and cost nothing, while all logic stays in the backend.
