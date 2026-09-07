# 数字藏品系统（Digital Collectibles Web）

一套全栈数字藏品发行与流转演示系统：**用户端**（商城 / 兑换 / 我的藏品 / 转让 / 个人中心 / 排行榜）+ **独立管理后台**（藏品、兑换码、用户、转让单、横幅、运营总览、审计日志、CSV 导出、批量操作），数据落 SQLite，前后端分离部署。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vinext（React 19 SSR / SPA）+ 自绘 SVG 图表，无重型 UI 库 |
| 服务端 | PHP 8.3 内建服务器 + REST API（`php-backend/router.php` 单入口） |
| 存储 | SQLite（WAL 模式，多步写操作统一 `BEGIN IMMEDIATE` 事务封装） |
| 生产 | Nginx 反代 + systemd（见 `deploy/`），静态构建产物由 Vinext standalone SSR 伺服 |

演示数据、动态 banner 与藏品视觉素材位于 `public/`；运行期上传的藏品图落盘于上传目录（生产为独立 `/var/lib/...` 目录，不随代码发布）。

## 功能一览

- 用户端：注册 / 登录（失败 6 次锁 15 分钟）、每日签到、商城浏览、兑换码兑换、藏品转让（含一次性与竞拍式码）、藏品墙、交易记录、余额充值/消费流水、首页排行（紫金绿蓝四主题）。
- 管理后台：运营总览（近 7/30 天折线趋势）、藏品上架/下架/归档与批量操作、兑换码生成与删除、用户停用/启用与余额调整、转让单审核、横幅管理、审计日志检索、三类数据 CSV 导出。
- 会话：用户端 `dc_session`（7 天）与管理端 `dc_admin_session`（30 分钟）为独立 cookie，权限互不串用。

## 本地快速开始

Windows 未安装 PHP 也能跑：`php:init` / `php:serve` 脚本（`scripts/php.ps1`）会自动下载并校验 PHP 官方便携版，启用 `pdo_sqlite`、`sqlite3` 扩展；已装 PHP 则优先用系统 PHP。

```powershell
# 1. 安装依赖
pnpm install

# 2. 初始化数据库（只需首次，或想重置演示数据时）
pnpm php:init
```

然后开两个终端：

```powershell
# 终端一：PHP 服务端 @ http://localhost:8080
pnpm php:serve

# 终端二：Web 前端 @ http://localhost:3000
pnpm dev
```

- 首页 `http://localhost:3000/`、商城 `/store`、兑换 `/redeem`、我的藏品 `/vault`、个人中心 `/profile`、排行榜 `/rankings`
- 独立管理后台 `http://localhost:3000/admin`
- PHP 健康检查 `http://localhost:8080/api/health`

前端默认请求 `http://localhost:8080`，如需修改设置环境变量 `NEXT_PUBLIC_API_BASE_URL`（参考 `.env.example`）。

## 演示账号

| 端 | 账号 | 密码 |
| --- | --- | --- |
| 管理后台 | `admin` | `admin1234` |
| 用户（转让发起方） | `shanhai` | `demo1234` |
| 用户（转让接收方） | `qinghe` | `demo1234` |

## 关于数据库（重要）

登录会话、签到、兑换记录、藏品、转让单及后台调整均保存在 `php-backend/data/collectibles.sqlite`——**该文件不进入版本库**（见 `.gitignore`），由 `pnpm php:init` 一键重建。

```powershell
# 彻底重置演示数据：先自行备份/删除 data 目录下的 sqlite 文件，再执行
pnpm php:init
```

## 目录结构

```
app/                  # Vinext 前端路由（用户端页面 + 后台 catch-all 入口）
components/           # 用户端组件 / AdminConsole 后台控制台 / 自绘图表
lib/api.ts            # 前端 API 封装（含 CSV 同源导出）
php-backend/          # PHP 后端：router.php 入口、bin/init.php 建库、src/ 业务
public/               # 静态资源与演示素材
scripts/              # php 启动脚本 + E2E 验证脚本（verify-*.mjs）
deploy/               # 生产 systemd unit + nginx 站点配置（154.64.249.175:8088 参考）
```

## 验证脚本

Playwright（Chromium）驱动浏览器跑业务闭环，覆盖批量操作 + CSV 导出、趋势图表 + 审计日志、删除兑换码、五个返回路径跳转等（`scripts/verify-*.mjs`）。管理端登录走 `dc_admin_session` cookie，勿与用户端混淆。

## 说明

- 本项目由开发助手在交互式会话中从零搭建，期间多次发布到生产服务器验证（详见 `deploy/` 与版本历史注释）。
- 早期 Cloudflare/Wrangler 探索残留（`dist/`、`.wrangler/`、`@cloudflare/*`）已被 `.gitignore` 忽略、不参与运行，以 `php-backend/` 与 Vinext standalone 产物为准。
