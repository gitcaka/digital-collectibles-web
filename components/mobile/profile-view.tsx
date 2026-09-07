'use client';

import { CalendarCheck2, ChevronRight, Coins, LogOut, PackageOpen, ShieldCheck, Star, Ticket, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber } from './format';
import { PageHeader } from './page-header';
import type { AppState, NavigateFn } from './types';

/** 个人中心：身份卡 + 资产汇总 + 功能入口 + 退出登录。 */
export function ProfileView({
  app,
  openCheckin,
  navigate,
  onLogout,
}: {
  app: AppState;
  openCheckin: () => void;
  navigate: NavigateFn;
  onLogout: () => void;
}) {
  return (
    <>
      <PageHeader title="个人中心" onBack={() => navigate('home')} />
      <section className="profile-card">
        <div className="profile-avatar">
          <UserRound />
        </div>
        <div>
          <Badge>{app.user.role === 'admin' ? '管理员' : '藏阁成员'}</Badge>
          <h2>{app.user.displayName}</h2>
          <p>@{app.user.username}</p>
        </div>
      </section>
      <section className="profile-assets">
        <div>
          <Coins />
          <span>
            <small>{app.settings.yuanbao}余额</small>
            <strong>{formatNumber(app.wallet.yuanbao)}</strong>
          </span>
        </div>
        <div>
          <Star />
          <span>
            <small>{app.settings.points}余额</small>
            <strong>{formatNumber(app.points.total)}</strong>
          </span>
        </div>
        <div>
          <PackageOpen />
          <span>
            <small>藏品数量</small>
            <strong>{app.inventory.length}</strong>
          </span>
        </div>
      </section>
      <section className="profile-menu">
        {app.user.role === 'admin' && (
          <button type="button" className="admin-entry" onClick={() => window.location.assign('/admin')}>
            <span>
              <ShieldCheck />
            </span>
            <div>
              <strong>管理后台</strong>
              <small>运营控制台 · 藏品/用户/兑换码</small>
            </div>
            <ChevronRight />
          </button>
        )}
        <button type="button" onClick={() => navigate('redeem')}>
          <span>
            <Ticket />
          </span>
          <div>
            <strong>兑换记录</strong>
            <small>{app.redeemRecords.length} 条记录</small>
          </div>
          <ChevronRight />
        </button>
        <button type="button" onClick={openCheckin}>
          <span>
            <CalendarCheck2 />
          </span>
          <div>
            <strong>签到中心</strong>
            <small>连续 {app.points.streak} 天</small>
          </div>
          <ChevronRight />
        </button>
      </section>
      <Button variant="outline" className="logout-mobile" onClick={onLogout}>
        <LogOut />
        退出登录
      </Button>
    </>
  );
}
