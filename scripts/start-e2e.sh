#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
SOURCE_DB="$ROOT_DIR/prod.db"
TEST_DB="$RUNTIME_DIR/e2e.db"
PORT="${PORT:-3100}"
PRISMA_BIN="$ROOT_DIR/node_modules/.bin/prisma"
NEXT_BIN="$ROOT_DIR/node_modules/.bin/next"
BUILD_ID_FILE="$ROOT_DIR/.next/BUILD_ID"

export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

mkdir -p "$RUNTIME_DIR"
rm -f "$TEST_DB" "$TEST_DB-journal"

if [[ -f "$SOURCE_DB" ]]; then
  cp "$SOURCE_DB" "$TEST_DB"
else
  echo "prod.db not found, creating a seeded E2E database in .runtime/e2e.db"
  cd "$ROOT_DIR"
  if [[ ! -f "$ROOT_DIR/src/generated/prisma/client.ts" ]]; then
    "$PRISMA_BIN" generate
  fi
  env \
    DEBUG="${DEBUG:-}" \
    RUST_LOG="${RUST_LOG:-info}" \
    PRISMA_SCHEMA_ENGINE_LOG_LEVEL="${PRISMA_SCHEMA_ENGINE_LOG_LEVEL:-trace}" \
    DATABASE_URL="file:./.runtime/e2e.db" \
    "$PRISMA_BIN" db push
  env \
    DEBUG="${DEBUG:-}" \
    RUST_LOG="${RUST_LOG:-info}" \
    PRISMA_SCHEMA_ENGINE_LOG_LEVEL="${PRISMA_SCHEMA_ENGINE_LOG_LEVEL:-trace}" \
    DATABASE_URL="file:./.runtime/e2e.db" \
    "$PRISMA_BIN" db seed
fi

if [[ ! -f "$ROOT_DIR/src/generated/prisma/client.ts" ]]; then
  "$PRISMA_BIN" generate
fi

env \
  DEBUG="${DEBUG:-}" \
  RUST_LOG="${RUST_LOG:-info}" \
  PRISMA_SCHEMA_ENGINE_LOG_LEVEL="${PRISMA_SCHEMA_ENGINE_LOG_LEVEL:-trace}" \
  DATABASE_URL="file:./.runtime/e2e.db" \
  "$PRISMA_BIN" db push

env \
  DEBUG="${DEBUG:-}" \
  RUST_LOG="${RUST_LOG:-info}" \
  PRISMA_SCHEMA_ENGINE_LOG_LEVEL="${PRISMA_SCHEMA_ENGINE_LOG_LEVEL:-trace}" \
  DATABASE_URL="file:./.runtime/e2e.db" \
  "$PRISMA_BIN" db seed

cd "$ROOT_DIR"
if [[ ! -f "$BUILD_ID_FILE" ]]; then
  echo "Production build not found, building the app for E2E..."
  "$NEXT_BIN" build
fi

exec env \
  PORT="$PORT" \
  DATABASE_URL="file:./.runtime/e2e.db" \
  LOGIN_PASSWORD="${LOGIN_PASSWORD:-hzzcgc}" \
  LOGIN_LOCK_MAX_FAILED_ATTEMPTS="${LOGIN_LOCK_MAX_FAILED_ATTEMPTS:-10}" \
  LOGIN_LOCK_DURATION_MINUTES="${LOGIN_LOCK_DURATION_MINUTES:-15}" \
  COOKIE_SECURE="false" \
  "$NEXT_BIN" start
