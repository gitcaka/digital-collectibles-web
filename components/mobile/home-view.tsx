'use client';

import { CalendarCheck2, Coins, Star } from 'lucide-react';

import { formatNumber } from './format';
import { HomeBanners } from './home-banners';
import { PageHeader } from './page-header';
import { RankingPanel } from './ranking-panel';
import type { AppState, NavigateFn } from './types';

/** 首页：品牌页头 + 轮播 + 快捷入口 + 排行榜聚合。 */
export function HomeView({
  app,
  openCheckin,
  navigate,
}: {
  app: AppState;
  openCheckin: () => void;
  navigate: NavigateFn;
}) {
  return (
    <>
      <PageHeader title="掌中藏阁" />
      <HomeBanners banners={app.banners} />
      <section className="home-quick">
        <div className="section-title">
          <div>
            <small>QUICK ACCESS</small>
            <h2>快捷入口</h2>
          </div>
          <span className="home-quick-hello">Hi，{app.user.displayName}</span>
        </div>
        <div className="quick-grid">
          <button type="button" onClick={openCheckin}>
            <span className="quick-grid-icon tone-checkin">
              <CalendarCheck2 />
            </span>
            <strong>{app.points.signedToday ? '今日已签到' : '每日签到'}</strong>
            <small>连签 {app.points.streak} 天</small>
          </button>
          <button type="button" onClick={() => navigate('profile')}>
            <span className="quick-grid-icon tone-yuanbao">
              <Coins />
            </span>
            <strong>{app.settings.yuanbao}余额</strong>
            <small>{formatNumber(app.wallet.yuanbao)}</small>
          </button>
          <button type="button" onClick={() => navigate('profile')}>
            <span className="quick-grid-icon tone-points">
              <Star />
            </span>
            <strong>{app.settings.points}余额</strong>
            <small>{formatNumber(app.points.total)}</small>
          </button>
        </div>
      </section>
      <RankingPanel rankings={app.rankings} names={app.settings} />
    </>
  );
}
