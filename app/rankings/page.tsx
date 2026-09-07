'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Coins, Crown, LoaderCircle, PackageOpen, Sparkles, Star, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { callApi } from '@/lib/api';

type RankingKey = 'collections' | 'yuanbao' | 'points' | 'rarity';

type Entry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  value: number;
  isMe: boolean;
};

type BoardPayload = {
  board: RankingKey;
  entries: Entry[];
  me: { rank: number; value: number } | null;
  total: number;
  nextCursor: number | null;
  names: { yuanbao: string; points: string };
};

const PAGE_SIZE = 15;

/** 每个榜的专属主题色与文案。 */
const BOARD_META: Record<
  RankingKey,
  { accent: string; light: string; soft: string; orb: string; tagline: string; icon: typeof Coins }
> = {
  collections: { accent: '#7a5fae', light: '#b7a2e0', soft: '#efe9f7', orb: 'rgba(122,95,174,.14)', tagline: '藏品盈箧 · 以多为尊', icon: PackageOpen },
  yuanbao: { accent: '#a8792b', light: '#e3c07d', soft: '#f8eed6', orb: 'rgba(168,121,43,.13)', tagline: '财帛流金 · 富甲藏界', icon: Coins },
  points: { accent: '#2f9169', light: '#8fcab0', soft: '#e2f3ea', orb: 'rgba(47,145,105,.13)', tagline: '日积月累 · 厚积薄发', icon: Star },
  rarity: { accent: '#5a6fc0', light: '#93a4dd', soft: '#e9edfb', orb: 'rgba(90,111,192,.13)', tagline: '稀世之珍 · 独步天下', icon: Sparkles },
};

type BoardMeta = (typeof BOARD_META)[RankingKey];

const MEDAL_COLORS = ['#c9a24b', '#9aa4b5', '#cf9c6d'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function valueLabel(board: RankingKey, value: number, names: { yuanbao: string; points: string }) {
  if (board === 'collections') return `${formatNumber(value)} 件`;
  if (board === 'yuanbao') return `${formatNumber(value)} ${names.yuanbao}`;
  if (board === 'points') return `${formatNumber(value)} ${names.points}`;
  return `${formatNumber(value)} 稀有值`;
}

function boardTitle(board: RankingKey, names: { yuanbao: string; points: string }) {
  if (board === 'collections') return '藏品榜';
  if (board === 'yuanbao') return `${names.yuanbao}榜`;
  if (board === 'points') return `${names.points}榜`;
  return '稀有榜';
}

function boardVars(meta: BoardMeta): CSSProperties {
  return {
    '--rk': meta.accent,
    '--rk-light': meta.light,
    '--rk-soft': meta.soft,
    '--rk-orb': meta.orb,
  } as CSSProperties;
}

function initialOf(name: string) {
  return name.trim().slice(0, 1) || '藏';
}

export default function RankingsPage() {
  const [board, setBoard] = useState<RankingKey>('collections');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<{ rank: number; value: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<number | null>(0);
  const [names, setNames] = useState({ yuanbao: '元宝', points: '积分' });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (target: RankingKey, from: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await callApi<BoardPayload>(
          `/api/rankings?board=${target}&cursor=${from}&limit=${PAGE_SIZE}`,
        );
        const payload = response.data;
        if (!payload) return;
        setNames(payload.names);
        setMe(payload.me);
        setTotal(payload.total);
        setCursor(payload.nextCursor);
        setEntries((current) => (append ? [...current, ...payload.entries] : payload.entries));
        setError('');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '榜单加载失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(board, 0, false), 0);
    return () => window.clearTimeout(timer);
  }, [board, load]);

  // 下滑到底部自动追加下一页
  useEffect(() => {
    const node = sentinel.current;
    if (!node || cursor === null) return;
    const observer = new IntersectionObserver(
      (records) => {
        if (records[0]?.isIntersecting && !loadingMore && !loading) {
          void load(board, cursor, true);
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [board, cursor, loading, loadingMore, load]);

  const meta = BOARD_META[board];
  const HeroIcon = meta.icon;
  const title = boardTitle(board, names);
  const meInList = entries.some((entry) => entry.isMe);

  // 前三名（领奖台按 2-1-3 排布）
  const podium = [
    entries.find((entry) => entry.rank === 2) ?? null,
    entries.find((entry) => entry.rank === 1) ?? null,
    entries.find((entry) => entry.rank === 3) ?? null,
  ];
  const hasPodium = entries.some((entry) => entry.rank <= 3 && entry.rank >= 1);
  const rest = entries.filter((entry) => entry.rank > 3);

  return (
    <main className="mobile-stage">
      <div className="phone-shell app-phone">
        <header className="view-header">
          {/* 独立 SSR 页返回走原生整页跳转，不依赖 next/link 客户端路由（vinext RSC runtime 在部分构建下初始化失败会无响应） */}
          <a href="/" aria-label="返回首页">
            <ArrowLeft />
          </a>
          <h1>藏阁排行榜</h1>
          <span className="brand-gem">
            <Trophy />
          </span>
        </header>

        <div className="rank-page rank-page-v2" style={boardVars(meta)}>
          <div className="rank-switcher" role="tablist" aria-label="排行榜切换">
            {Object.entries(BOARD_META).map(([id, tab]) => {
              const key = id as RankingKey;
              const Icon = tab.icon;
              const active = board === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'is-active' : ''}
                  onClick={() => setBoard(key)}
                >
                  <Icon />
                  <span>{boardTitle(key, names)}</span>
                </button>
              );
            })}
          </div>

          <section className="rk-hero">
            <span className="rk-hero-medal">
              <HeroIcon />
            </span>
            <div className="rk-hero-copy">
              <small>LEADERBOARD</small>
              <h2>{title}</h2>
              <p>{meta.tagline}</p>
            </div>
            <div className="rk-hero-count">
              <strong>{total}</strong>
              <span>位藏家上榜</span>
            </div>
          </section>

          <p className="rk-subtotal">
            全榜 <b>{total}</b> 人 · 当前展示 <b>{entries.length}</b> 人
          </p>

          {error && !loading && (
            <div className="rk-error">
              {error}
              <button type="button" onClick={() => void load(board, 0, false)}>
                重试
              </button>
            </div>
          )}

          {loading ? (
            <div className="rank-loading">
              <LoaderCircle className="spin" />
              正在加载榜单
            </div>
          ) : entries.length === 0 && !error ? (
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
                          <em className="rk-value">{valueLabel(board, entry.value, names)}</em>
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
                      <em className="rk-val">{valueLabel(board, entry.value, names)}</em>
                    </article>
                  ))}
                </div>
              )}

              {!hasPodium && rest.length === 0 && (
                <div className="rk-empty-line">本榜暂无人上榜，快去产生第一笔兑换吧</div>
              )}

              {me && !meInList && (
                <div className="rk-outside-card">
                  <span className="rk-avatar-sm is-me">{initialOf('我')}</span>
                  <div className="rk-who">
                    <strong>
                      我
                      <small className="rk-my-rank">当前{title}第 {me.rank} 名</small>
                    </strong>
                  </div>
                  <em className="rk-val">{valueLabel(board, me.value, names)}</em>
                </div>
              )}

              {cursor !== null && !loading && (
                <div ref={sentinel} className="rank-sentinel">
                  {loadingMore ? <LoaderCircle className="spin" /> : <span>下滑加载更多</span>}
                </div>
              )}
              {cursor === null && entries.length > 0 && !loading && (
                <div className="rank-sentinel is-end">已经到底啦 · 全榜共 {total} 位</div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
