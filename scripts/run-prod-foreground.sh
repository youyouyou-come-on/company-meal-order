#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
NODE_BINARY="${NODE_BINARY:-$(command -v node || true)}"

cd "$ROOT_DIR"
if [[ -z "$NODE_BINARY" ]]; then
  echo "NODE_BINARY is not set and node was not found in PATH." >&2
  exit 1
fi

exec env PORT="$PORT" "$NODE_BINARY" ./node_modules/next/dist/bin/next start
