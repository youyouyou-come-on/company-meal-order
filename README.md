# 🍽️ 公司点餐系统

公司内部员工点餐系统，支持查看每周菜单、报名吃饭、提交菜品建议。适合 20 人左右的小团队使用。

## ✨ 功能特性

- 📋 每周菜单展示（午餐/晚餐，按天切换）
- ✅ 一键报名"吃"或取消
- 👥 实时显示已报名人员和人数
- ⏰ 自动截止（午餐 10:00 前，晚餐 15:00 前）
- 🍽️ 菜品建议单（提交下周想吃什么）
- 🔧 管理后台（密码保护，菜单增删改，复制上周菜单）
- 📱 移动端友好（大按钮，响应式）
- 🔑 简易登录（下拉选择姓名，无需密码）

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
- 同步项目代码到远程目录
- 生成或复用远程 `.env`
- 初始化数据库并在首次部署时执行种子数据
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

如果只是普通更新，后续再次执行同一条命令即可。脚本会保留远程 `prod.db`，并默认沿用已有管理员密码与 session 密钥。

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

## 👥 员工管理

**方式一：Prisma Studio（推荐）**

```bash
npx prisma studio
# 打开 http://localhost:5555，在 User 表中添加/修改/删除员工
```

**方式二：修改种子数据**

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
