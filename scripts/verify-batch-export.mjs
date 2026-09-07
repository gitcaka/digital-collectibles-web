/**
 * #42 后台批量操作 + CSV 导出 E2E（Playwright + Edge/Chrome）：
 *   1. 总览「数据导出」面板渲染（3 类按钮）
 *   2. users / redeems / transfers 三类 CSV 下载内容干净（UTF-8 BOM、无 Deprecated）
 *   3. 藏品列表勾选 → 批量下架 → 状态落库 → 批量上架还原
 *   4. 用户列表勾选（管理员行无勾选）→ 批量停用 → 批量启用还原
 *   5. 审计日志出现「批量调整藏品 / 批量调整用户」记录
 *
 * 前置：php:serve 与 dev 均已启动，演示库已 init。
 * 用法：node scripts/verify-batch-export.mjs
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
/** 轮询等待顶栏 notice 出现目标文案（先到先得，用唯一的子串区分）。 */
const waitNotice = async (page, text, timeout = 6000) => {
  const started = Date.now();
  for (;;) {
    const current = await page.locator('.ops-notice').count();
    if (current > 0) {
      const body = await page.locator('.ops-notice span').innerText();
      if (body.includes(text)) return body;
    }
    if (Date.now() - started > timeout) return null;
    await page.waitForTimeout(160);
  }
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  const admin = await browser.newPage({ viewport: { width: 1360, height: 960 } });
  log('[登录] 管理员');
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-login-card', { timeout: 20000 });
  await admin.fill('input[placeholder="请输入管理员账号"]', 'admin');
  await admin.fill('input[placeholder="请输入登录密码"]', 'admin1234');
  await admin.click('button:has-text("登录并进入后台")');
  await admin.waitForSelector('.ops-metric-grid', { timeout: 25000 });

  log('[导出] 总览数据导出面板');
  assert(await admin.locator('.ops-export-panel').count() === 1, '运营总览含数据导出面板');
  assert((await admin.locator('.ops-export-cell').count()) === 3, '导出面板含 3 类（用户/兑换/转让）');
  const exportTitles = await admin.locator('.ops-export-main strong').allInnerTexts();
  assert(exportTitles.join(',') === '注册用户,兑换记录,转让记录', '三类导出文案正确');

  log('[导出] CSV 内容抽查（API 直取）');
  const csvHeaders = { users: '用户名', redeems: '用户名', transfers: '转让单' };
  for (const type of ['users', 'redeems', 'transfers']) {
    const response = await admin.request.get(`${API_BASE}/api/admin/export?type=${type}`);
    const contentType = response.headers()['content-type'] ?? '';
    const body = await response.text();
    const hasBom = body.charCodeAt(0) === 0xfeff;
    assert(
      response.status() === 200 && contentType.includes('text/csv') && hasBom && body.includes(csvHeaders[type]) && !body.includes('Deprecated'),
      `${type} CSV 下载成功（BOM + 表头 ${csvHeaders[type]} + 无 Deprecated）`,
    );
  }

  // 记录初始状态，便于最后还原校验
  const adminApi = async () => {
    const response = await admin.request.get(`${API_BASE}/api/admin`);
    return (await response.json()).data;
  };

  log('[藏品] 批量下架并还原');
  await admin.goto(`${BASE}/admin/collections`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-collection-list .ops-collection-card', { timeout: 20000 });
  const onSale = admin.locator('.ops-collection-card').filter({ hasText: '在售' });
  const onSaleCount = await onSale.count();
  assert(onSaleCount >= 2, `在售藏品 ≥2（实际 ${onSaleCount}）`);
  const firstCard = onSale.nth(0);
  const secondCard = onSale.nth(1);
  const firstName = (await firstCard.locator('.ops-collection-card-main > strong').innerText()).trim();
  const secondName = (await secondCard.locator('.ops-collection-card-main > strong').innerText()).trim();
  await firstCard.locator('.ops-card-check').click();
  await secondCard.locator('.ops-card-check').click();
  assert((await admin.locator('.ops-batch-bar .ops-batch-info strong').innerText()) === '2', '勾选 2 件后批量条显示计数');
  assert((await admin.locator('.ops-batch-actions button').count()) >= 4, '批量条出现 上架/下架/归档/全选 操作');
  await admin.locator('.ops-batch-actions button:has-text("批量下架")').click();
  const noticeOff = await waitNotice(admin, '已下架 2 件藏品');
  assert(Boolean(noticeOff), '批量下架提示「已下架 2 件藏品」');
  const cardByName = (name) => admin.locator('.ops-collection-card').filter({ hasText: name });
  await admin.waitForTimeout(900);
  assert((await cardByName(firstName).innerText()).includes('已下架'), `「${firstName}」已变为下架`);
  assert((await cardByName(secondName).innerText()).includes('已下架'), `「${secondName}」已变为下架`);
  // 还原：重新勾选这两个名字的卡片并批量上架
  await cardByName(firstName).locator('.ops-card-check').click();
  await cardByName(secondName).locator('.ops-card-check').click();
  await admin.locator('.ops-batch-actions button:has-text("批量上架")').click();
  const noticeOn = await waitNotice(admin, '已上架 2 件藏品');
  assert(Boolean(noticeOn), '批量上架提示「已上架 2 件藏品」');
  await admin.waitForTimeout(900);
  assert((await cardByName(firstName).innerText()).includes('在售'), `「${firstName}」已还原在售`);
  assert((await cardByName(secondName).innerText()).includes('在售'), `「${secondName}」已还原在售`);
  await admin.screenshot({ path: shotPath('verify-batch-collections.png') }).catch(() => {});

  log('[用户] 批量停用并还原');
  await admin.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-user-row-shell', { timeout: 20000 });
  const userRows = await admin.locator('.ops-user-row-shell').count();
  const plainRows = await admin.locator('.ops-user-row-shell.is-plain').count();
  const checkCount = await admin.locator('.ops-user-row-shell .ops-check').count();
  assert(userRows >= 3 && checkCount === userRows - plainRows && plainRows >= 1, '管理员行无勾选，勾选数与普通用户数一致');
  const dataBefore = await adminApi();
  const targetNames = dataBefore.users
    .filter((item) => item.role !== 'admin' && item.status === 'active')
    .slice(0, 2)
    .map((item) => item.displayName);
  assert(targetNames.length === 2, `存在 2 个可批量操作的活动用户（${targetNames.join(' / ')}）`);
  for (const name of targetNames) {
    await admin.locator('.ops-user-row-shell').filter({ hasText: name }).locator('.ops-check').click();
  }
  assert((await admin.locator('.ops-batch-bar .ops-batch-info strong').innerText()) === '2', '勾选 2 个用户后批量条显示计数');
  await admin.locator('.ops-batch-actions button:has-text("批量停用")').click();
  const noticeDisable = await waitNotice(admin, '已停用 2 个用户');
  assert(Boolean(noticeDisable), '批量停用提示「已停用 2 个用户」');
  await admin.waitForTimeout(700);
  const afterDisable = await adminApi();
  const disabledOk = targetNames.every((name) => {
    const user = afterDisable.users.find((item) => item.displayName === name);
    return user && user.status === 'disabled';
  });
  assert(disabledOk, '两个目标用户已停用（API 复核）');
  for (const name of targetNames) {
    await admin.locator('.ops-user-row-shell').filter({ hasText: name }).locator('.ops-check').click();
  }
  await admin.locator('.ops-batch-actions button:has-text("批量启用")').click();
  const noticeEnable = await waitNotice(admin, '已启用 2 个用户');
  assert(Boolean(noticeEnable), '批量启用提示「已启用 2 个用户」');
  await admin.waitForTimeout(700);
  const afterEnable = await adminApi();
  const enabledOk = targetNames.every((name) => {
    const user = afterEnable.users.find((item) => item.displayName === name);
    return user && user.status === 'active';
  });
  assert(enabledOk, '两个目标用户已还原启用（API 复核）');
  await admin.screenshot({ path: shotPath('verify-batch-users.png') }).catch(() => {});

  log('[审计] 批量操作留痕');
  await admin.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await admin.waitForSelector('.ops-audit-list .ops-audit-row', { timeout: 20000 });
  await admin.fill('.ops-audit-search input', '批量');
  await admin.waitForTimeout(900);
  const auditTexts = await admin.locator('.ops-audit-row').allInnerTexts();
  assert(auditTexts.some((text) => text.includes('批量调整藏品') && text.includes('批量下架')), '审计含「批量调整藏品 / 批量下架」');
  assert(auditTexts.some((text) => text.includes('批量调整用户') && text.includes('批量停用')), '审计含「批量调整用户 / 批量停用」');
  await admin.screenshot({ path: shotPath('verify-batch-audit.png') }).catch(() => {});

  await admin.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n验证失败 ${failures.length} 项：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n批量操作 + CSV 导出验证全部通过 ✔');
