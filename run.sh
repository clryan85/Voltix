#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app"
NODE="$(command -v node || true)"
if [[ -z "$NODE" ]]; then echo "node is missing. Install with: sudo apt install -y nodejs"; exit 1; fi
BROWSER=""
for b in google-chrome-stable google-chrome chromium chromium-browser; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$(command -v "$b")"; break; fi
done
if [[ -z "$BROWSER" ]]; then echo "Chrome/Chromium is missing. Install Chrome or: sudo apt install -y chromium"; exit 1; fi
DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/VoltixRemoteStudio"
PROFILE="$DATA_DIR/browser-profile"
PORT_FILE="$(mktemp)"
LOG_FILE="$DATA_DIR/voltix-remote-studio.log"
mkdir -p "$DATA_DIR" "$PROFILE"
cleanup() { if [[ -n "${SERVER_PID:-}" ]]; then kill "$SERVER_PID" >/dev/null 2>&1 || true; fi; rm -f "$PORT_FILE"; }
trap cleanup EXIT
SMART_REMOTE_STUDIO_USERDATA="$DATA_DIR" SRS_PORT_FILE="$PORT_FILE" "$NODE" "$APP/src/server.js" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 80); do [[ -s "$PORT_FILE" ]] && break; sleep 0.1; done
if [[ ! -s "$PORT_FILE" ]]; then echo "Server did not write port. Log:"; cat "$LOG_FILE"; exit 1; fi
PORT="$(cat "$PORT_FILE")"
exec "$BROWSER" \
  --user-data-dir="$PROFILE" \
  --disable-dev-shm-usage \
  --ozone-platform=x11 \
  --class=VoltixRemoteStudio \
  --app="http://127.0.0.1:$PORT/"
