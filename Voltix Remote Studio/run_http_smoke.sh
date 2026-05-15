#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app"
NODE="$(command -v node)"
TMPDIR="$(mktemp -d)"
PORT_FILE="$TMPDIR/port"
LOG_FILE="$TMPDIR/server.log"
cleanup(){ if [[ -n "${PID:-}" ]]; then kill "$PID" >/dev/null 2>&1 || true; fi; rm -rf "$TMPDIR"; }
trap cleanup EXIT
SMART_REMOTE_STUDIO_USERDATA="$TMPDIR/data" SRS_PORT_FILE="$PORT_FILE" "$NODE" "$APP/src/server.js" >"$LOG_FILE" 2>&1 &
PID=$!
for _ in $(seq 1 80); do [[ -s "$PORT_FILE" ]] && break; sleep 0.1; done
[[ -s "$PORT_FILE" ]] || { echo "server failed"; cat "$LOG_FILE"; exit 1; }
PORT="$(cat "$PORT_FILE")"
curl -fsS "http://127.0.0.1:$PORT/" | grep -q "Voltix"
curl -fsS "http://127.0.0.1:$PORT/api/state" | grep -q "interfaces"
echo '{"http_ui_smoke":"pass","api_state_smoke":"pass"}'
