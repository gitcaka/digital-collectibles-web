'use client';

import { useState } from 'react';
import { ArrowRight, ChevronRight, Gem, LoaderCircle, LockKeyhole, Sparkles, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callApi } from '@/lib/api';

/** 登录 / 注册整屏：管理员账号登录后同样留在用户端（后台入口独立于 /admin）。 */
export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const authenticate = async (targetUsername?: string, targetPassword?: string) => {
    setBusy(true);
    setError('');
    try {
      const endpoint = mode === 'register' && !targetUsername ? '/api/auth/register' : '/api/auth/login';
      await callApi(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: targetUsername ?? username,
          password: targetPassword ?? password,
          displayName,
        }),
      });
      await onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mobile-stage auth-stage">
      <div className="phone-shell auth-phone">
        <header className="mobile-brand">
          <span>
            <Gem />
          </span>
          <div>
            <strong>数字藏品</strong>
            <small>掌中藏阁</small>
          </div>
        </header>
        <section className="auth-sheet">
          <div className="auth-title">
            <span>{mode === 'login' ? '欢迎回来' : '初入藏阁'}</span>
            <h1>{mode === 'login' ? '登录账号' : '注册账号'}</h1>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void authenticate();
            }}
          >
            <label htmlFor="auth-username">
              <span>用户名</span>
              <div>
                <UserRound />
                <Input
                  id="auth-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="4–20 位字母、数字或下划线"
                />
              </div>
            </label>
            {mode === 'register' && (
              <label htmlFor="auth-display-name">
                <span>昵称</span>
                <div>
                  <Sparkles />
                  <Input
                    id="auth-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="藏阁中显示的名字"
                  />
                </div>
              </label>
            )}
            <label htmlFor="auth-password">
              <span>密码</span>
              <div>
                <LockKeyhole />
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="至少 8 位"
                />
              </div>
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="primary-cta" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : mode === 'login' ? '进入藏阁' : '创建账号'}
              <ArrowRight />
            </Button>
          </form>
          <button
            type="button"
            className="mode-link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
          </button>
          <div className="demo-logins">
            <button type="button" onClick={() => void authenticate('shanhai', 'demo1234')} disabled={busy}>
              <span>
                <UserRound />
              </span>
              <div>
                <strong>体验用户端</strong>
                <small>shanhai / demo1234</small>
              </div>
              <ChevronRight />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
