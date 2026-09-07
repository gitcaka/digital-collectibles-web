'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, ImagePlus, LoaderCircle, Search } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

import { CollectionCreator } from '../collection-creator';
import { CollectionEditor } from '../collection-editor';
import type { AdminSectionProps } from '../shared';
import { collectionRarityOrder } from '../shared';

/**
 * 藏品管理 section。
 * 三种形态由路由参数驱动：/admin/collections/new（create）、
 * /admin/collections/[id]（detailId）、/admin/collections（列表）。
 */
export function CollectionsSection({
  data,
  detailId = null,
  mode = 'browse',
  busy,
  action,
  setNotice,
  reload,
}: AdminSectionProps & { detailId?: string | null; mode?: 'browse' | 'create' }) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<(typeof collectionRarityOrder)[number]>('全部');
  const [status, setStatus] = useState<'all' | 'on_sale' | 'off_sale' | 'archived'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const target = detailId ? data.collections.find((item) => item.id === detailId) ?? null : null;
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.collections.filter((item) => {
      const matchesRarity = rarity === '全部' || item.rarity === rarity;
      const matchesStatus = status === 'all' || item.status === status;
      const matchesSearch = !keyword || `${item.name}${item.subtitle}${item.rarity}`.toLowerCase().includes(keyword);
      return matchesRarity && matchesStatus && matchesSearch;
    });
  }, [data.collections, rarity, search, status]);

  /** 只在“当前筛选结果内”生效的勾选集合，避免筛选切换后残留不可见的选择。 */
  const chosen = filtered.filter((item) => selected.has(item.id));
  const allChosen = filtered.length > 0 && chosen.length === filtered.length;

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allChosen ? new Set() : new Set(filtered.map((item) => item.id)));
  };

  const clearSelect = () => setSelected(new Set());

  const runBatch = (batchStatus: 'on_sale' | 'off_sale' | 'archived') => {
    const ids = chosen.filter((item) => item.status !== batchStatus).map((item) => item.id);
    if (ids.length === 0) {
      setNotice('所选藏品已是该状态，无需重复操作');
      clearSelect();
      return;
    }
    void action('collections-batch', { action: 'collection.batch', ids, status: batchStatus }).then((result) => {
      if (result) clearSelect();
    });
  };

  return (
    <>
      {mode === 'create' ? (
        <>
          <div className="ops-detail-head">
            <button type="button" className="ops-back-to-list" onClick={() => window.location.assign('/admin/collections')}>
              <ArrowLeft />
              返回藏品列表
            </button>
            <div>
              <small>NEW COLLECTION</small>
              <h2>新增藏品</h2>
            </div>
          </div>
          <CollectionCreator
            names={data.settings}
            onCreated={(message, ok) => {
              if (ok) {
                // 创建成功：短暂提示后回到列表查看新藏品
                setNotice(message);
                window.setTimeout(() => window.location.assign('/admin/collections'), 900);
              } else {
                // 校验/创建失败：仅红条提示，停留在新增页，保留已填内容供修改
                setNotice({ text: message, tone: 'error' });
              }
            }}
          />
        </>
      ) : target ? (
        <>
          <div className="ops-detail-head">
            <button type="button" className="ops-back-to-list" onClick={() => window.location.assign('/admin/collections')}>
              <ArrowLeft />
              返回藏品列表
            </button>
            <div>
              <small>COLLECTION DETAIL</small>
              <h2>{target.name}</h2>
            </div>
          </div>
          <CollectionEditor
            key={target.id}
            item={target}
            names={data.settings}
            onSaved={(message) => {
              setNotice(message);
              void reload();
            }}
          />
        </>
      ) : detailId && data.collections.every((item) => item.id !== detailId) ? (
        <div className="ops-detail-head">
          <button type="button" className="ops-back-to-list" onClick={() => window.location.assign('/admin/collections')}>
            <ArrowLeft />
            返回藏品列表
          </button>
          <div>
            <small>COLLECTION DETAIL</small>
            <h2>藏品不存在</h2>
          </div>
        </div>
      ) : (
        <>
          <div className="ops-list-toolbar">
            <div>
              <strong>{data.collections.length}</strong> 件藏品
              <p>搜索或筛选定位藏品；点击卡片进入详情页编辑，勾选卡片左上角可批量调整状态。</p>
            </div>
            <Button onClick={() => window.location.assign('/admin/collections/new')}>
              <ImagePlus />
              新增藏品
            </Button>
          </div>
          <label className="ops-search" htmlFor="collection-search">
            <Search />
            <Input
              id="collection-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索藏品名称、副标题或稀有度"
            />
          </label>
          <div className="ops-filter-row">
            <div className="ops-filter-group">
              <span>稀有度</span>
              <div className="ops-chips">
                {collectionRarityOrder.map((value) => (
                  <button type="button" key={value} className={rarity === value ? 'is-active' : ''} onClick={() => setRarity(value)}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="ops-filter-group">
              <span>状态</span>
              <div className="ops-chips">
                {(
                  [
                    ['all', '全部'],
                    ['on_sale', '在售'],
                    ['off_sale', '下架'],
                    ['archived', '归档'],
                  ] as const
                ).map(([value, label]) => (
                  <button type="button" key={value} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="ops-batch-bar">
            <span className="ops-batch-info">
              {chosen.length > 0 ? (
                <>
                  已选 <strong>{chosen.length}</strong> 件藏品
                  <button type="button" className="ops-batch-clear" onClick={clearSelect}>
                    取消选择
                  </button>
                </>
              ) : (
                '勾选卡片左上角方框，可批量上架 / 下架 / 归档'
              )}
            </span>
            {chosen.length > 0 && (
              <span className="ops-batch-actions">
                <button type="button" disabled={busy === 'collections-batch'} onClick={() => runBatch('on_sale')}>
                  {busy === 'collections-batch' ? <LoaderCircle className="spin" /> : <Check />}
                  批量上架
                </button>
                <button type="button" disabled={busy === 'collections-batch'} onClick={() => runBatch('off_sale')}>
                  批量下架
                </button>
                <button type="button" className="is-ghost" disabled={busy === 'collections-batch'} onClick={() => runBatch('archived')}>
                  批量归档
                </button>
                <button type="button" className="is-plain" disabled={busy === 'collections-batch'} onClick={toggleSelectAll}>
                  {allChosen ? '取消全选' : '全选当前'}
                </button>
              </span>
            )}
          </div>
          <div className="ops-collection-list">
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="没有匹配的藏品" hint="换个关键字或筛选条件试试" className="ui-empty-inline" />
            ) : (
              filtered.map((item) => {
                const on = selected.has(item.id);
                return (
                  <article key={item.id} className={`ops-collection-card${on ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className={`ops-card-check${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      aria-label={on ? `取消选择「${item.name}」` : `选择「${item.name}」`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <Check />
                    </button>
                    <button
                      type="button"
                      className="ops-collection-card-open"
                      onClick={() => window.location.assign(`/admin/collections/${encodeURIComponent(item.id)}`)}
                      aria-label={`查看「${item.name}」藏品详情`}
                    >
                      <span className="ops-collection-card-media">
                        <CollectibleVisual id={item.id} name={item.name} imageUrl={item.imageUrl} compact />
                      </span>
                      <span className="ops-collection-card-main">
                        <span className="ops-collection-card-head">
                          <span className="ops-collection-card-tags">
                            <Badge className={`rarity rarity-${item.rarity}`}>{item.rarity}</Badge>
                            <Badge variant="outline" className={item.status === 'on_sale' ? 'ops-sale-on' : 'ops-sale-off'}>
                              {item.status === 'on_sale' ? '在售' : item.status === 'off_sale' ? '已下架' : '已归档'}
                            </Badge>
                          </span>
                          <ChevronRight aria-hidden="true" />
                        </span>
                        <strong>{item.name}</strong>
                        {item.subtitle ? <small className="ops-collection-card-sub">{item.subtitle}</small> : null}
                      </span>
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
