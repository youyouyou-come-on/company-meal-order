#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.runtime/app.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "App is not running."
  exit 1
fi

APP_PID="$(cat "$PID_FILE")"
if kill -0 "$APP_PID" 2>/dev/null; then
  echo "App is running with PID $APP_PID"
else
  echo "PID file exists, but process $APP_PID is not running."
  exit 1
fi
