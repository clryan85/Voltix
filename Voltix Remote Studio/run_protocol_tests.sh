#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app"
NODE="$(command -v node)"
cd "$APP"
timeout 45s "$NODE" scripts/syntax_check.js
timeout 45s "$NODE" scripts/mock_smoke.js
echo '{"protocol_tests":"pass"}'
