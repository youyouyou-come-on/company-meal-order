#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
SOURCE_DB="$ROOT_DIR/prod.db"
TEST_DB="$RUNTIME_DIR/e2e.db"
PORT="${PORT:-3100}"

mkdir -p "$RUNTIME_DIR"
rm -f "$TEST_DB" "$TEST_DB-journal"
cp "$SOURCE_DB" "$TEST_DB"

cd "$ROOT_DIR"
exec env \
  PORT="$PORT" \
  DATABASE_URL="file:./.runtime/e2e.db" \
  COOKIE_SECURE="false" \
  ./node_modules/.bin/next start
