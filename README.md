# 🍽️ 公司点餐系统

公司内部员工点餐系统，支持查看每周菜单、报名吃饭、提交菜品建议。适合 20 人左右的小团队使用。

## ✨ 功能特性

- 📋 菜单展示（午餐/晚餐，只开放今天和下一个可点餐日）
- ✅ 按份数点餐或取消
- 👥 实时显示已报名人员和人数
- ⏰ 自动截止（午餐 10:00 前，晚餐 15:00 前）
- 🍽️ 菜品建议单（提交下周想吃什么）
- 🔧 管理后台（密码保护，菜单增删改，复制上周菜单）
- 👥 员工管理（密码保护，新增员工、停用/启用员工）
- 📱 移动端友好（大按钮，响应式）
- 🔑 简易登录（姓名 + 公司内部统一密码）

## 🛠️ 技术栈

| 技术 | 版本 |
|------|------|
| Next.js | 16 (App Router) |
| TypeScript | 5 |
| Tailwind CSS | v4 |
| Prisma ORM | 7 |
| SQLite | - |
| iron-session | 8 |
| pnpm | - |

## 🚀 快速开始

### 前置条件

- Node.js 18+
- pnpm

### 本地开发

```bash
git clone -b 公司内部点餐系统 https://github.com/zkf4581/company-meal-order.git
cd company-meal-order
pnpm install
cp .env.example .env  # Windows: copy .env.example .env
# 编辑 .env 配置密码

npx prisma generate
npx prisma db push
npx prisma db seed

pnpm dev
# 打开 http://localhost:3000
```

### 生产部署

```bash
pnpm build
pnpm start
# 或指定端口: PORT=8080 pnpm start
```

### 远程一键部署

适用于 **Ubuntu / Debian 新服务器**，默认通过 `root` SSH 远程部署。

```bash
cp deploy-remote.env.example deploy-remote.env
# 编辑 deploy-remote.env
source ./deploy-remote.env
./scripts/deploy-remote.sh
```

脚本会自动完成这些事：

- 安装 Node.js、pnpm、构建依赖
- 本地先执行 `pnpm lint` 和 `pnpm build`，失败则停止部署
- 同步项目代码到远程目录
- 生成或复用远程 `.env`
- 在修改数据库结构前备份远程 `prod.db`
- 初始化数据库并在首次部署时执行种子数据
- 安装每日数据库定时备份，并按保留天数清理旧备份
- 构建生产包并配置 `systemd` 开机自启
- 按需安装 Nginx、绑定域名、申请 Let’s Encrypt 证书

常用变量：

- `DEPLOY_HOST`：服务器 IP 或域名
- `SSH_PASSWORD`：如果还没配 SSH key，可以直接填服务器密码
- `DEPLOY_PATH`：远程部署目录
- `SESSION_PASSWORD`：首次部署时必填
- `LOGIN_PASSWORD`：员工登录统一密码，首次部署时必填
- `LOGIN_LOCK_MAX_FAILED_ATTEMPTS`：同一 IP 连续错误多少次后锁定，默认 100
- `LOGIN_LOCK_DURATION_MINUTES`：锁定时长（分钟），默认 15
- `ADMIN_PASSWORD`：首次部署时必填
- `APP_DOMAINS`：域名列表，多个域名用空格分隔
- `ENABLE_HTTPS=1`：自动申请 HTTPS
- `SKIP_DEPLOY_CHECKS=1`：跳过本地部署前 `lint/build`
- `RUN_DEPLOY_E2E=1`：部署前额外执行 Playwright E2E
- `ENABLE_DB_BACKUP=1`：启用部署前和每日生产库备份
- `DB_BACKUP_RETENTION_DAYS`：备份保留天数，默认 14
- `DB_BACKUP_CRON`：每日备份 cron 时间，默认 `23 2 * * *`

如果只是普通更新，后续再次执行同一条命令即可。脚本会保留远程 `prod.db`，并默认沿用已有管理员密码与 session 密钥。

生产库备份默认保存在远程服务器：

```bash
/opt/company-meal-order/backups/prod-db/
```

也可以手动执行一次本地或远程备份：

```bash
./scripts/backup-prod-db.sh ./prod.db ./backups/prod-db 14
```

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./prod.db` |
| `SESSION_PASSWORD` | Session 加密密钥（≥32 字符） | 无，必须设置 |
| `LOGIN_PASSWORD` | 员工登录统一密码 | 无，必须设置 |
| `LOGIN_LOCK_MAX_FAILED_ATTEMPTS` | 同一 IP 连续登录错误多少次后锁定 | `100` |
| `LOGIN_LOCK_DURATION_MINUTES` | 登录锁定时长（分钟） | `15` |
| `ADMIN_PASSWORD` | 管理后台密码 | `123456` |
| `COOKIE_SECURE` | HTTPS 时设为 `true` | `false` |
| `SKIP_DEPLOY_CHECKS` | 是否跳过部署前 `lint/build` | `0` |
| `RUN_DEPLOY_E2E` | 是否在部署前额外跑 Playwright E2E | `0` |
| `ENABLE_DB_BACKUP` | 是否启用生产库备份 | `1` |
| `DB_BACKUP_RETENTION_DAYS` | 生产库备份保留天数 | `14` |
| `DB_BACKUP_CRON` | 每日备份 cron 时间 | `23 2 * * *` |
| `ENABLE_DINGTALK_REMINDER` | 是否安装钉钉点餐提醒 cron | `0` |
| `DINGTALK_CLIENT_ID` | 钉钉企业内部应用 Client ID | 无 |
| `DINGTALK_CLIENT_SECRET` | 钉钉企业内部应用 Client Secret | 无 |
| `DINGTALK_AGENT_ID` | 钉钉企业内部应用 AgentId | 无 |
| `DINGTALK_REMINDER_URL` | 钉钉提醒里的点餐链接 | `https://meal.zcgc.club` |
| `DINGTALK_REMINDER_FIRST_CRON` | 首次提醒时间 | `30 9 * * 1-6` |
| `DINGTALK_REMINDER_SECOND_CRON` | 二次提醒时间 | `50 9 * * 1-6` |

## 👥 员工管理

登录后点击右上角 **员工管理**，输入与管理菜单相同的管理员密码即可新增员工、停用或启用员工。

停用员工不会删除历史点餐记录，但该员工不能继续登录点餐。

如果后续要接钉钉私聊提醒，可以在员工管理里为员工维护 **钉钉 UserId**。这个字段用于把点餐系统里的员工和钉钉账号绑定起来，未绑定的员工不会收到钉钉私聊提醒。

如果需要在初始化新环境时批量补齐员工，也可以继续使用种子数据。

## 🔔 钉钉私聊提醒准备

钉钉私聊提醒建议走 **企业内部应用工作通知**：

1. 在钉钉开放平台创建企业内部应用。
2. 记录应用的 `AppKey`、`AppSecret` 和 `AgentId`，它们只应保存在服务器环境变量里，不要提交到 Git。
3. 给应用开通发送工作通知消息的权限，并由企业管理员完成授权。
4. 在员工管理页面为每位员工维护钉钉 `UserId`。
5. 定时提醒脚本读取点餐数据库，筛出未点餐且已绑定 `UserId` 的员工，再通过钉钉工作通知逐个发送提醒。

提醒建议配置为每天 `09:30` 和 `09:50` 各执行一次。脚本会先统计当天已经提交点餐的员工人数，如果低于 5 人，会认为今天可能是休假日或异常低活跃日，直接跳过提醒，避免误打扰全员。

本地 dry-run 调试：

```bash
DATABASE_URL="file:./.runtime/local-preview.db" \
DINGTALK_CLIENT_ID="你的 Client ID" \
DINGTALK_CLIENT_SECRET="你的 Client Secret" \
DINGTALK_AGENT_ID="你的 AgentId" \
DINGTALK_REMINDER_URL="https://meal.zcgc.club" \
pnpm exec tsx scripts/send-dingtalk-meal-reminders.ts --round=first
```

dry-run 只会查库、筛人、打印消息，不会真实发送。确认测试员工的钉钉 `UserId` 已绑定，并且管理员已经开通工作通知权限后，才可以显式加 `--live` 做真实发送测试：

```bash
DATABASE_URL="file:./.runtime/local-preview.db" \
DINGTALK_CLIENT_ID="你的 Client ID" \
DINGTALK_CLIENT_SECRET="你的 Client Secret" \
DINGTALK_AGENT_ID="你的 AgentId" \
DINGTALK_REMINDER_URL="https://meal.zcgc.club" \
pnpm exec tsx scripts/send-dingtalk-meal-reminders.ts --round=first --live
```

**方式一：后台页面（推荐）**

访问 `/employees`，输入管理员密码后操作。

**方式二：Prisma Studio**

```bash
npx prisma studio
# 打开 http://localhost:5555，在 User 表中添加/修改/删除员工
```

**方式三：修改种子数据**

编辑 `prisma/seed.ts`，修改姓名列表后执行 `npx prisma db seed`

如果是线上正式员工名单变更，推荐这样同步：

```bash
source ./deploy-remote.env
FORCE_DB_SEED=1 ./scripts/deploy-remote.sh
```

这样会把 `prisma/seed.ts` 里的最新用户名单同步到生产库，不会影响已有点餐记录。

## 📁 项目结构

```
├── prisma/
│   ├── schema.prisma    # 数据库模型
│   └── seed.ts          # 种子数据（用户 + 示例菜单）
├── src/
│   ├── app/
│   │   ├── page.tsx         # 首页（菜单 + 报名）
│   │   ├── login/           # 登录页
│   │   ├── admin/           # 管理后台
│   │   ├── suggestions/     # 菜品建议单
│   │   └── api/             # API 路由
│   ├── components/
│   │   └── Navbar.tsx       # 导航栏
│   ├── hooks/
│   │   └── useCurrentUser.ts
│   └── lib/
│       ├── prisma.ts        # 数据库连接
│       └── session.ts       # Session 配置
├── .env.example             # 环境变量模板
└── package.json
```

## 📄 License

MIT
