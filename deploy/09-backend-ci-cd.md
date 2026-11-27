# Step 09 — Backend CI/CD (GitHub Actions → Oracle VM)

**Sequence:** 09 of 12 · **Depends on:** 08 · **Blocks:** nothing (but do it before go-live)

## What part of the project this step deploys

The **automatic deploy pipeline for `backend/`**: `.github/workflows/backend-deploy.yml` plus `scripts/deploy/ec2-deploy.sh`. On every push to `main` that touches `backend/**`, it typechecks the backend, SSHes into the VM, runs `git reset --hard origin/main`, `bun install`, restarts `inboundr-backend`, and checks `/health`.

## What to use

- **GitHub Actions** (free minutes for private repos are plenty for this).
- The existing workflow and script **as-is**. They are generic SSH deploys. Only the secrets change, and the script defaults (`/home/ubuntu/inboundr`, `/home/ubuntu/.bun/bin/bun`, `inboundr-backend`) already match Step 08.

## How to do it

1. Create a deploy key that lets GitHub Actions log in to the VM (on the VM):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-inboundr" -f ~/.ssh/github-actions-inboundr -N ""
   cat ~/.ssh/github-actions-inboundr.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   cat ~/.ssh/github-actions-inboundr     # copy the PRIVATE key, then delete this file
   rm ~/.ssh/github-actions-inboundr
   ```
2. GitHub → repo → **Settings → Secrets and variables → Actions** (repository secrets, or secrets on the `production` environment that the deploy job uses) → set:
   | Secret | Value |
   |--------|-------|
   | `EC2_HOST` | **The VM public IP**, not `api.yourdomain.com`. That hostname is proxied by Cloudflare, which doesn't pass SSH. |
   | `EC2_USER` | `ubuntu` |
   | `EC2_SSH_KEY` | Private key from step 1 |
   | `API_HEALTH_URL` | `https://api.yourdomain.com/health` |
   Optional variables `EC2_APP_DIR` and `EC2_SERVICE_NAME` only if you changed the paths or service name.
3. The old AWS EC2 values in these secrets get **replaced**. After cutover, stop or terminate the EC2 instance so it can't be deployed to by mistake.
4. Test it: push a trivial backend change (or re-run the last **Backend CI/CD** run) and watch the **Deploy backend to EC2** job. The name is historical; it now targets Oracle.

## Verify

- The Actions job ends with `Deployment succeeded: https://api.yourdomain.com/health is healthy`.
- On the VM, `git -C /home/ubuntu/inboundr log -1 --oneline` matches `main`.

## Gotchas

- `ssh-keyscan` / `Permission denied (publickey)`: `EC2_HOST` points at the Cloudflare-proxied name, or the public key isn't in `authorized_keys`.
- `git fetch` fails on the VM: the repo deploy key from Step 08 is missing or wasn't added on GitHub.
- The script does `git reset --hard` in `/home/ubuntu/inboundr`, so never edit code directly on the VM. `backend/.env` is gitignored and survives.
- Rollback: `git revert` the bad commit and push, or on the VM run `git reset --hard <good-sha> && sudo systemctl restart inboundr-backend`.

## Role in the bigger picture

This makes **`main` the source of truth for production**. Every merged backend change goes live in about a minute, with a typecheck gate before and a health check after, and nobody has to SSH in by hand.
