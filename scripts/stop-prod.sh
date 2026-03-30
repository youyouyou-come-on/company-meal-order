#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.runtime/app.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "App is not running."
  exit 0
fi

APP_PID="$(cat "$PID_FILE")"
if kill -0 "$APP_PID" 2>/dev/null; then
  kill "$APP_PID"
  echo "Stopped app process $APP_PID"
else
  echo "PID file existed but process $APP_PID was not running."
fi

rm -f "$PID_FILE"
