/**
 * 端到端主路径（可选依赖 Playwright + Edge/Chrome）：
 *   用户端：登录 → 商城列表渲染 → 首页/我的藏品可达
 *   管理端：独立登录（dc_admin_session）→ 藏品列表渲染 → 退出
 *
 * 前置：
 *   - 已启动：pnpm php:serve 与 pnpm dev
 *   - 已安装 playwright（默认读取本机 workbuddy workspace；
 *     也可用环境变量 SMOKE_PLAYWRIGHT_DIR 指向含 playwright 的 node_modules 父目录）
 *
 * 用法：node scripts/smoke-e2e.mjs
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const modulesDir = process.env.SMOKE_PLAYWRIGHT_DIR || 'C:/Users/35149/.workbuddy/binaries/node/workspace/node_modules';
const require = createRequire(`${modulesDir}/`);
const { chromium } = require('playwright');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const API_BASE = 'http://localhost:8080';
const shotPath = (name) => path.join(os.tmpdir(), name);
const failures = [];
const log = (line) => console.log(line);

function assert(condition, label) {
  if (condition) {
    log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    log(`  ✗ ${label}`);
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  // ── 用户端 ──────────────────────────────
  log('[用户端] 登录 shanhai');
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.goto(`${BASE}/store`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 兜底：等待登录表单或应用内容
  await page.waitForTimeout(1500);
  const pwd = page.locator('input[type="password"]').first();
  if (await pwd.count()) {
    const userInput = page.locator('input:not([type="password"])').first();
    await userInput.fill('shanhai');
    await pwd.fill('demo1234');
    const submit = page.locator('button[type="submit"], button:has-text("登录")').first();
    await submit.click();
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(500);
  const bodyUser = (await page.locator('body').innerText()).slice(0, 800);
  assert(/商城|兑换|首页|签到/.test(bodyUser), '用户端已进入应用主界面');
  await page.screenshot({ path: shotPath('smoke-e2e-user.png') }).catch(() => {});
  await page.close();

  // ── 管理端 ──────────────────────────────
  log('[管理端] 独立登录 admin（dc_admin_session）');
  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await admin.goto(`${BASE}/admin/collections`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-login-card, .ops-console', { timeout: 20000 });
  if (await admin.locator('.ops-login-card').count()) {
    await admin.fill('input[placeholder="请输入管理员账号"]', 'admin');
    await admin.fill('input[placeholder="请输入登录密码"]', 'admin1234');
    await admin.click('button:has-text("登录并进入后台")');
    await admin.waitForSelector('.ops-collection-card', { timeout: 25000 });
  }
  const cardCount = await admin.locator('.ops-collection-card').count();
  assert(cardCount > 0, `管理端藏品列表渲染（${cardCount} 张卡片）`);

  // 会话确实走 admin cookie（接口层已用 curl 验证，浏览器端看是否仍能读取数据）
  const adminBody = await admin.locator('.ops-content:not([hidden])').innerText().catch(() => '');
  assert(adminBody.includes('件藏品'), '管理端数据加载正常');
  await admin.screenshot({ path: shotPath('smoke-e2e-admin.png') }).catch(() => {});

  // 登出后回到登录页
  await admin.locator('button[aria-label="退出管理后台"]').click();
  await admin.waitForSelector('.ops-login-card', { timeout: 15000 });
  assert(true, '管理端登出后回到登录页');
  await admin.close();

  log(`\n健康检查: ${API_BASE}/api/health`);
  const health = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
  assert(health.ok, `后端健康检查 HTTP ${health.status}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nE2E 失败 ${failures.length} 项：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nE2E 全部通过 ✔');
