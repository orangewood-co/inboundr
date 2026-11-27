# Step 07 — Oracle Cloud Always Free VM

**Sequence:** 07 of 12 · **Depends on:** nothing (do it early, capacity can take time) · **Blocks:** 08, 09

## What part of the project this step deploys

The **server that will run `backend/`**, plus its network and firewall. No app code is deployed yet. This replaces the EC2 instance described in `docs/deployment/ec2-backend.md`.

## What to use

- **Oracle Cloud Infrastructure (OCI) Always Free**: Ampere A1 (ARM64) shape, up to 4 OCPU / 24 GB RAM and 200 GB block storage in total, free with no time limit.
- Image: **Canonical Ubuntu 24.04** (aarch64). Its default user is `ubuntu`, which matches the existing `inboundr-backend.service` and `scripts/deploy/ec2-deploy.sh`.

## How to do it

1. Sign up at https://www.oracle.com/cloud/free/. A card is used for verification only.
   - **Home region** cannot be changed later, and Always Free A1 capacity exists only there. For India pick **India West (Mumbai)** or **India South (Hyderabad)**.
2. Recommended: **upgrade to Pay As You Go** (Billing → Upgrade). You still pay $0 within Always Free limits, but:
   - Always Free accounts can have *idle* instances reclaimed (low CPU/network/memory over 7 days). PAYG accounts are exempt.
   - A1 "Out of capacity" errors are much rarer.
   - Then set a **Budget** with a $1 alert (Billing → Budgets) so you know if anything paid gets created.
3. **Networking → VCN → Start VCN Wizard → "Create VCN with Internet Connectivity"** (name `inboundr-vcn`, default CIDRs).
4. In the VCN's **public subnet → Default Security List → Add Ingress Rules** (stateful, source `0.0.0.0/0`, TCP):
   - `22` (SSH; GitHub Actions deploys over SSH from changing IPs, so keep key-only auth, see Gotchas)
   - `80`
   - `443`
5. **Compute → Instances → Create instance**:
   - Name `inboundr-api`
   - Image: Canonical Ubuntu 24.04 (not "Minimal")
   - Shape: **VM.Standard.A1.Flex**, **2 OCPU / 12 GB** (leaves half the free quota for staging later; use 4/24 if you want everything)
   - Networking: `inboundr-vcn` public subnet, **Assign a public IPv4 address**
   - SSH keys: upload your public key (`~/.ssh/id_ed25519.pub`)
   - Boot volume: 50–100 GB
   If you get "Out of capacity", retry in another Availability Domain or a few hours later.
6. Note the **public IP**. Optionally go to **Instance → Attached VNICs → IPv4 addresses → Edit → Reserved public IP**, so the IP survives if you ever recreate the instance.
7. SSH in and open the **OS firewall**. Oracle's Ubuntu images ship iptables rules that block everything except 22, even when the security list allows it:
   ```bash
   ssh ubuntu@<VM_PUBLIC_IP>
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
   Do **not** enable `ufw` on Oracle images. It conflicts with these rules.
8. Base packages and Bun:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl unzip nginx fail2ban postgresql-client
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc && bun --version   # must be >= 1.3.11 (Bun.cron)
   sudo timedatectl set-timezone UTC
   ```
9. Allow the database from this VM:
   - MongoDB Atlas → **Network Access** → add `<VM_PUBLIC_IP>/32` (Step 02).
   - Supabase allows all IPs by default. Optionally restrict it under **Database → Network restrictions**.

## Verify

```bash
uname -m                  # aarch64
bun --version             # >= 1.3.11
curl -I http://<VM_PUBLIC_IP>   # nginx default page answers (proves security list + iptables)
```

## Gotchas

- SSH: keep `PasswordAuthentication no` (the Ubuntu image default). `fail2ban` bans brute-force IPs. To close port 22 completely later, use Tailscale or a Cloudflare Tunnel for deploys.
- ARM64: Bun, `sharp` and `@resvg/resvg-js` all ship linux-arm64 builds, so no extra build tools are needed. If a native package ever fails to install, `sudo apt install -y build-essential python3` fixes most cases.
- `ubuntu` has passwordless sudo on Oracle images. The deploy script relies on that for `systemctl restart`.

## Role in the bigger picture

This VM is the **always-on engine room**. Unlike serverless or sleeping free tiers, it keeps the WebSocket connections (support chat, notifications), in-process `Bun.cron` jobs (reminders, digests, call recordings, email reconciliation), background workers (recruitment ranking, workflow delays) and Gmail watch renewals running 24/7. That is why Oracle was chosen.
