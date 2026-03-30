#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LABEL="com.zcgc.company-meal-order"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$LABEL.plist"
PORT="${PORT:-3000}"
USER_ID="$(id -u)"
NODE_BINARY="$(command -v node)"
NODE_BIN_DIR="$(dirname "$NODE_BINARY")"

mkdir -p "$RUNTIME_DIR" "$LAUNCH_AGENTS_DIR"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo ".env not found. Create it before installing the launch agent." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.next/BUILD_ID" ]]; then
  echo "Production build not found. Run pnpm build first." >&2
  exit 1
fi

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
      <string>$ROOT_DIR/scripts/run-prod-foreground.sh</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PORT</key>
      <string>$PORT</string>
      <key>NODE_BINARY</key>
      <string>$NODE_BINARY</string>
      <key>PATH</key>
      <string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>$ROOT_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$RUNTIME_DIR/launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>$RUNTIME_DIR/launchd.err.log</string>
  </dict>
</plist>
EOF

launchctl bootout "gui/$USER_ID" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$USER_ID" "$PLIST_PATH"
launchctl kickstart -k "gui/$USER_ID/$LABEL"

echo "Launch agent installed: $LABEL"
echo "Plist: $PLIST_PATH"
echo "App URL: http://127.0.0.1:$PORT"
