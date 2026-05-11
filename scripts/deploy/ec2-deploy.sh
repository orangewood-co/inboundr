#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/inboundr}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-inboundr-backend}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
BUN_BIN="${BUN_BIN:-/home/ubuntu/.bun/bin/bun}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

"$BUN_BIN" install --frozen-lockfile

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME"

for attempt in {1..10}; do
  if curl --fail --silent --show-error "$HEALTH_URL" > /dev/null; then
    echo "Deployment succeeded: $HEALTH_URL is healthy"
    exit 0
  fi

  echo "Health check attempt $attempt failed; retrying..."
  sleep 3
done

echo "Deployment failed: health check did not pass"
sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager
exit 1
