// #58 后台兑换码删除 —— 端到端验证
// 覆盖：一次性码生成 → 用户兑换(产生使用记录) → 删除已用码 → 删除未用码
//       → 码从列表消失 / 兑换返回不存在 / 用户使用记录移除 / 审计含 code.delete
const BASE = process.env.PHP_BASE ?? 'http://localhost:8080';

let failed = 0;
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failed++;
};

async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  const init = { method, headers, redirect: 'manual' };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(BASE + path, init);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应 */ }
  return { status: response.status, json, cookie: response.headers.get('set-cookie') ?? '' };
}

function grabCookie(setCookie, name) {
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : '';
}

const stamp = Date.now().toString(36);

// 1) 管理员登录
const adminLogin = await request('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'admin1234' } });
ok(adminLogin.status === 200 && adminLogin.json?.success === true, '管理员登录成功');
const adminCookie = grabCookie(adminLogin.cookie, 'dc_admin_session');
ok(adminCookie !== '', '拿到管理员会话 cookie');

// 2) 注册并登录测试用户（用于真实兑换该码）
const username = `delu_${stamp}`;
const userRegister = await request('/api/auth/register', {
  method: 'POST',
  body: { username, password: 'pass12345', displayName: '删除验证用户' },
});
ok([200, 201].includes(userRegister.status) && userRegister.json?.success === true, `注册测试用户 ${username}`);
const userLogin = await request('/api/auth/login', { method: 'POST', body: { username, password: 'pass12345' } });
ok(userLogin.json?.success === true, '测试用户登录成功');
const userCookie = grabCookie(userLogin.cookie, 'dc_session');

// 3) 生成一次性码 → 找到其 id
async function fetchOverview() {
  const response = await request('/api/admin', { cookie: adminCookie });
  return response.json?.data;
}
async function generate(title) {
  const response = await request('/api/admin', {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'code.generate', title, quantity: 1, yuanbao: 0, points: 50 },
  });
  return response;
}
async function codeRowByValue(codeValue) {
  const overview = await fetchOverview();
  return overview.codes.find((item) => item.code === codeValue && item.kind === 'once') ?? null;
}

const gen1 = await generate(`删除验证A_${stamp}`);
ok(gen1.status === 201 && gen1.json?.success === true && gen1.json?.codes?.length === 1, '生成一次性码 A');
const codeA = gen1.json.codes[0];
let rowA = await codeRowByValue(codeA);
ok(rowA !== null, '管理列表能找到码 A 记录');

// 4) 用户真实兑换码 A → usedCount 变 1
const redeem1 = await request('/api/redeem', { method: 'POST', cookie: userCookie, body: { code: codeA } });
ok(redeem1.status === 200 && redeem1.json?.success === true, '用户成功兑换码 A');
rowA = await codeRowByValue(codeA);
ok(rowA?.usedCount === 1, `码 A usedCount = 1（当前 ${rowA?.usedCount}）`);

// 5) 删除「已使用」的码 A
const delA = await request('/api/admin', { method: 'POST', cookie: adminCookie, body: { action: 'code.delete', codeId: rowA.id } });
ok(delA.status === 200 && delA.json?.success === true, '删除已使用的码 A 成功');

// 6) 断言：列表消失 / code-usage 404 / 再兑换提示不存在 / 用户记录被移除
const afterA = await fetchOverview();
ok(!afterA.codes.some((item) => item.id === rowA.id), '码 A 已从兑换码列表消失');
const usage404 = await request(`/api/admin/code-usage?id=${rowA.id}`, { cookie: adminCookie });
ok(usage404.json?.error === '兑换码不存在' || usage404.json?.message === '兑换码不存在', 'code-usage 对已删码返回不存在');
const redeemAgain = await request('/api/redeem', { method: 'POST', cookie: userCookie, body: { code: codeA } });
ok(redeemAgain.json?.message === '兑换码不存在' || redeemAgain.json?.error === '兑换码不存在', '再次兑换已删码提示不存在');
const me = await request('/api/me', { cookie: userCookie });
ok(!me.json?.data?.redeemRecords.some((r) => r.code === codeA), '用户兑换记录中已无该码');

// 7) 删除「未使用」的码 B
const gen2 = await generate(`删除验证B_${stamp}`);
const codeB = gen2.json.codes[0];
const rowB = await codeRowByValue(codeB);
ok(rowB !== null, '管理列表能找到码 B 记录');
const delB = await request('/api/admin', { method: 'POST', cookie: adminCookie, body: { action: 'code.delete', codeId: rowB.id } });
ok(delB.status === 200 && delB.json?.success === true, '删除未使用的码 B 成功');
const afterB = await fetchOverview();
ok(!afterB.codes.some((item) => item.id === rowB.id), '码 B 已从兑换码列表消失');

// 8) 审计日志回读
const auditA = await request(`/api/admin/audit?action=code.delete&keyword=${encodeURIComponent(codeA)}`, { cookie: adminCookie });
const hitsA = auditA.json?.data?.items ?? auditA.json?.items ?? [];
ok(hitsA.some((item) => (item.detail ?? '').includes('已使用 1 次')), '审计含 code.delete 且标注已使用 1 次');
const auditB = await request(`/api/admin/audit?action=code.delete&keyword=${encodeURIComponent(codeB)}`, { cookie: adminCookie });
const hitsB = auditB.json?.data?.items ?? auditB.json?.items ?? [];
ok(hitsB.length >= 1, '审计含码 B 的 code.delete 记录');

console.log(failed === 0 ? '\n✅ #58 删除兑换码全部通过' : `\n❌ ${failed} 项断言失败`);
process.exit(failed === 0 ? 0 : 1);
