# EC2 Backend Deployment

This guide deploys the inboundr backend directly on an Ubuntu EC2 instance with Bun, systemd, Nginx, and Let's Encrypt.

## Recommended EC2 Instance

Start with:

- AMI: Ubuntu Server 24.04 LTS
- Instance type: `t3.small`
- Storage: 20-30 GB `gp3`
- Security group:
  - SSH `22` from your IP only
  - HTTP `80` from anywhere
  - HTTPS `443` from anywhere

Use `t3.micro` only for testing. Use `t3.medium` if the API handles real traffic, heavier AI/RFQ processing, or frequent Gmail sync work.

## Server Bootstrap

SSH into the instance:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Install server packages:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl unzip nginx certbot python3-certbot-nginx
```

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

Clone and install the app:

```bash
cd /home/ubuntu
git clone YOUR_REPO_URL inboundr
cd inboundr
bun install --frozen-lockfile
```

## Production Environment

Create the backend environment file on the EC2 instance:

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
chmod 600 backend/.env
```

Required production values:

- `PORT=3000`
- `MONGODB_URI`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `FRONTEND_ORIGIN`
- `API_ORIGIN`
- `GMAIL_OAUTH_REDIRECT_URI`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_PUBSUB_TOPIC`
- `AWS_SES_REGION`
- `AWS_SES_FROM_EMAIL`

Set the public URLs like this:

```env
FRONTEND_ORIGIN=https://app.example.com
API_ORIGIN=https://api.example.com
GMAIL_OAUTH_REDIRECT_URI=https://api.example.com/api/v1/gmail/callback
```

Keep the real `backend/.env` file on EC2 only. Do not commit it.

## systemd Service

Install the service file:

```bash
sudo cp /home/ubuntu/inboundr/docs/deployment/inboundr-backend.service /etc/systemd/system/inboundr-backend.service
sudo systemctl daemon-reload
sudo systemctl enable inboundr-backend
sudo systemctl start inboundr-backend
sudo systemctl status inboundr-backend --no-pager
```

View logs:

```bash
journalctl -u inboundr-backend -f
```

Check the local health endpoint:

```bash
curl --fail http://127.0.0.1:3000/health
```

## Nginx

Copy the Nginx config and replace the example domain:

```bash
sudo cp /home/ubuntu/inboundr/docs/deployment/nginx-inboundr-backend.conf /etc/nginx/sites-available/inboundr-backend
sudo sed -i 's/api.example.com/api.yourdomain.com/g' /etc/nginx/sites-available/inboundr-backend
sudo ln -s /etc/nginx/sites-available/inboundr-backend /etc/nginx/sites-enabled/inboundr-backend
sudo nginx -t
sudo systemctl reload nginx
```

Point `api.yourdomain.com` DNS to the EC2 public IP before enabling HTTPS.

Enable HTTPS:

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Verify:

```bash
curl --fail https://api.yourdomain.com/health
```

## GitHub Actions CI/CD

The workflow in `.github/workflows/backend-deploy.yml`:

- Runs backend typecheck on pull requests to `main`.
- Runs backend typecheck on pushes to `main`.
- Deploys to EC2 after a successful `main` push.
- SSHes into EC2 and runs `scripts/deploy/ec2-deploy.sh`.
- Restarts `inboundr-backend` and checks the API health endpoint.

Add these GitHub repository secrets:

```text
EC2_HOST=api.yourdomain.com
EC2_USER=ubuntu
EC2_SSH_KEY=contents_of_the_private_deploy_key
API_HEALTH_URL=https://api.yourdomain.com/health
```

Optional repository variables:

```text
EC2_APP_DIR=/home/ubuntu/inboundr
EC2_SERVICE_NAME=inboundr-backend
```

Create a deploy key on EC2:

```bash
ssh-keygen -t ed25519 -C "github-actions-inboundr" -f ~/.ssh/github-actions-inboundr
cat ~/.ssh/github-actions-inboundr.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Put the private key contents from `~/.ssh/github-actions-inboundr` into the `EC2_SSH_KEY` GitHub secret.

## Deploy Script

The EC2 deploy script:

```bash
/home/ubuntu/inboundr/scripts/deploy/ec2-deploy.sh
```

It performs:

1. `git fetch origin main`
2. `git reset --hard origin/main`
3. `/home/ubuntu/.bun/bin/bun install --frozen-lockfile`
4. `sudo systemctl restart inboundr-backend`
5. Health check against `API_HEALTH_URL`

The default branch, app path, service name, Bun path, and health URL can be overridden with environment variables.

## External Service Checklist

Before production traffic:

- MongoDB Atlas allows the EC2 public IP or uses a controlled network rule.
- AWS SES is out of sandbox mode if sending to real users.
- The SES sender/domain is verified.
- Google OAuth has this authorized redirect URI:

```text
https://api.yourdomain.com/api/v1/gmail/callback
```

- Google Pub/Sub topic exists and is authorized for Gmail watches.
- Only one backend instance is running unless Gmail watch renewal is made distributed-safe.
