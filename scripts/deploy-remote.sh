#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="${PROJECT_NAME:-company-meal-order}"
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/${PROJECT_NAME}}"
APP_USER="${APP_USER:-mealorder}"
SERVICE_NAME="${SERVICE_NAME:-company-meal-order}"
APP_PORT="${APP_PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="${PNPM_VERSION:-10.29.3}"
INSTALL_NGINX="${INSTALL_NGINX:-1}"
ENABLE_HTTPS="${ENABLE_HTTPS:-0}"
APP_DOMAINS="${APP_DOMAINS:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
SESSION_PASSWORD="${SESSION_PASSWORD:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
LOGIN_LOCK_MAX_FAILED_ATTEMPTS="${LOGIN_LOCK_MAX_FAILED_ATTEMPTS:-}"
LOGIN_LOCK_DURATION_MINUTES="${LOGIN_LOCK_DURATION_MINUTES:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
COOKIE_SECURE="${COOKIE_SECURE:-}"
SEED_ON_FIRST_DEPLOY="${SEED_ON_FIRST_DEPLOY:-1}"
FORCE_DB_SEED="${FORCE_DB_SEED:-0}"
SKIP_DEPLOY_CHECKS="${SKIP_DEPLOY_CHECKS:-0}"
RUN_DEPLOY_E2E="${RUN_DEPLOY_E2E:-0}"
ENABLE_DB_BACKUP="${ENABLE_DB_BACKUP:-1}"
DB_BACKUP_RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-14}"
DB_BACKUP_CRON="${DB_BACKUP_CRON:-23 2 * * *}"
ENABLE_DINGTALK_REMINDER="${ENABLE_DINGTALK_REMINDER:-0}"
DINGTALK_CLIENT_ID="${DINGTALK_CLIENT_ID:-}"
DINGTALK_CLIENT_SECRET="${DINGTALK_CLIENT_SECRET:-}"
DINGTALK_AGENT_ID="${DINGTALK_AGENT_ID:-}"
DINGTALK_REMINDER_URL="${DINGTALK_REMINDER_URL:-}"
DINGTALK_REMINDER_FIRST_CRON="${DINGTALK_REMINDER_FIRST_CRON:-30 9 * * 1-6}"
DINGTALK_REMINDER_SECOND_CRON="${DINGTALK_REMINDER_SECOND_CRON:-50 9 * * 1-6}"

usage() {
  cat <<'EOF'
用法：
  source ./deploy-remote.env
  ./scripts/deploy-remote.sh

核心环境变量：
  DEPLOY_HOST            目标服务器地址，必填
  DEPLOY_USER            SSH 用户，默认 root
  DEPLOY_PORT            SSH 端口，默认 22
  SSH_PASSWORD           可选；如果还没配 SSH key，可以直接填服务器密码
  DEPLOY_PATH            远程部署目录，默认 /opt/company-meal-order
  APP_USER               远程运行用户，默认 mealorder
  SERVICE_NAME           systemd 服务名，默认 company-meal-order
  APP_PORT               应用监听端口，默认 3000
  NODE_MAJOR             Node 主版本，默认 22
  PNPM_VERSION           pnpm 版本，默认 10.29.3
  SESSION_PASSWORD       首次部署时必须提供；后续部署不填则沿用远程 .env
  LOGIN_PASSWORD         首次部署时必须提供；后续部署不填则沿用远程 .env
  LOGIN_LOCK_MAX_FAILED_ATTEMPTS  可选；同一 IP 连续错误多少次后锁定，默认 100
  LOGIN_LOCK_DURATION_MINUTES     可选；锁定时长（分钟），默认 15
  ADMIN_PASSWORD         首次部署时必须提供；后续部署不填则沿用远程 .env
  INSTALL_NGINX          是否安装并配置 Nginx，默认 1
  APP_DOMAINS            域名列表，多个域名用空格分隔，例如 "zcgc.club www.zcgc.club"
  ENABLE_HTTPS           是否申请 HTTPS，默认 0；开启时需要 APP_DOMAINS
  CERTBOT_EMAIL          Certbot 邮箱；不填则使用无邮箱注册模式
  COOKIE_SECURE          是否把 Cookie 设为 secure；默认会随 ENABLE_HTTPS 自动推断
  SEED_ON_FIRST_DEPLOY   首次部署时是否执行 seed，默认 1
  FORCE_DB_SEED         是否在当前部署中强制执行 seed，默认 0
  SKIP_DEPLOY_CHECKS    是否跳过本地部署前检查，默认 0
  RUN_DEPLOY_E2E        部署前是否额外跑 Playwright E2E，默认 0
  ENABLE_DB_BACKUP      是否启用生产库备份，默认 1
  DB_BACKUP_RETENTION_DAYS  备份保留天数，默认 14
  DB_BACKUP_CRON        每日备份 cron 时间，默认 "23 2 * * *"
  ENABLE_DINGTALK_REMINDER  是否启用钉钉点餐提醒 cron，默认 0
  DINGTALK_CLIENT_ID    钉钉企业内部应用 Client ID
  DINGTALK_CLIENT_SECRET 钉钉企业内部应用 Client Secret
  DINGTALK_AGENT_ID     钉钉企业内部应用 AgentId
  DINGTALK_REMINDER_URL 钉钉提醒里的点餐链接
  DINGTALK_REMINDER_FIRST_CRON  首次提醒 cron，默认 "30 9 * * 1-6"
  DINGTALK_REMINDER_SECOND_CRON 二次提醒 cron，默认 "50 9 * * 1-6"

说明：
  1. 该脚本默认面向 Ubuntu / Debian，并要求使用 root SSH 登录。
  2. 首次部署会自动安装 Node.js、pnpm、构建依赖、systemd 服务，以及可选的 Nginx / HTTPS。
  3. 后续部署会保留远程 prod.db；SESSION_PASSWORD 和 ADMIN_PASSWORD 不填则继续沿用已有值。
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "DEPLOY_HOST 不能为空。" >&2
  exit 1
fi

if [[ "$DEPLOY_USER" != "root" ]]; then
  echo "当前脚本默认要求 DEPLOY_USER=root，方便安装依赖、写 systemd 和 Nginx 配置。" >&2
  exit 1
fi

if [[ "$ENABLE_HTTPS" == "1" && -z "$APP_DOMAINS" ]]; then
  echo "开启 ENABLE_HTTPS=1 时，必须提供 APP_DOMAINS。" >&2
  exit 1
fi

if [[ "$ENABLE_HTTPS" == "1" && "$INSTALL_NGINX" != "1" ]]; then
  echo "开启 ENABLE_HTTPS=1 时，INSTALL_NGINX 必须为 1。" >&2
  exit 1
fi

if [[ -z "$COOKIE_SECURE" ]]; then
  if [[ "$ENABLE_HTTPS" == "1" ]]; then
    COOKIE_SECURE="true"
  else
    COOKIE_SECURE="false"
  fi
fi

for cmd in ssh rsync base64; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少依赖命令：$cmd" >&2
    exit 1
  fi
done

if [[ -n "$SSH_PASSWORD" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "检测到 SSH_PASSWORD 已设置，但本机没有安装 sshpass。" >&2
  exit 1
fi

run_deploy_checks() {
  if [[ "$SKIP_DEPLOY_CHECKS" == "1" ]]; then
    echo "==> 已跳过本地部署前检查"
    return
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "部署前检查需要本机安装 pnpm。" >&2
    exit 1
  fi

  echo "==> 本地部署前检查：lint"
  (cd "$ROOT_DIR" && pnpm lint)

  echo "==> 本地部署前检查：build"
  (cd "$ROOT_DIR" && pnpm build)

  if [[ "$RUN_DEPLOY_E2E" == "1" ]]; then
    echo "==> 本地部署前检查：Playwright E2E"
    (cd "$ROOT_DIR" && pnpm test:e2e)
  fi
}

normalize_domains() {
  printf "%s" "$1" | tr ',' ' ' | xargs
}

encode_b64() {
  printf "%s" "$1" | base64 | tr -d '\n'
}

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_ARGS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=no)
APP_DOMAINS="$(normalize_domains "$APP_DOMAINS")"
PRIMARY_DOMAIN="${APP_DOMAINS%% *}"

if [[ -n "$SSH_PASSWORD" ]]; then
  SSH_BASE=(sshpass -p "$SSH_PASSWORD" ssh "${SSH_ARGS[@]}" "$SSH_TARGET")
  RSYNC_RSH="sshpass -p $(printf '%q' "$SSH_PASSWORD") ssh -p ${DEPLOY_PORT} -o StrictHostKeyChecking=no"
else
  SSH_BASE=(ssh "${SSH_ARGS[@]}" "$SSH_TARGET")
  RSYNC_RSH="ssh -p ${DEPLOY_PORT} -o StrictHostKeyChecking=no"
fi

TMP_DIR="$(mktemp -d)"
REMOTE_VARS_FILE="/tmp/${PROJECT_NAME}.deploy.$$.vars"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat >"$TMP_DIR/deploy.vars" <<EOF
PROJECT_NAME_B64=$(encode_b64 "$PROJECT_NAME")
DEPLOY_PATH_B64=$(encode_b64 "$DEPLOY_PATH")
APP_USER_B64=$(encode_b64 "$APP_USER")
SERVICE_NAME_B64=$(encode_b64 "$SERVICE_NAME")
APP_PORT=$APP_PORT
NODE_MAJOR=$NODE_MAJOR
PNPM_VERSION_B64=$(encode_b64 "$PNPM_VERSION")
INSTALL_NGINX=$INSTALL_NGINX
ENABLE_HTTPS=$ENABLE_HTTPS
APP_DOMAINS_B64=$(encode_b64 "$APP_DOMAINS")
CERTBOT_EMAIL_B64=$(encode_b64 "$CERTBOT_EMAIL")
SESSION_PASSWORD_B64=$(encode_b64 "$SESSION_PASSWORD")
LOGIN_PASSWORD_B64=$(encode_b64 "$LOGIN_PASSWORD")
LOGIN_LOCK_MAX_FAILED_ATTEMPTS_B64=$(encode_b64 "$LOGIN_LOCK_MAX_FAILED_ATTEMPTS")
LOGIN_LOCK_DURATION_MINUTES_B64=$(encode_b64 "$LOGIN_LOCK_DURATION_MINUTES")
ADMIN_PASSWORD_B64=$(encode_b64 "$ADMIN_PASSWORD")
COOKIE_SECURE_B64=$(encode_b64 "$COOKIE_SECURE")
SEED_ON_FIRST_DEPLOY=$SEED_ON_FIRST_DEPLOY
FORCE_DB_SEED=$FORCE_DB_SEED
ENABLE_DB_BACKUP=$ENABLE_DB_BACKUP
DB_BACKUP_RETENTION_DAYS_B64=$(encode_b64 "$DB_BACKUP_RETENTION_DAYS")
DB_BACKUP_CRON_B64=$(encode_b64 "$DB_BACKUP_CRON")
ENABLE_DINGTALK_REMINDER=$ENABLE_DINGTALK_REMINDER
DINGTALK_CLIENT_ID_B64=$(encode_b64 "$DINGTALK_CLIENT_ID")
DINGTALK_CLIENT_SECRET_B64=$(encode_b64 "$DINGTALK_CLIENT_SECRET")
DINGTALK_AGENT_ID_B64=$(encode_b64 "$DINGTALK_AGENT_ID")
DINGTALK_REMINDER_URL_B64=$(encode_b64 "$DINGTALK_REMINDER_URL")
DINGTALK_REMINDER_FIRST_CRON_B64=$(encode_b64 "$DINGTALK_REMINDER_FIRST_CRON")
DINGTALK_REMINDER_SECOND_CRON_B64=$(encode_b64 "$DINGTALK_REMINDER_SECOND_CRON")
EOF

run_deploy_checks

echo "==> 检查远程基础环境"
"${SSH_BASE[@]}" \
  "export DEBIAN_FRONTEND=noninteractive; apt-get update >/dev/null; apt-get install -y rsync curl git ca-certificates >/dev/null"

echo "==> 同步项目代码到 ${SSH_TARGET}:${DEPLOY_PATH}"
"${SSH_BASE[@]}" "mkdir -p '$DEPLOY_PATH'"
rsync -az --delete \
  -e "$RSYNC_RSH" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.env' \
  --exclude 'deploy-remote.env' \
  --exclude 'prod.db' \
  --exclude 'backups' \
  --exclude '.runtime' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude 'coverage' \
  "$ROOT_DIR/" \
  "${SSH_TARGET}:${DEPLOY_PATH}/"

echo "==> 上传部署参数"
rsync -az \
  -e "$RSYNC_RSH" \
  "$TMP_DIR/deploy.vars" \
  "${SSH_TARGET}:${REMOTE_VARS_FILE}"

echo "==> 远程安装 / 构建 / 发布"
"${SSH_BASE[@]}" "bash -s -- '$REMOTE_VARS_FILE'" <<'REMOTE_SCRIPT'
set -euo pipefail

VARS_FILE="$1"
# shellcheck disable=SC1090
. "$VARS_FILE"
trap 'rm -f "$VARS_FILE"' EXIT

decode_b64() {
  if [[ -z "${1:-}" ]]; then
    return 0
  fi
  printf '%s' "$1" | base64 --decode
}

read_env_value() {
  local key="$1"
  local env_file="$2"
  local value

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  value="$(grep -E "^${key}=" "$env_file" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

project_name="$(decode_b64 "$PROJECT_NAME_B64")"
deploy_path="$(decode_b64 "$DEPLOY_PATH_B64")"
app_user="$(decode_b64 "$APP_USER_B64")"
service_name="$(decode_b64 "$SERVICE_NAME_B64")"
pnpm_version="$(decode_b64 "$PNPM_VERSION_B64")"
app_domains="$(decode_b64 "$APP_DOMAINS_B64")"
certbot_email="$(decode_b64 "$CERTBOT_EMAIL_B64")"
session_password_input="$(decode_b64 "$SESSION_PASSWORD_B64")"
login_password_input="$(decode_b64 "$LOGIN_PASSWORD_B64")"
login_lock_max_failed_attempts_input="$(decode_b64 "$LOGIN_LOCK_MAX_FAILED_ATTEMPTS_B64")"
login_lock_duration_minutes_input="$(decode_b64 "$LOGIN_LOCK_DURATION_MINUTES_B64")"
admin_password_input="$(decode_b64 "$ADMIN_PASSWORD_B64")"
cookie_secure_input="$(decode_b64 "$COOKIE_SECURE_B64")"
backup_retention_days="$(decode_b64 "$DB_BACKUP_RETENTION_DAYS_B64")"
backup_cron="$(decode_b64 "$DB_BACKUP_CRON_B64")"
dingtalk_client_id_input="$(decode_b64 "$DINGTALK_CLIENT_ID_B64")"
dingtalk_client_secret_input="$(decode_b64 "$DINGTALK_CLIENT_SECRET_B64")"
dingtalk_agent_id_input="$(decode_b64 "$DINGTALK_AGENT_ID_B64")"
dingtalk_reminder_url_input="$(decode_b64 "$DINGTALK_REMINDER_URL_B64")"
dingtalk_reminder_first_cron="$(decode_b64 "$DINGTALK_REMINDER_FIRST_CRON_B64")"
dingtalk_reminder_second_cron="$(decode_b64 "$DINGTALK_REMINDER_SECOND_CRON_B64")"

env_file="${deploy_path}/.env"
db_file="${deploy_path}/prod.db"
backup_script="${deploy_path}/scripts/backup-prod-db.sh"
backup_dir="${deploy_path}/backups/prod-db"
backup_cron_file="/etc/cron.d/${service_name}-db-backup"
dingtalk_reminder_cron_file="/etc/cron.d/${service_name}-dingtalk-reminder"
runtime_dir="${deploy_path}/.runtime"
log_out="/var/log/${service_name}.log"
log_err="/var/log/${service_name}.error.log"
nginx_site="/etc/nginx/sites-available/${service_name}"
nginx_link="/etc/nginx/sites-enabled/${service_name}"
tmp_env_file="$(mktemp)"

IFS=' ' read -r -a domains_array <<< "$app_domains"

export DEBIAN_FRONTEND=noninteractive

packages=(build-essential sqlite3 cron)
if [[ "$INSTALL_NGINX" == "1" ]]; then
  packages+=(nginx)
fi
if [[ "$ENABLE_HTTPS" == "1" ]]; then
  packages+=(certbot python3-certbot-nginx)
fi

apt-get update
apt-get install -y "${packages[@]}"

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm -v)" != "$pnpm_version" ]]; then
  npm install -g "pnpm@${pnpm_version}"
fi

if ! id -u "$app_user" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${app_user}" --shell /usr/sbin/nologin "$app_user"
fi

mkdir -p "$deploy_path" "$runtime_dir"
chown -R "$app_user:$app_user" "$deploy_path" "/home/${app_user}"

existing_session_password="$(read_env_value SESSION_PASSWORD "$env_file")"
existing_login_password="$(read_env_value LOGIN_PASSWORD "$env_file")"
existing_login_lock_max_failed_attempts="$(read_env_value LOGIN_LOCK_MAX_FAILED_ATTEMPTS "$env_file")"
existing_login_lock_duration_minutes="$(read_env_value LOGIN_LOCK_DURATION_MINUTES "$env_file")"
existing_admin_password="$(read_env_value ADMIN_PASSWORD "$env_file")"
existing_cookie_secure="$(read_env_value COOKIE_SECURE "$env_file")"
existing_dingtalk_client_id="$(read_env_value DINGTALK_CLIENT_ID "$env_file")"
existing_dingtalk_client_secret="$(read_env_value DINGTALK_CLIENT_SECRET "$env_file")"
existing_dingtalk_agent_id="$(read_env_value DINGTALK_AGENT_ID "$env_file")"
existing_dingtalk_reminder_url="$(read_env_value DINGTALK_REMINDER_URL "$env_file")"

session_password="${session_password_input:-$existing_session_password}"
login_password="${login_password_input:-$existing_login_password}"
login_lock_max_failed_attempts="${login_lock_max_failed_attempts_input:-$existing_login_lock_max_failed_attempts}"
login_lock_duration_minutes="${login_lock_duration_minutes_input:-$existing_login_lock_duration_minutes}"
admin_password="${admin_password_input:-$existing_admin_password}"
cookie_secure="${cookie_secure_input:-$existing_cookie_secure}"
dingtalk_client_id="${dingtalk_client_id_input:-$existing_dingtalk_client_id}"
dingtalk_client_secret="${dingtalk_client_secret_input:-$existing_dingtalk_client_secret}"
dingtalk_agent_id="${dingtalk_agent_id_input:-$existing_dingtalk_agent_id}"
dingtalk_reminder_url="${dingtalk_reminder_url_input:-$existing_dingtalk_reminder_url}"

if [[ -z "$session_password" ]]; then
  echo "SESSION_PASSWORD 缺失。首次部署请提供 SESSION_PASSWORD。" >&2
  exit 1
fi

if [[ -z "$admin_password" ]]; then
  echo "ADMIN_PASSWORD 缺失。首次部署请提供 ADMIN_PASSWORD。" >&2
  exit 1
fi

if [[ -z "$login_password" ]]; then
  echo "LOGIN_PASSWORD 缺失。首次部署请提供 LOGIN_PASSWORD。" >&2
  exit 1
fi

if [[ -z "$cookie_secure" ]]; then
  cookie_secure="false"
fi

{
  if [[ -f "$env_file" ]]; then
    grep -Ev '^(DATABASE_URL|SESSION_PASSWORD|LOGIN_PASSWORD|LOGIN_LOCK_MAX_FAILED_ATTEMPTS|LOGIN_LOCK_DURATION_MINUTES|ADMIN_PASSWORD|COOKIE_SECURE|NODE_ENV|NEXT_TELEMETRY_DISABLED|DINGTALK_CLIENT_ID|DINGTALK_CLIENT_SECRET|DINGTALK_AGENT_ID|DINGTALK_REMINDER_URL)=' "$env_file" || true
  fi
  printf 'DATABASE_URL="file:./prod.db"\n'
  printf 'SESSION_PASSWORD="%s"\n' "$session_password"
  printf 'LOGIN_PASSWORD="%s"\n' "$login_password"
  if [[ -n "$login_lock_max_failed_attempts" ]]; then
    printf 'LOGIN_LOCK_MAX_FAILED_ATTEMPTS="%s"\n' "$login_lock_max_failed_attempts"
  fi
  if [[ -n "$login_lock_duration_minutes" ]]; then
    printf 'LOGIN_LOCK_DURATION_MINUTES="%s"\n' "$login_lock_duration_minutes"
  fi
  printf 'ADMIN_PASSWORD="%s"\n' "$admin_password"
  printf 'COOKIE_SECURE="%s"\n' "$cookie_secure"
  if [[ -n "$dingtalk_client_id" ]]; then
    printf 'DINGTALK_CLIENT_ID="%s"\n' "$dingtalk_client_id"
  fi
  if [[ -n "$dingtalk_client_secret" ]]; then
    printf 'DINGTALK_CLIENT_SECRET="%s"\n' "$dingtalk_client_secret"
  fi
  if [[ -n "$dingtalk_agent_id" ]]; then
    printf 'DINGTALK_AGENT_ID="%s"\n' "$dingtalk_agent_id"
  fi
  if [[ -n "$dingtalk_reminder_url" ]]; then
    printf 'DINGTALK_REMINDER_URL="%s"\n' "$dingtalk_reminder_url"
  fi
  printf 'NODE_ENV="production"\n'
  printf 'NEXT_TELEMETRY_DISABLED="1"\n'
} >"$tmp_env_file"

mv "$tmp_env_file" "$env_file"

chown root:"$app_user" "$env_file"
chmod 640 "$env_file"

db_exists_before="0"
if [[ -f "$db_file" ]]; then
  db_exists_before="1"
fi

if [[ "$ENABLE_DB_BACKUP" == "1" ]]; then
  chmod +x "$backup_script"
  mkdir -p "$backup_dir"
  chown -R "$app_user:$app_user" "$backup_dir"

  if [[ "$db_exists_before" == "1" ]]; then
    echo "==> 备份当前生产数据库"
    "$backup_script" "$db_file" "$backup_dir" "$backup_retention_days"
    chown -R "$app_user:$app_user" "$backup_dir"
  fi

  cat >"$backup_cron_file" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${backup_cron} root ${backup_script} ${db_file} ${backup_dir} ${backup_retention_days} >> /var/log/${service_name}-db-backup.log 2>&1
EOF
  chmod 644 "$backup_cron_file"
else
  rm -f "$backup_cron_file"
fi

if [[ "$ENABLE_DINGTALK_REMINDER" == "1" ]]; then
  if [[ -z "$dingtalk_client_id" || -z "$dingtalk_client_secret" || -z "$dingtalk_agent_id" ]]; then
    echo "ENABLE_DINGTALK_REMINDER=1 时必须提供 DINGTALK_CLIENT_ID、DINGTALK_CLIENT_SECRET、DINGTALK_AGENT_ID。" >&2
    exit 1
  fi

  cat >"$dingtalk_reminder_cron_file" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${dingtalk_reminder_first_cron} root runuser -u ${app_user} -- bash -lc 'cd ${deploy_path} && set -a && . ${env_file} && set +a && pnpm exec tsx scripts/send-dingtalk-meal-reminders.ts --round=first --live' >> /var/log/${service_name}-dingtalk-reminder.log 2>&1
${dingtalk_reminder_second_cron} root runuser -u ${app_user} -- bash -lc 'cd ${deploy_path} && set -a && . ${env_file} && set +a && pnpm exec tsx scripts/send-dingtalk-meal-reminders.ts --round=second --live' >> /var/log/${service_name}-dingtalk-reminder.log 2>&1
EOF
  chmod 644 "$dingtalk_reminder_cron_file"
else
  rm -f "$dingtalk_reminder_cron_file"
fi

runuser -u "$app_user" -- bash -lc "
  set -euo pipefail
  cd '$deploy_path'
  pnpm install --frozen-lockfile
  pnpm exec prisma generate
  pnpm exec prisma db push
  if [[ ('$db_exists_before' == '0' && '$SEED_ON_FIRST_DEPLOY' == '1') || '$FORCE_DB_SEED' == '1' ]]; then
    pnpm exec prisma db seed
  fi
  pnpm build
"

cat >"/etc/systemd/system/${service_name}.service" <<EOF
[Unit]
Description=${project_name} Next.js App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${app_user}
Group=${app_user}
WorkingDirectory=${deploy_path}
EnvironmentFile=${env_file}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${deploy_path}/node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${APP_PORT}
Restart=always
RestartSec=5
NoNewPrivileges=true
StandardOutput=append:${log_out}
StandardError=append:${log_err}

[Install]
WantedBy=multi-user.target
EOF

touch "$log_out" "$log_err"
chown "$app_user:$app_user" "$log_out" "$log_err"

systemctl daemon-reload
systemctl enable --now "$service_name"
systemctl restart "$service_name"

if [[ "$INSTALL_NGINX" == "1" ]]; then
  if [[ ${#domains_array[@]} -gt 0 ]]; then
    cat >"$nginx_site" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${app_domains};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
    }
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
EOF
  else
    cat >"$nginx_site" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  fi

  ln -sfn "$nginx_site" "$nginx_link"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  if [[ "$ENABLE_HTTPS" == "1" ]]; then
    if [[ ${#domains_array[@]} -eq 0 ]]; then
      echo "ENABLE_HTTPS=1 但 APP_DOMAINS 为空，无法申请证书。" >&2
      exit 1
    fi

    certbot_args=(--nginx --non-interactive --agree-tos --redirect)
    if [[ -n "$certbot_email" ]]; then
      certbot_args+=(--email "$certbot_email")
    else
      certbot_args+=(--register-unsafely-without-email)
    fi
    for domain in "${domains_array[@]}"; do
      certbot_args+=(-d "$domain")
    done

    certbot "${certbot_args[@]}"
    nginx -t
    systemctl reload nginx
  fi
fi

systemctl --no-pager --full status "$service_name" | sed -n '1,20p'
REMOTE_SCRIPT

echo "==> 部署完成"
if [[ -n "$PRIMARY_DOMAIN" ]]; then
  if [[ "$ENABLE_HTTPS" == "1" ]]; then
    echo "访问地址: https://${PRIMARY_DOMAIN}"
  else
    echo "访问地址: http://${PRIMARY_DOMAIN}"
  fi
elif [[ "$INSTALL_NGINX" == "1" ]]; then
  echo "访问地址: http://${DEPLOY_HOST}"
else
  echo "访问地址: http://${DEPLOY_HOST}:${APP_PORT}"
fi
