#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
RUN_SCRIPT="$REPO_DIR/run.sh"
CRON_JOB="*/10 * * * * $RUN_SCRIPT >> $REPO_DIR/cron.log 2>&1"

echo "==> Setting up tee-time-notifier on this machine"

# Install dependencies and build
cd "$REPO_DIR"
echo "==> Installing npm dependencies..."
npm install

echo "==> Building TypeScript..."
npm run build

# Make run.sh executable
chmod +x "$RUN_SCRIPT"

# Check for .env
if [ ! -f "$REPO_DIR/.env" ]; then
  echo ""
  echo "⚠️  No .env file found. Create one at $REPO_DIR/.env with:"
  echo ""
  echo "  GITHUB_TOKEN=ghp_..."
  echo "  GITHUB_OWNER=..."
  echo "  GITHUB_REPO=..."
  echo "  SMTP_USER=..."
  echo "  SMTP_PASS=..."
  echo "  NOTIFY_EMAILS=..."
  echo "  COURSE_ID=16503"
  echo "  PLAYERS=4"
  echo "  HOLES=18"
  echo ""
  echo "Then re-run this script or add the cron manually."
  exit 1
fi

# Add cron job if not already present
if crontab -l 2>/dev/null | grep -qF "$RUN_SCRIPT"; then
  echo "==> Cron job already exists, skipping."
else
  echo "==> Adding cron job..."
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "==> Cron job added."
fi

echo ""
echo "✅ Setup complete. Runs every 10 minutes."
echo "   Logs: $REPO_DIR/cron.log"
echo ""
echo "   To test manually: $RUN_SCRIPT"
echo "   To view logs:     tail -f $REPO_DIR/cron.log"
