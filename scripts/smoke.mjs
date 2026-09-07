/**
 * 发布前置冒烟：
 *   1) lint        —— oxlint（直接调 node_modules/.bin，绕开 pnpm 自动 install）
 *   2) build       —— vinext build
 *   3) API 健康    —— 若本机已启动 PHP 后端则校验 /api/health（可用 --skip-api 跳过）
 *
 * 用法：
 *   node scripts/smoke.mjs
 *   node scripts/smoke.mjs --skip-api
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const isWin = process.platform === 'win32';

function run(label, binName, args) {
  const bin = path.join(root, 'node_modules', '.bin', isWin ? `${binName}.cmd` : binName);
  const quoted = [bin, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  const result = spawnSync(quoted, { cwd: root, shell: true, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`\n✗ ${label} 失败（exit=${result.status ?? 'signal'}）`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label} 通过`);
}

console.log(`[smoke] 工作目录: ${root}`);
run('lint', 'oxlint', []);
run('build', 'vinext', ['build']);

if (process.argv.includes('--skip-api')) {
  console.log('✓ API 健康检查已跳过（--skip-api）');
} else {
  try {
    const response = await fetch('http://localhost:8080/api/health', { signal: AbortSignal.timeout(3000) });
    const payload = await response.json();
    if (!response.ok || payload.success !== true) throw new Error(`health 响应异常: ${response.status}`);
    console.log(`✓ API 健康检查通过（${payload.runtime} / ${payload.database}）`);
  } catch (reason) {
    console.warn(`⚠ API 健康检查跳过：${reason instanceof Error ? reason.message : String(reason)}`);
    console.warn('  请先启动后端：pnpm php:serve，或使用 node scripts/smoke.mjs --skip-api 跳过。');
  }
}

console.log('\n[smoke] 全部完成 ✔');
