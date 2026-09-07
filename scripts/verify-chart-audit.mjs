/**
 * 后台图表 + 审计日志 E2E（可选依赖 Playwright + Edge/Chrome）：
 *   1. admin 独立登录 → 总览趋势图渲染（图例 3 项 / 折线 3 条 / 末点 3 个），切「近 30 日」重取数据
 *   2. 用管理会话执行一次操作（启停兑换码）→ 审计页出现对应记录
 *   3. 审计页筛选（关键字 / 操作类型）与空态
 *
 * 前置：php:serve 与 dev 均已启动。
 * 用法：node scripts/verify-chart-audit.mjs
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
const assert = (condition, label) => {
  if (condition) log(`  ✓ ${label}`);
  else {
    failures.push(label);
    log(`  ✗ ${label}`);
  }
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  log('[总览] 管理员登录');
  const admin = await browser.newPage({ viewport: { width: 1360, height: 960 } });
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-login-card', { timeout: 20000 });
  await admin.fill('input[placeholder="请输入管理员账号"]', 'admin');
  await admin.fill('input[placeholder="请输入登录密码"]', 'admin1234');
  await admin.click('button:has-text("登录并进入后台")');
  await admin.waitForSelector('.ops-chart-panel', { timeout: 25000 });

  assert((await admin.locator('.ops-metric-grid article').count()) === 4, '总览 4 张指标卡');
  assert((await admin.locator('.ops-chart-legend span').count()) === 3, '趋势图图例 3 项');
  await admin.waitForSelector('.ops-chart-wrap svg path', { timeout: 15000 });
  assert((await admin.locator('.ops-chart-wrap svg path').count()) === 3, '趋势图 3 条折线');
  assert((await admin.locator('.ops-chart-wrap svg circle').count()) === 3, '趋势图 3 个末点标记');

  // 切到「近 30 日」
  const total7 = (await admin.locator('.ops-chart-legend em').allInnerTexts()).join(',');
  await admin.click('.ops-seg button:has-text("近 30 日")');
  await admin.waitForTimeout(900);
  const total30 = (await admin.locator('.ops-chart-legend em').allInnerTexts()).join(',');
  assert(total7 !== total30 && (await admin.locator('.ops-chart-wrap svg path').count()) === 3, '切近 30 日后趋势重新拉取');
  await admin.screenshot({ path: shotPath('verify-chart.png') }).catch(() => {});

  log('[审计] 执行操作产生记录');
  // 先停用再启用，产生两条 code.toggle 审计记录，同时把数据还原
  const toggle = async (status) => {
    const response = await admin.request.post(`${API_BASE}/api/admin`, {
      data: { action: 'code.toggle', codeId: 'rc_yuanbao88', status },
    });
    return response.json();
  };
  const first = await toggle('disabled');
  assert(first.success === true, '停用兑换码成功并写审计');
  const second = await toggle('active');
  assert(second.success === true, '重新启用兑换码成功并写审计');

  await admin.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-audit-list .ops-audit-row', { timeout: 20000 });
  const rowTexts = await admin.locator('.ops-audit-row').allInnerTexts();
  assert(rowTexts.length >= 2, `审计列表渲染 ≥2 条（实际 ${rowTexts.length}）`);
  assert(rowTexts.some((text) => text.includes('启停兑换码') && text.includes('YUANBAO88')), '审计记录含「启停兑换码 / YUANBAO88」');
  const countText = await admin.locator('.ops-audit-count').innerText();
  const totalCount = Number(countText.match(/\d+/)?.[0] ?? '0');
  assert(totalCount >= 2, `审计计数与操作数一致（实际 ${countText}）`);

  // 关键字筛选
  await admin.fill('.ops-audit-search input', 'YUANBAO88');
  await admin.waitForTimeout(800);
  assert((await admin.locator('.ops-audit-row').count()) >= 2, '关键字 YUANBAO88 筛出全部启停记录');
  await admin.fill('.ops-audit-search input', '不存在的关键字xyz');
  await admin.waitForTimeout(800);
  assert((await admin.locator('.ops-audit-row').count()) === 0, '无匹配时展示空态');
  assert(await admin.locator('.ops-audit-panel').innerText().then((t) => t.includes('没有匹配的审计记录')), '空态文案正确');
  await admin.fill('.ops-audit-search input', '');
  await admin.waitForTimeout(800);

  // 操作类型筛选
  await admin.selectOption('.ops-audit-select', 'code.toggle');
  await admin.waitForResponse((response) => response.url().includes('/api/admin/audit') && response.url().includes('action=code.toggle'));
  await admin.waitForTimeout(300);
  assert((await admin.locator('.ops-audit-row').count()) >= 2, '按操作类型筛出全部启停记录');
  await admin.screenshot({ path: shotPath('verify-audit.png') }).catch(() => {});

  await admin.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n验证失败 ${failures.length} 项：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n图表 + 审计日志验证全部通过 ✔');
