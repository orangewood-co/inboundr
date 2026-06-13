#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/inboundr}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-inboundr-backend}"
VOICE_SERVICE_NAME="${VOICE_SERVICE_NAME:-inboundr-voice}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
BUN_BIN="${BUN_BIN:-/home/ubuntu/.bun/bin/bun}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

"$BUN_BIN" install --frozen-lockfile

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl is-active --quiet "$SERVICE_NAME"

# Voice agent worker is optional: build and restart only when its service is installed.
if systemctl list-unit-files --type=service | grep -q "^${VOICE_SERVICE_NAME}.service"; then
  "$BUN_BIN" run --cwd voice build
  sudo systemctl restart "$VOICE_SERVICE_NAME"
  sudo systemctl is-active --quiet "$VOICE_SERVICE_NAME"
  echo "Voice agent service restarted: $VOICE_SERVICE_NAME"
else
  echo "Voice agent service not installed; skipping ($VOICE_SERVICE_NAME)"
fi

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
