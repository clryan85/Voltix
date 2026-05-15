#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPDIR="$HOME/.local/share/applications"
mkdir -p "$APPDIR"
cat > "$APPDIR/voltix-remote-studio.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Voltix Remote Studio
Comment=Smart LAN TV remote control studio — Remote Control Studio
Exec=$HERE/run.sh
Terminal=false
Categories=Utility;AudioVideo;
StartupWMClass=VoltixRemoteStudio
EOF
chmod +x "$APPDIR/voltix-remote-studio.desktop"
echo "$APPDIR/voltix-remote-studio.desktop"
