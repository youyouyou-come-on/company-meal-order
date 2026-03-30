#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/app.pid"
LOG_FILE="$RUNTIME_DIR/app.log"
PORT="${PORT:-3000}"

mkdir -p "$RUNTIME_DIR"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo ".env not found. Create it before starting the app." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.next/BUILD_ID" ]]; then
  echo "Production build not found. Run pnpm build first." >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "App is already running on PID $OLD_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"
nohup env PORT="$PORT" ./node_modules/.bin/next start >>"$LOG_FILE" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

sleep 1
if kill -0 "$APP_PID" 2>/dev/null; then
  echo "App started on http://127.0.0.1:$PORT (PID $APP_PID)"
  echo "Log file: $LOG_FILE"
else
  echo "App failed to start. Check $LOG_FILE" >&2
  exit 1
fi
