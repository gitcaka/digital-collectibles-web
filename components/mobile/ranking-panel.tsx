'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight, Coins, Crown, PackageOpen, Sparkles, Star, Trophy } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';

import { rankingValue } from './format';
import type { CurrencyNames, RankingBoard, RankingKey } from './types';

type Rankings = {
  collections: RankingBoard;
  yuanbao: RankingBoard;
  points: RankingBoard;
  rarity: RankingBoard;
};

/** 与 /rankings 详情页一致的四个榜主题色（accent/light/soft/orb 一套 CSS 变量）。 */
const BOARD_THEME: Record<RankingKey, { accent: string; light: string; soft: string; orb: string }> = {
  collections: { accent: '#7a5fae', light: '#b7a2e0', soft: '#efe9f7', orb: 'rgba(122,95,174,.14)' },
  yuanbao: { accent: '#a8792b', light: '#e3c07d', soft: '#f8eed6', orb: 'rgba(168,121,43,.13)' },
  points: { accent: '#2f9169', light: '#8fcab0', soft: '#e2f3ea', orb: 'rgba(47,145,105,.13)' },
  rarity: { accent: '#5a6fc0', light: '#93a4dd', soft: '#e9edfb', orb: 'rgba(90,111,192,.13)' },
};

const MEDAL_COLORS = ['#c9a24b', '#9aa4b5', '#cf9c6d'];

function boardVars(board: RankingKey): CSSProperties {
  const theme = BOARD_THEME[board];
  return {
    '--rk': theme.accent,
    '--rk-light': theme.light,
    '--rk-soft': theme.soft,
    '--rk-orb': theme.orb,
  } as CSSProperties;
}

function initialOf(name: string) {
  return name.trim().slice(0, 1) || '藏';
}

/** 首页「藏阁排行榜」聚合面板：与 /rankings 详情页同款视觉——迷你领奖台 + 精制行卡 + 榜外卡片。 */
export function RankingPanel({ rankings, names }: { rankings: Rankings; names: CurrencyNames }) {
  const [board, setBoard] = useState<RankingKey>('collections');
  const tabs: Array<{ id: RankingKey; label: string; icon: typeof Coins }> = [
    { id: 'collections', label: '藏品榜', icon: PackageOpen },
    { id: 'yuanbao', label: `${names.yuanbao}榜`, icon: Coins },
    { id: 'points', label: `${names.points}榜`, icon: Star },
    { id: 'rarity', label: '稀有榜', icon: Sparkles },
  ];
  const active = rankings[board];
  const title = tabs.find((tab) => tab.id === board)?.label ?? '排行榜';
  const meInList = active.entries.some((entry) => entry.isMe);

  // 前三名（领奖台按 2-1-3 排布）
  const podium = [
    active.entries.find((entry) => entry.rank === 2) ?? null,
    active.entries.find((entry) => entry.rank === 1) ?? null,
    active.entries.find((entry) => entry.rank === 3) ?? null,
  ];
  const hasPodium = active.entries.some((entry) => entry.rank >= 1 && entry.rank <= 3);
  const rest = active.entries.filter((entry) => entry.rank > 3);

  return (
    <section className="rank-panel rank-panel-v2" style={boardVars(board)}>
      <div className="section-title">
        <div>
          <small>LEADERBOARD</small>
          <h2>藏阁排行榜</h2>
        </div>
        <span className="rank-total">{active.total} 人上榜</span>
      </div>
      <div className="rank-switcher" role="tablist" aria-label="排行榜切换">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={board === id} className={board === id ? 'is-active' : ''} onClick={() => setBoard(id)}>
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {active.entries.length === 0 ? (
        <EmptyState icon={Trophy} title="暂无上榜记录" hint="产生兑换 / 转让后可查看榜单" className="ui-empty-inline" />
      ) : (
        <>
          {hasPodium && (
            <div className="rk-podium" aria-label={`${title}前三名`}>
              {podium.map((entry, slot) =>
                entry ? (
                  <article
                    key={entry.userId}
                    className={`rk-slot ${slot === 1 ? 'rk-slot-one' : slot === 0 ? 'rk-slot-two' : 'rk-slot-three'}${entry.isMe ? ' is-me' : ''}`}
                  >
                    <div className="rk-card">
                      <span className="rk-badge" style={slot === 1 ? undefined : { color: MEDAL_COLORS[slot === 0 ? 1 : 2] }}>
                        {slot === 1 ? <Crown /> : entry.rank}
                      </span>
                      <span className="rk-avatar" style={{ borderColor: MEDAL_COLORS[slot === 0 ? 1 : slot === 1 ? 0 : 2] }}>
                        {initialOf(entry.displayName)}
                      </span>
                      <strong className="rk-name">
                        {entry.displayName}
                        {entry.isMe && <i className="rk-me-pill">我</i>}
                      </strong>
                      <span className="rk-handle">@{entry.username}</span>
                      <em className="rk-value">{rankingValue(board, entry.value, names)}</em>
                    </div>
                    <i className="rk-step" aria-hidden="true" />
                  </article>
                ) : (
                  <span key={`slot-${slot}`} className="rk-slot rk-slot-empty" aria-hidden="true" />
                ),
              )}
            </div>
          )}

          {rest.length > 0 && (
            <div className="rk-list" aria-label={`${title}其余排名`}>
              {rest.map((entry) => (
                <article key={`${entry.userId}-${entry.rank}`} className={`rk-row${entry.isMe ? ' is-me' : ''}`}>
                  <span className="rk-no">NO.{entry.rank}</span>
                  <span className="rk-avatar-sm">{initialOf(entry.displayName)}</span>
                  <div className="rk-who">
                    <strong>
                      {entry.displayName}
                      {entry.isMe && <i className="rk-me-pill">我</i>}
                    </strong>
                    <small>@{entry.username}</small>
                  </div>
                  <em className="rk-val">{rankingValue(board, entry.value, names)}</em>
                </article>
              ))}
            </div>
          )}

          {active.me && !meInList && (
            <div className="rk-outside-card">
              <span className="rk-avatar-sm is-me">{initialOf('我')}</span>
              <div className="rk-who">
                <strong>
                  我
                  <small className="rk-my-rank">当前{title}第 {active.me.rank} 名</small>
                </strong>
              </div>
              <em className="rk-val">{rankingValue(board, active.me.value, names)}</em>
            </div>
          )}
        </>
      )}

      {/* tab 壳内入口用原生 <a>：由 MobileApp 全局 capture 转整页 assign；避免依赖 client router */}
      <a href="/rankings" className="rank-more">
        查看完整榜单
        <ChevronRight />
      </a>
    </section>
  );
}
