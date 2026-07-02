#!/usr/bin/env bash
set -euo pipefail

# Builds and deploys the document-processor Lambda.
#
# Usage:
#   LAMBDA_FUNCTION_NAME=inboundr-document-processor ./scripts/deploy.sh
#
# Requires: bun, zip, and AWS credentials with lambda:UpdateFunctionCode.
# One-time infrastructure setup is documented in
# docs/deployment/lambda-document-processor.md.

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$PKG_DIR/../.." && pwd)"
FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-inboundr-document-processor}"

echo "Installing dependencies..."
cd "$ROOT_DIR"
bun install --frozen-lockfile

echo "Bundling handler..."
cd "$PKG_DIR"
rm -rf dist
bun run build

echo "Packaging..."
cd dist
rm -f lambda.zip
zip -q lambda.zip index.mjs

echo "Deploying to Lambda function '$FUNCTION_NAME'..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://lambda.zip \
  --no-cli-pager

echo "Done."
