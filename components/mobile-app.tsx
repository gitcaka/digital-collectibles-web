'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleUserRound, Gem, Home, LoaderCircle, PackageOpen, Sparkles, Store, Ticket, X } from 'lucide-react';

import { callApi } from '@/lib/api';

import { AuthScreen } from './mobile/auth-screen';
import { CheckinView } from './mobile/checkin-view';
import { HomeView } from './mobile/home-view';
import { ProfileView } from './mobile/profile-view';
import { RedeemView } from './mobile/redeem-view';
import { StoreView } from './mobile/store-view';
import type { AppState, Notice, PerformFn, PrimaryView, View } from './mobile/types';
import { VaultView } from './mobile/vault-view';

const navItems: Array<{ id: PrimaryView; label: string; icon: typeof Home; href: string }> = [
  { id: 'home', label: '首页', icon: Home, href: '/' },
  { id: 'store', label: '商城', icon: Store, href: '/store' },
  { id: 'redeem', label: '兑换', icon: Ticket, href: '/redeem' },
  { id: 'vault', label: '藏品', icon: PackageOpen, href: '/vault' },
  { id: 'profile', label: '我的', icon: CircleUserRound, href: '/profile' },
];

const viewPaths: Record<PrimaryView, string> = {
  home: '/',
  store: '/store/',
  redeem: '/redeem/',
  vault: '/vault/',
  profile: '/profile/',
};

/** pathname → PrimaryView（忽略尾斜杠）。未知路径返回 null（如详情页，不参与 tab 还原）。 */
function viewFromPath(pathname: string): PrimaryView | null {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const [view, path] of Object.entries(viewPaths) as Array<[PrimaryView, string]>) {
    const pathNormalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    if (normalized === pathNormalized) return view;
  }
  return null;
}

type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): unknown;
};
type ModelContextDocument = Document & {
  modelContext?: { registerTool(tool: ToolRegistration, options?: { signal?: AbortSignal }): void | Promise<void> };
};

/**
 * 用户端外壳：负责拉取 app-state、登录兜底、统一操作反馈与底部导航，
 * 各业务视图已拆入 components/mobile/*-view.tsx。
 */
export function MobileApp({ initialView }: { initialView: PrimaryView }) {
  const [app, setApp] = useState<AppState | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [view, setView] = useState<PrimaryView>(initialView);
  const [subview, setSubview] = useState<'checkin' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState('');
  const activeView: View = subview ?? view;

  useEffect(() => {
    const followStaticPageLink = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!target || target.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      // data-spa 链接由 React 客户端路由接管，不走整页跳转
      if (target.dataset.spa !== undefined) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (!destination.pathname.endsWith('/') && !destination.pathname.split('/').pop()?.includes('.')) {
        destination.pathname += '/';
      }
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination.href);
    };
    document.addEventListener('click', followStaticPageLink, true);
    return () => document.removeEventListener('click', followStaticPageLink, true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openCheckin = useCallback(() => {
    setSubview('checkin');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await callApi<AppState>('/api/app-state', { method: 'GET' });
      // admin 账号也允许停留在用户端浏览/操作（与后台 dc_admin_session 独立会话互不影响）
      setApp(response.data ?? null);
    } catch {
      setApp(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  /** tab 客户端切换：更新视图 + 用 history 同步地址栏，避免整页加载。
   *  切换后静默刷新 app-state（余额/库存/榜单保持新鲜），但不出全屏加载态。 */
  const navigate = useCallback(
    (next: PrimaryView) => {
      setView(next);
      setSubview(null);
      const path = viewPaths[next];
      if (window.location.pathname.replace(/\/+$/, '') !== path.replace(/\/+$/, '')) {
        window.history.pushState({}, '', path);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      window.setTimeout(() => {
        void refresh();
      }, 0);
    },
    [refresh],
  );

  /** 浏览器前进/后退时按地址栏还原视图。 */
  useEffect(() => {
    const restoreFromPath = () => {
      const restored = viewFromPath(window.location.pathname);
      if (restored) {
        setView(restored);
        setSubview(null);
      }
    };
    window.addEventListener('popstate', restoreFromPath);
    return () => window.removeEventListener('popstate', restoreFromPath);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const perform = useCallback<PerformFn>(
    async (key, url, body, method = 'POST') => {
      setBusy(key);
      try {
        const result = await callApi(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
        setNotice({ tone: 'success', message: result.message ?? '操作成功' });
        await refresh();
        return result as { success?: boolean; message: string };
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : '操作失败';
        setNotice({ tone: 'error', message });
        return { success: false, message };
      } finally {
        setBusy('');
      }
    },
    [refresh],
  );

  const checkIn = useCallback(() => perform('checkin', '/api/check-in'), [perform]);

  useEffect(() => {
    if (!app) return;
    const context = (document as ModelContextDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'redeem_reward_code',
          title: '兑换奖励码',
          description: '为当前登录用户兑换一个奖励码，并持久化藏品、元宝或积分奖励。',
          inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'], additionalProperties: false },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (!input || typeof input !== 'object' || !('code' in input) || typeof input.code !== 'string') throw new Error('code 必须是字符串');
            return perform('redeem', '/api/redeem', { code: input.code });
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'complete_daily_check_in',
          title: '完成每日签到',
          description: '为当前登录用户完成今日签到并持久化积分与连续天数。',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute() {
            openCheckin();
            return checkIn();
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [app, checkIn, openCheckin, perform]);

  if (initializing)
    return (
      <main className="mobile-stage">
        <div className="phone-shell loading-screen">
          <Gem />
          <LoaderCircle className="spin" />
          <p>正在开启藏阁</p>
        </div>
      </main>
    );
  if (!app) return <AuthScreen onAuthenticated={refresh} />;

  return (
    <main className="mobile-stage">
      <div className="phone-shell app-phone">
        <div className="mobile-content">
          {activeView === 'home' && <HomeView app={app} openCheckin={openCheckin} navigate={navigate} />}
          {activeView === 'store' && <StoreView app={app} navigate={navigate} />}
          {activeView === 'redeem' && <RedeemView app={app} busy={busy} perform={perform} navigate={navigate} />}
          {activeView === 'checkin' && (
            <CheckinView app={app} busy={busy} onBack={() => setSubview(null)} onCheckIn={() => void checkIn()} />
          )}
          {activeView === 'vault' && <VaultView app={app} busy={busy} perform={perform} navigate={navigate} />}
          {activeView === 'profile' && (
            <ProfileView
              app={app}
              openCheckin={openCheckin}
              navigate={navigate}
              onLogout={() => {
                void (async () => {
                  await callApi('/api/auth/logout', { method: 'POST' });
                  setApp(null);
                  window.location.assign('/');
                })();
              }}
            />
          )}
        </div>

        <nav className="bottom-nav" aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon, href }) => (
            <a
              key={id}
              href={href}
              data-spa
              aria-current={activeView === id || (id === 'profile' && activeView === 'checkin') ? 'page' : undefined}
              className={activeView === id || (id === 'profile' && activeView === 'checkin') ? 'active' : ''}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                navigate(id);
              }}
            >
              <span>
                <Icon />
              </span>
              <small>{label}</small>
            </a>
          ))}
        </nav>
      </div>

      {notice && (
        <output className={`mobile-toast toast-${notice.tone}`} aria-live="polite">
          <span>{notice.tone === 'success' ? <Check /> : notice.tone === 'error' ? <X /> : <Sparkles />}</span>
          <p>{notice.message}</p>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X />
          </button>
        </output>
      )}
    </main>
  );
}
