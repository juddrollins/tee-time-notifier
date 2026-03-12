#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

cd "$SCRIPT_DIR"

echo "[$(date)] Starting tee time run..."
node dist/fetch/index.js && node dist/compare/index.js && node dist/notify/index.js
echo "[$(date)] Done."
