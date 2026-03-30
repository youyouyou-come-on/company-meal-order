# 公司点餐系统项目说明

## 项目用途

这是一个公司内部点餐系统，主要包含 3 个使用场景：

1. 员工登录后选择某一天，报名午餐/晚餐。
2. 员工在“建议专区”匿名提建议，后台保留发言人。
3. 管理员在“管理菜单”里维护一周菜单，并支持截图或打印给阿姨。

## 代码与部署位置

- 源码目录：`/Users/zcgc-zxl/Documents/work/company-meal-order`
- 生产目录：`/Users/zcgc-zxl/company-meal-order-deploy`
- 生产地址：`http://127.0.0.1:3000`
- 开机自启：`launchctl`，服务名 `com.zcgc.company-meal-order`
- 启动配置：`/Users/zcgc-zxl/Library/LaunchAgents/com.zcgc.company-meal-order.plist`

## 关键数据位置

- 数据库：`prod.db`
- 当前生产库：`/Users/zcgc-zxl/company-meal-order-deploy/prod.db`
- 本地源码库：`/Users/zcgc-zxl/Documents/work/company-meal-order/prod.db`
- 环境变量：根目录 `.env`

注意：

- 不要直接把源码目录的 `.env` 和 `prod.db` 无脑覆盖到生产目录。
- 同步代码时建议排除 `.env`、`prod.db`、`.runtime`、`.next`、`node_modules`。

## 当前业务约定

- 点餐首页：先选日期，再操作当天午餐/晚餐。
- 周日不参与点餐，也不在管理菜单页显示。
- 建议专区对前台匿名，但后端保留提交人。
- 已报名但已截止时，首页会显示“已报名（已截止）”，避免误以为系统出错。
- 管理菜单页采用一页式周视图，适合截图和打印。

## 当前用户维护方式

- 用户实际存储在数据库 `User` 表里。
- `prisma/seed.ts` 已同步为当前员工名单，并补入了 `杜平花`。
- 如果手工加人，可执行类似：

```sql
INSERT INTO "User" ("name")
SELECT '杜平花'
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "name" = '杜平花'
);
```

## 常用命令

在源码目录执行：

```bash
/opt/homebrew/opt/node@22/bin/pnpm build
/opt/homebrew/opt/node@22/bin/pnpm test:e2e
```

同步到生产时建议：

```bash
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude '.runtime' \
  --exclude '.env' \
  --exclude 'prod.db' \
  /Users/zcgc-zxl/Documents/work/company-meal-order/ \
  /Users/zcgc-zxl/company-meal-order-deploy/
```

生产构建并重启：

```bash
cd /Users/zcgc-zxl/company-meal-order-deploy
/opt/homebrew/opt/node@22/bin/pnpm build
launchctl kickstart -k gui/$(id -u)/com.zcgc.company-meal-order
```

## 当前测试覆盖

测试文件：`tests/e2e/app.spec.ts`

已覆盖的重点场景：

1. 用户反复登录与登出。
2. “吃”与“不吃”反复切换。
3. 首页、建议专区、管理菜单、登录页之间跳转。
4. 管理菜单填写后保存，并在刷新后仍然存在。
5. 点餐数据在刷新、重新登录后仍然持久化。
6. 建议提交后刷新仍然存在。

## 运行排查

- 如果页面文字闪烁，优先检查首页是否出现重复请求。
- 如果管理员密码突然不对，先看生产目录 `.env` 是否被覆盖。
- 如果登录列表不对，先看 `prod.db` 的 `User` 表是不是被旧库覆盖。
- 如果服务没起来，先看：
  - `/Users/zcgc-zxl/company-meal-order-deploy/.runtime/launchd.out.log`
  - `/Users/zcgc-zxl/company-meal-order-deploy/.runtime/launchd.err.log`

## 本次额外记录

- 新增用户：`杜平花`
- 当前 E2E 测试默认用户：`张英俊`
- 当前管理员密码仍保存在 `.env` 中
