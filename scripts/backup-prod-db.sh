#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="${1:-${ROOT_DIR}/prod.db}"
BACKUP_DIR="${2:-${ROOT_DIR}/backups/prod-db}"
RETENTION_DAYS="${3:-14}"

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$RETENTION_DAYS" -lt 1 ]]; then
  echo "RETENTION_DAYS 必须是大于 0 的整数。" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "数据库不存在，跳过备份：$DB_FILE"
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="${BACKUP_DIR}/prod-${timestamp}.db"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$backup_file'"
else
  cp "$DB_FILE" "$backup_file"
fi

find "$BACKUP_DIR" -type f -name 'prod-*.db' -mtime +"$RETENTION_DAYS" -delete

echo "数据库备份完成：$backup_file"
