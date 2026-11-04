#!/usr/bin/env bash
set -e

# Exit immediately if a command exits with a non-zero status
# Production deployment script for pulling code, building frontend, and restarting services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"
WEB_ROOT="/usr/share/nginx/html"

echo "=== [1/5] Pulling Latest Commits from GitHub ==="
cd "$APP_DIR"
git pull origin main

echo "=== [2/5] Updating Backend Python Environment ==="
cd "$APP_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "=== [3/5] Building React Dashboard Assets ==="
cd "$APP_DIR/dashboard"
npm install
npm run build

echo "=== [4/5] Deploying Static Build to Web Root ==="
sudo mkdir -p "$WEB_ROOT"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -r dist/* "$WEB_ROOT"/

echo "=== [5/5] Restarting System Services ==="
sudo systemctl daemon-reload
# Restart the active systemd service (endpoint-api or monitor-api fallback)
if systemctl is-active --quiet endpoint-api || systemctl is-enabled --quiet endpoint-api 2>/dev/null; then
    sudo systemctl restart endpoint-api
elif systemctl is-active --quiet monitor-api || systemctl is-enabled --quiet monitor-api 2>/dev/null; then
    sudo systemctl restart monitor-api
else
    sudo systemctl restart endpoint-api
fi
sudo systemctl restart nginx

echo "=== Deployment Successfully Completed ==="
