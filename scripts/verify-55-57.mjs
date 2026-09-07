// #59 回归：#55 用户详情转让记录可见 + #57 一次性码表单无数量输入
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/35149/.workbuddy/binaries/node/workspace/node_modules/');
const { chromium } = require2('playwright');
const BASE = process.argv[2] || 'http://localhost:3000';
const PHP = process.env.PHP_BASE || 'http://localhost:8080';
let failed = 0;
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failed++; };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(async (phpBase) => {
    await fetch(phpBase + '/api/admin/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin1234' }) });
  }, PHP);

  // ---------- #55 用户详情转让记录可见 ----------
  const pickUser = await page.evaluate(async (phpBase) => {
    const overview = await (await fetch(phpBase + '/api/admin', { credentials: 'include' })).json();
    for (const user of overview.data.users) {
      const detail = await (await fetch(`${phpBase}/api/admin/user?id=${user.id}`, { credentials: 'include' })).json();
      if (detail.data?.transfers?.length > 0) return { id: user.id, count: detail.data.transfers.length };
    }
    return null;
  }, PHP);
  ok(pickUser !== null, `找到有转让记录的用户（${pickUser?.count} 条）`);
  if (pickUser) {
    await page.goto(`${BASE}/admin/users/${pickUser.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const firstTransfer = page.locator('.ops-transfer-list article').first();
    await firstTransfer.waitFor({ timeout: 20000 });
    const metrics = await firstTransfer.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { w: Math.round(rect.width), h: Math.round(rect.height), display: style.display, visible: !!(rect.width && rect.height) };
    });
    const rowCount = await page.locator('.ops-transfer-list article').count();
    ok(metrics.visible && metrics.w > 400, `转让记录行可见且宽度正常（w=${metrics.w} h=${metrics.h} display=${metrics.display}）`);
    ok(rowCount === pickUser.count, `转让记录行数与接口一致（界面 ${rowCount} / 接口 ${pickUser.count}）`);
  }

  // ---------- #57 一次性码表单去数量 ----------
  await page.goto(`${BASE}/admin/codes`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ops-code-mode', { timeout: 20000 });
  await page.waitForTimeout(800);
  // 通用模式：总使用次数存在、无 ops-form-hint
  ok((await page.locator('#code-limit').count()) === 1, '通用模式仍保留「总使用次数」输入');
  ok((await page.locator('.ops-form-hint').count()) === 0, '通用模式无一次性提示');
  // 切一次性模式
  await page.locator('.ops-code-mode button', { hasText: '一次性随机码' }).click();
  await page.waitForTimeout(500);
  ok((await page.locator('#code-limit').count()) === 0, '一次性模式隐藏总使用次数输入');
  const hint = page.locator('.ops-form-hint');
  ok((await hint.count()) === 1 && (await hint.textContent()).includes('每次提交生成 1 个一次性随机码'), '一次性模式显示「每次提交生成 1 个」提示');
  const submitText = (await page.locator('form button[type="submit"]').textContent() ?? '').replace(/\s+/g, '');
  ok(submitText.includes('生成一个一次性码'), `提交按钮文案为「生成一个一次性码」（实际 ${submitText}）`);
  // 无「生成数量」标签残留
  ok((await page.getByText('生成数量', { exact: true }).count()) === 0, '一次性模式无「生成数量」字段');

  console.log(pageErrors.length ? `\n⚠ 页面错误 ${pageErrors.length} 条: ${pageErrors.slice(0, 3).join(' | ')}` : '\n✅ 无页面 JS 错误');
  console.log(failed === 0 ? '\n✅ #55/#57 本地回归通过' : `\n❌ ${failed} 项断言失败`);
  await browser.close();
  process.exit(failed === 0 && pageErrors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
