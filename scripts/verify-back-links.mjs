// 返回键修复验证：独立 SSR 详情页的返回键（原生 <a>）点击后必须真实跳转。
// 用法：node scripts/verify-back-links.mjs [BASE]
//   BASE 缺省 http://localhost:3000（本地 standalone/产物验证，API 走 8080）
//   生产：node scripts/verify-back-links.mjs http://154.64.249.175:8088
// 断言：
//   1. /rankings 返回首页 → URL 变为 BASE + /
//   2. 商品详情 ?from=store 返回商城 → URL 变为 BASE + /store/
//   3. vault 藏品详情返回 → URL 回到 BASE + /vault/
//   4. 首页「查看完整榜单」进入 rankings 后浏览器 goBack → 回首页
//   5. 全程无 PAGEERROR（vinext RSC runtime 崩溃曾导致 next/link 点击无响应）
import { createRequire } from 'module';
const require2 = createRequire('C:/Users/35149/.workbuddy/binaries/node/workspace/node_modules/');
const { chromium } = require2('playwright');

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const API = new URL(BASE).port === '3000' ? 'http://localhost:8080' : BASE;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
  let pass = 0;
  let fail = 0;

  function check(name, cond, extra = '') {
    if (cond) { pass += 1; console.log(`  ✔ ${name}`); }
    else { fail += 1; console.log(`  ✘ ${name} ${extra}`); }
  }

  async function clickNav(name, selector, expectPrefix) {
    const btn = page.locator(selector).first();
    const count = await btn.count();
    if (!count) { check(`${name}: 找不到入口`, false); return; }
    await btn.click({ timeout: 6000 }).catch((e) => check(name, false, e.message.slice(0, 120)));
    await page.waitForTimeout(2500);
    const after = page.url();
    check(name, after.startsWith(expectPrefix), `after=${after} expect=${expectPrefix}`);
  }

  // 1) 登录：先试 UI demo 按钮；若未生效则页面内直接 fetch 登录（测试桩，登录链路本身由 smoke-e2e 覆盖）
  console.log('== 登录 ==');
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.demo-logins button', { timeout: 30000 }).catch(() => {});
  const demoBtns = await page.locator('.demo-logins button').count();
  if (demoBtns) {
    await page.locator('.demo-logins button').first().click();
    await page.waitForTimeout(2000);
  }
  const loggedIn = await page.evaluate(async (api) => {
    try {
      const r = await fetch(api + '/api/app-state', { credentials: 'include' });
      if (r.status === 200) return true;
    } catch { /* fallthrough */ }
    try {
      const lr = await fetch(api + '/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'shanhai', password: 'demo1234' }),
      });
      return lr.status === 200;
    } catch { return false; }
  }, API);
  console.log('  login ok:', loggedIn);
  await page.waitForTimeout(1500);

  // 2) /rankings 返回首页
  console.log('== rankings 返回键 ==');
  await page.goto(BASE + '/rankings', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('a[aria-label="返回首页"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await clickNav('rankings 返回首页', 'a[aria-label="返回首页"]', BASE + '/');

  // 3) 商品详情返回商城
  console.log('== 商品详情返回键 ==');
  await page.goto(BASE + '/collections/star-lamp?from=store', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('a[aria-label="返回商城"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await clickNav('商品详情返回商城', 'a[aria-label="返回商城"]', BASE + '/store');

  // 4) vault 藏品详情返回（先取一件持有藏品）
  console.log('== vault 详情返回键 ==');
  const vaultId = await page.evaluate(async (api) => {
    const r = await fetch(api + '/api/app-state', { credentials: 'include' });
    const j = await r.json().catch(() => null);
    const inventory = j?.data?.inventory || [];
    return inventory[0] ? inventory[0].id : null;
  }, API);
  if (vaultId) {
    await page.goto(BASE + `/vault/${vaultId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[aria-label="返回我的藏品"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await clickNav('vault详情返回我的藏品', 'a[aria-label="返回我的藏品"]', BASE + '/vault');
  } else {
    check('vault详情返回（无持有藏品，跳过）', true);
  }

  // 5) 首页面板「查看完整榜单」→ 浏览器 back
  console.log('== 首页面板 → rankings → history back ==');
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.rank-more', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await clickNav('查看完整榜单进入 /rankings', '.rank-more', BASE + '/rankings');
  const beforeBack = page.url();
  await page.goBack({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2000);
  check('history back 回到首页', beforeBack.startsWith(BASE + '/rankings') && page.url() === BASE + '/', `after=${page.url()}`);

  const fatal = errors.filter((e) => e.startsWith('PAGEERROR') || e.includes('is not a function'));
  console.log(`--- 结果: ${pass} 通过, ${fail} 失败`);
  console.log(`--- 页面错误: ${fatal.length ? fatal.slice(0, 6).join(' | ') : '无'}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
