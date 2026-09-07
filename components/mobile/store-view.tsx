'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import { useMemo, useState } from 'react';
import { Coins, Repeat2, Search } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

import { formatNumber, priceTag } from './format';
import { PageHeader } from './page-header';
import type { AppState, NavigateFn } from './types';

const rarityOrder = ['全部', '传说', '史诗', '稀有', '普通'] as const;

function CollectionTile({ item, names }: { item: AppState['collections'][number]; names: AppState['settings'] }) {
  const remaining = Math.max(0, item.total - item.sold);
  const soldOut = remaining === 0 || item.status !== 'on_sale';
  const percent = item.total > 0 ? Math.min(100, Math.round((item.sold / item.total) * 100)) : 100;
  return (
    /* tab 壳内跳转统一用原生 <a>：由 MobileApp 全局 capture 转整页 assign；离开壳也不会因 client router 失效而无响应 */
    <a href={`/collections/${item.id}?from=store`} className="store-card">
      <div className={`store-card-media tone-${item.rarity}`}>
        <CollectibleVisual id={item.id} name={item.name} imageUrl={item.imageUrl} />
        <div className="store-card-tags">
          <Badge className={`rarity rarity-${item.rarity}`}>{item.rarity}</Badge>
          {item.transferable && (
            <span className="store-card-flag">
              <Repeat2 />可转让
            </span>
          )}
        </div>
        {soldOut && <span className="store-card-soldout">已兑完</span>}
      </div>
      <div className="store-card-body">
        <strong className="store-card-name">{item.name}</strong>
        <p className="store-card-sub">{item.subtitle}</p>
        <div className={`store-card-price${item.redeemMode === 'none' ? ' is-muted' : ''}`}>
          <Coins />
          <span>{priceTag(item, names)}</span>
        </div>
        <div className="store-card-stock">
          <span className="store-card-bar">
            <i style={{ width: `${percent}%` }} />
          </span>
          <small>
            余 {formatNumber(remaining)} / {formatNumber(item.total)}
          </small>
        </div>
      </div>
    </a>
  );
}

/** 藏品商城：搜索 + 稀有度筛选 + 双列卡片网格。 */
export function StoreView({ app, navigate }: { app: AppState; navigate: NavigateFn }) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<(typeof rarityOrder)[number]>('全部');

  const filteredCollections = useMemo(
    () =>
      app.collections.filter((item) => {
        const matchesRarity = rarity === '全部' || item.rarity === rarity;
        const matchesSearch = !search.trim() || `${item.name}${item.subtitle}`.toLowerCase().includes(search.trim().toLowerCase());
        return matchesRarity && matchesSearch;
      }),
    [app.collections, rarity, search],
  );

  return (
    <>
      <PageHeader title="藏品商城" onBack={() => navigate('home')} />
      <section className="store-intro">
        <small>本期主题</small>
        <h2>月宫幻境</h2>
        <p>
          用 {app.settings.yuanbao} 或 {app.settings.points} 兑换，每件藏品拥有独立编号。
        </p>
      </section>
      <div className="mobile-search">
        <Search />
        <Input aria-label="搜索藏品" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索藏品" />
      </div>
      <div className="chip-row">
        {rarityOrder.map((item) => (
          <button type="button" key={item} className={rarity === item ? 'active' : ''} onClick={() => setRarity(item)}>
            {item}
          </button>
        ))}
      </div>
      <section className="store-grid">
        {filteredCollections.map((item) => (
          <CollectionTile key={item.id} item={item} names={app.settings} />
        ))}
        {!filteredCollections.length && (
          <EmptyState icon={Search} title="没有找到藏品" hint="换个关键词或稀有度试试" className="grid-span" />
        )}
      </section>
    </>
  );
}
