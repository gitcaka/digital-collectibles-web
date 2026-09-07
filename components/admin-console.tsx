'use client';

import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  Check,
  ChevronRight,
  Database,
  Home,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Repeat2,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldX,
  Ticket,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { callApi } from '@/lib/api';

import type { AdminActionResponse, AdminData, AdminSectionProps, Section } from './admin/shared';
import { sectionMeta } from './admin/shared';

const KNOWN_SECTIONS: Section[] = ['dashboard', 'collections', 'codes', 'users', 'transfers', 'banners', 'audit', 'settings'];

/** 控制台版本徽标：发布新版时随 package.json 一起 bump，便于排查浏览器是否仍在跑旧 bundle */
const APP_VERSION = '0.3.0';

/**
 * 视图路由（section/detailId/mode）。不再从 usePathname 逐次派生：
 * 初次挂载时从 URL 派生一次，之后由底部导航 setState 驱动（见 openSection）。
 * 这样 tab 切换完全不经过 vinext 路由导航，AdminConsole 永不因切 tab 重挂载（#62）。
 */
type ConsoleRoute = { section: Section; detailId: string | null; mode: 'browse' | 'create' };

/** 从 pathname 派生 AdminConsole 的视图路由。
 * 例：/admin → 'dashboard'；/admin/collections → 'collections'；
 * /admin/collections/new → 'collections' + mode 'create'；
 * /admin/collections/<id> → 'collections' + detailId；/admin/users/<id> → 'users' + detailId。
 * 刷新/深链直进时据此还原到正确的 tab。
 */
function deriveFromPath(pathname: string): { section: Section; detailId: string | null; mode: 'browse' | 'create' } {
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments.length <= 1) return { section: 'dashboard', detailId: null, mode: 'browse' };
  const top = segments[1] as Section;
  if (!KNOWN_SECTIONS.includes(top)) return { section: 'dashboard', detailId: null, mode: 'browse' };
  if (segments.length === 2) return { section: top, detailId: null, mode: 'browse' };
  if (top === 'collections' && segments[2] === 'new') return { section: 'collections', detailId: null, mode: 'create' };
  if ((top === 'collections' || top === 'users') && segments[2]) {
    return { section: top, detailId: segments[2], mode: 'browse' };
  }
  return { section: top, detailId: null, mode: 'browse' };
}
import { BannersSection } from './admin/sections/banners-section';
import { AuditSection } from './admin/sections/audit-section';
import { CodesSection } from './admin/sections/codes-section';
import { CollectionsSection } from './admin/sections/collections-section';
import { DashboardSection } from './admin/sections/dashboard-section';
import { SettingsSection } from './admin/sections/settings-section';
import { TransfersSection } from './admin/sections/transfers-section';
import { UsersSection } from './admin/sections/users-section';

export default function AdminConsole({
  section: _sectionProp = 'dashboard',
  detailId: _detailIdProp = null,
  mode: _modeProp = 'browse',
}: {
  section?: Section;
  /** 独立详情页路径参数：/admin/collections/[id] 或 /admin/users/[id] */
  detailId?: string | null;
  /** 独立新增页：/admin/collections/new */
  mode?: 'browse' | 'create';
} = { section: 'dashboard' }) {
  // 视图路由由内部 state 驱动：挂载时按 URL 派生一次（见下方首个 effect），切 tab 只改 state + 镜像地址栏。
  const [route, setRoute] = useState<ConsoleRoute>({ section: 'dashboard', detailId: null, mode: 'browse' });
  const { section, detailId, mode } = route;

  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  /** 后台会话无效时，用 /api/me 探测到的用户端身份：'user' | 'guest' | 'admin'（无后台会话但 dc_session 为管理员） */
  const [visitor, setVisitor] = useState<'user' | 'guest' | 'admin' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNoticeState] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await callApi<AdminData>('/api/admin', { method: 'GET' });
      setData(response.data ?? null);
      setVisitor(null);
      setError('');
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : '后台加载失败');
      // 后台会话失效：探测当前浏览器在用户端的身份，决定展示「无权限」还是登录表单
      try {
        const me = await callApi('/api/me', { method: 'GET' });
        const role = (me.user as { role?: string } | null | undefined)?.role;
        setVisitor(role === 'admin' ? 'admin' : role === 'user' ? 'user' : 'guest');
      } catch {
        setVisitor('guest');
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // 首次挂载（含刷新 / 深链直进 /admin/xxx）从真实 URL 还原当前视图，再拉取后台数据
      setRoute(deriveFromPath(window.location.pathname));
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const openSection = useCallback((next: Section) => {
    // 客户端切换：仅更新内部 state，并用 pushState 镜像地址栏（不派发 popstate）。
    // 派发合成 popstate 会让 vinext 路由框架误以为发生导航 → 整棵 page 重挂载，
    // AdminConsole 的 loading 复位并重拉 GET /api/admin → 全屏加载层闪现（#62 根因）。
    setRoute((prev) =>
      prev.section === next && !prev.detailId && prev.mode === 'browse' ? prev : { section: next, detailId: null, mode: 'browse' },
    );
    const target = next === 'dashboard' ? '/admin' : `/admin/${next}`;
    if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') !== target.replace(/\/+$/, '')) {
      window.history.pushState({}, '', target);
    }
  }, []);
  /** 浏览器前进/后退：按地址栏还原视图（与 openSection 的 pushState 镜像配对）。 */
  useEffect(() => {
    const restoreFromPath = () => {
      const nextRoute = deriveFromPath(window.location.pathname);
      setRoute((prev) =>
        prev.section === nextRoute.section && prev.detailId === nextRoute.detailId && prev.mode === nextRoute.mode
          ? prev
          : nextRoute,
      );
    };
    window.addEventListener('popstate', restoreFromPath);
    return () => window.removeEventListener('popstate', restoreFromPath);
  }, []);
  /** 统一提示入口：字符串 → 成功绿条；{ text, tone } → 可指定错误红条 */
  const setNotice = useCallback((message: string | { text: string; tone?: 'ok' | 'error' } | null) => {
    if (message === null || typeof message === 'string') {
      setNoticeState(message === null ? null : { text: message, tone: 'ok' });
      return;
    }
    setNoticeState({ text: message.text, tone: message.tone === 'error' ? 'error' : 'ok' });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNoticeState(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const adminLogin = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      // 管理端使用独立会话：短时效 dc_admin_session + 服务端滑动续期
      const response = await callApi('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const user = response.user as { role?: string } | undefined;
      if (user?.role !== 'admin') {
        await callApi('/api/admin/logout', { method: 'POST' });
        throw new Error('该账号没有管理后台权限');
      }
      await load();
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : '登录失败');
    } finally {
      setLoginBusy(false);
    }
  };
  const logout = async () => {
    await callApi('/api/admin/logout', { method: 'POST' });
    setData(null);
    setVisitor(null);
    setError('');
    setAdminPassword('');
  };
  const action = useCallback(
    async (key: string, payload: Record<string, unknown>): Promise<AdminActionResponse | null> => {
      setBusy(key);
      try {
        const response = await callApi('/api/admin', { method: 'POST', body: JSON.stringify(payload) });
        setNotice(response.message ?? '操作成功');
        await load();
        return response as AdminActionResponse;
      } catch (reason) {
        setNotice({ text: reason instanceof Error ? reason.message : '操作失败', tone: 'error' });
        return null;
      } finally {
        setBusy('');
      }
    },
    [load, setNotice],
  );

  if (loading)
    return (
      <main className="ops-stage">
        <div className="ops-state">
          <ShieldCheck />
          <LoaderCircle className="spin" />
          <p>正在接入运营控制台</p>
        </div>
      </main>
    );
  if (visitor === 'user')
    return (
      <main className="ops-login-stage">
        <section className="ops-login-card ops-deny-card">
          <header>
            <span className="is-deny">
              <ShieldX />
            </span>
            <div>
              <small>INDEPENDENT CONSOLE</small>
              <strong>藏阁运营管理</strong>
            </div>
          </header>
          <div className="ops-login-copy is-deny">
            <span>无权限访问</span>
            <h1>普通用户无法进入后台</h1>
            <p>你当前登录的是普通用户账号。运营控制台仅限管理员使用，请切换回用户端继续浏览藏品。</p>
          </div>
          <button type="button" className="ops-back-home" onClick={() => window.location.assign('/')}>
            <Home />
            返回用户端
          </button>
        </section>
      </main>
    );
  if (!data || error)
    return (
      <main className="ops-login-stage">
        <section className="ops-login-card">
          <header>
            <span>
              <ShieldCheck />
            </span>
            <div>
              <small>INDEPENDENT CONSOLE</small>
              <strong>藏阁运营管理</strong>
            </div>
          </header>
          <div className="ops-login-copy">
            <span>管理员专属入口</span>
            <h1>登录管理后台</h1>
            <p>用户端与后台已分离，管理员登录后直接进入运营控制台。</p>
          </div>
          <form onSubmit={(event) => void adminLogin(event)}>
            <label htmlFor="admin-username">
              <span>管理员账号</span>
              <div>
                <UserRound />
                <Input
                  id="admin-username"
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="请输入管理员账号"
                />
              </div>
            </label>
            <label htmlFor="admin-password">
              <span>密码</span>
              <div>
                <LockKeyhole />
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入登录密码"
                />
              </div>
            </label>
            {loginError && (
              <p className="ops-login-error" role="alert">
                {loginError}
              </p>
            )}
            <Button type="submit" disabled={loginBusy || !adminUsername || !adminPassword}>
              {loginBusy ? <LoaderCircle className="spin" /> : <ShieldCheck />}
              登录并进入后台
            </Button>
          </form>
          <button
            type="button"
            className="ops-demo-login"
            onClick={() => {
              setAdminUsername('admin');
              setAdminPassword('admin1234');
              setLoginError('');
            }}
          >
            <span>本地演示账号</span>
            <strong>admin / admin1234</strong>
            <ChevronRight />
          </button>
          <footer>
            <Database />
            PHP + SQLite 本地管理服务
          </footer>
        </section>
      </main>
    );

  const meta = sectionMeta[section];
  const sectionProps: AdminSectionProps = { data, busy, action, setNotice, reload: load, openSection };

  return (
    <main className="ops-stage">
      <Tabs
        value={section}
        onValueChange={(value) => openSection(value as Section)}
        orientation="horizontal"
        className="ops-shell"
      >
        <header className="ops-mobile-header">
          <div className="ops-brand">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <strong>藏阁运营台</strong>
              <small>PHP 管理后台</small>
            </div>
          </div>
          <div className="ops-header-actions">
            <button type="button" aria-label="返回用户端" title="返回用户端" onClick={() => window.location.assign('/')}>
              <Home />
            </button>
            <span className="ops-online">
              <i />
              v{APP_VERSION}
            </span>
            <button type="button" aria-label="刷新后台数据" onClick={() => void load()}>
              <RefreshCw />
            </button>
            <button type="button" aria-label="退出管理后台" onClick={() => void logout()}>
              <LogOut />
            </button>
          </div>
        </header>
        <section className="ops-workspace">
          <header className="ops-topbar">
            <div>
              <small>{meta.eyebrow}</small>
              <h1>{meta.title}</h1>
              <p>{meta.note}</p>
            </div>
          </header>
          <TabsContent value="dashboard" className="ops-content">
            <DashboardSection {...sectionProps} />
          </TabsContent>
          <TabsContent value="collections" className="ops-content">
            <CollectionsSection {...sectionProps} detailId={detailId} mode={mode} />
          </TabsContent>
          <TabsContent value="codes" className="ops-content">
            <CodesSection {...sectionProps} />
          </TabsContent>
          <TabsContent value="users" className="ops-content">
            <UsersSection {...sectionProps} detailId={detailId} />
          </TabsContent>
          <TabsContent value="transfers" className="ops-content">
            <TransfersSection {...sectionProps} />
          </TabsContent>
          <TabsContent value="banners" className="ops-content">
            <BannersSection {...sectionProps} />
          </TabsContent>
          <TabsContent value="audit" className="ops-content">
            <AuditSection {...sectionProps} />
          </TabsContent>
          <TabsContent value="settings" className="ops-content">
            <SettingsSection {...sectionProps} />
          </TabsContent>
        </section>
        <TabsList className="ops-nav" aria-label="后台功能导航">
          <TabsTrigger value="dashboard">
            <LayoutDashboard />
            <span>总览</span>
          </TabsTrigger>
          <TabsTrigger value="collections">
            <Boxes />
            <span>藏品</span>
          </TabsTrigger>
          <TabsTrigger value="codes">
            <Ticket />
            <span>兑换码</span>
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users />
            <span>用户</span>
          </TabsTrigger>
          <TabsTrigger value="transfers">
            <Repeat2 />
            <span>转让</span>
          </TabsTrigger>
          <TabsTrigger value="banners">
            <ImagePlus />
            <span>横幅</span>
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText />
            <span>审计</span>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings />
            <span>设置</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {notice && (
        <output className={`ops-notice${notice.tone === 'error' ? ' is-error' : ''}`} aria-live="polite">
          {notice.tone === 'error' ? <AlertCircle /> : <Check />}
          <span>{notice.text}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNoticeState(null)}>
            <X />
          </button>
        </output>
      )}
    </main>
  );
}
