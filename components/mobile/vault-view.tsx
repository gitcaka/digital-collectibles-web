'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { ChevronRight, Coins, LoaderCircle, PackageOpen, Repeat2 } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { formatNumber } from './format';
import { PageHeader } from './page-header';
import type { AppState, InventoryItem, NavigateFn, PerformFn } from './types';

/** 我的藏品：持有列表 + 转让记录 + 发起转让底部抽屉。 */
export function VaultView({
  app,
  busy,
  perform,
  navigate,
}: {
  app: AppState;
  busy: string;
  perform: PerformFn;
  navigate: NavigateFn;
}) {
  const [selectedOwned, setSelectedOwned] = useState<InventoryItem | null>(null);
  const [transferUser, setTransferUser] = useState('qinghe');
  const [transferPrice, setTransferPrice] = useState('0');

  const pendingTransfers = app.transfers.filter((item) => item.status === 'pending');
  const transferableCount = app.inventory.filter((item) => item.transferable && item.status === 'normal').length;

  const startTransfer = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOwned) return;
    void perform('transfer-create', '/api/transfers', {
      userCollectionId: selectedOwned.id,
      recipientUsername: transferUser,
      price: Number(transferPrice || 0),
    }).then((result) => {
      if (result.success) setSelectedOwned(null);
    });
  };

  return (
    <>
      <PageHeader title="我的藏品" onBack={() => navigate('home')} />
      <section className="vault-summary">
        <div>
          <small>MY ARCHIVE</small>
          <h2>
            {app.inventory.length}
            <span> 件藏品</span>
          </h2>
          <p>每件藏品均拥有独立收藏编号</p>
        </div>
        <div>
          <span>
            <strong>{transferableCount}</strong>
            <small>可转让</small>
          </span>
          <span>
            <strong>{pendingTransfers.length}</strong>
            <small>待处理</small>
          </span>
        </div>
      </section>
      <Tabs defaultValue="collections" className="vault-tabs">
        <TabsList>
          <TabsTrigger value="collections">
            我的收藏 <span>{app.inventory.length}</span>
          </TabsTrigger>
          <TabsTrigger value="transfers">
            转让记录 <span>{pendingTransfers.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="collections">
          <div className="vault-collection-grid">
            {app.inventory.map((owned) => (
              <article className="vault-collection-card" key={owned.id}>
                <a href={`/vault/${owned.id}`} className="vault-card-link">
                  <div className={`vault-card-media tone-${owned.rarity}`}>
                    <CollectibleVisual id={owned.collectionId} name={owned.name} imageUrl={owned.imageUrl} />
                    <span>#{String(owned.serialNo).padStart(4, '0')}</span>
                  </div>
                  <div className="vault-card-copy">
                    <span>
                      <Badge className={`rarity rarity-${owned.rarity}`}>{owned.rarity}</Badge>
                      <small>{owned.status === 'transferring' ? '转让中' : '持有中'}</small>
                    </span>
                    <h2>{owned.name}</h2>
                    <p>收藏编号 #{String(owned.serialNo).padStart(4, '0')}</p>
                  </div>
                </a>
                <footer>
                  <a href={`/vault/${owned.id}`}>
                    藏品详情 <ChevronRight />
                  </a>
                  {owned.transferable ? (
                    <Button variant="outline" disabled={owned.status !== 'normal'} onClick={() => setSelectedOwned(owned)}>
                      <Repeat2 />
                      {owned.status === 'normal' ? '转让' : '处理中'}
                    </Button>
                  ) : (
                    <span>仅收藏</span>
                  )}
                </footer>
              </article>
            ))}
            {!app.inventory.length && (
              <div className="vault-empty">
                <PackageOpen />
                <strong>藏品库还是空的</strong>
                <small>前往商城收藏第一件藏品</small>
                <Button onClick={() => navigate('store')}>浏览商城</Button>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="transfers">
          <div className="vault-transfer-list">
            {app.transfers.map((order) => {
              const incoming = order.recipientUserId === app.user.id;
              return (
                <article key={order.id}>
                  <span className="vault-transfer-icon">
                    <Repeat2 />
                  </span>
                  <a href={`/transfers/${order.id}`} className="vault-transfer-main">
                    <span>
                      <Badge variant="outline">{incoming ? '待我接收' : '我发起的'}</Badge>
                      <Badge className={`status status-${order.status}`}>
                        {order.status === 'pending'
                          ? '待确认'
                          : order.status === 'completed'
                            ? '已完成'
                            : order.status === 'rejected'
                              ? '已拒绝'
                              : '已撤销'}
                      </Badge>
                    </span>
                    <h2>{order.name}</h2>
                    <p>{incoming ? `${order.senderDisplayName} 向你转让` : `转让给 ${order.recipientUsername}`}</p>
                    <strong>
                      <Coins />
                      {order.price ? formatNumber(order.price) : '免费'}
                    </strong>
                    <em className="vault-transfer-go">
                      查看详情 <ChevronRight />
                    </em>
                  </a>
                  {order.status === 'pending' && (
                    <div className="transfer-actions">
                      {incoming ? (
                        <>
                          <Button onClick={() => void perform(`transfer-${order.id}`, '/api/transfers', { orderId: order.id, action: 'accept' }, 'PATCH')}>接收</Button>
                          <Button variant="ghost" onClick={() => void perform(`transfer-${order.id}`, '/api/transfers', { orderId: order.id, action: 'reject' }, 'PATCH')}>
                            拒绝
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" onClick={() => void perform(`transfer-${order.id}`, '/api/transfers', { orderId: order.id, action: 'cancel' }, 'PATCH')}>
                          撤销
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {!app.transfers.length && (
              <EmptyState
                icon={Repeat2}
                title="还没有转让记录"
                hint="可从藏品卡片发起转让"
                className="vault-empty"
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet
        open={selectedOwned !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOwned(null);
        }}
      >
        <SheetContent side="bottom" className="mobile-sheet transfer-sheet">
          {selectedOwned && (
            <>
              <SheetHeader>
                <SheetTitle>转让「{selectedOwned.name}」</SheetTitle>
                <SheetDescription>受让方确认后完成过户，有偿转让收取 5% 手续费。</SheetDescription>
              </SheetHeader>
              <div className="transfer-selected">
                <CollectibleVisual id={selectedOwned.collectionId} name={selectedOwned.name} imageUrl={selectedOwned.imageUrl} compact />
                <div>
                  <strong>#{String(selectedOwned.serialNo).padStart(4, '0')}</strong>
                  <small>{selectedOwned.source}获得</small>
                </div>
              </div>
              <form id="transfer-create" onSubmit={(event) => startTransfer(event)}>
                <label htmlFor="transfer-user">
                  受让方用户名
                  <Input id="transfer-user" value={transferUser} onChange={(event) => setTransferUser(event.target.value)} placeholder="例如 qinghe" />
                </label>
                <label htmlFor="transfer-price">
                  转让价格（元宝）
                  <Input
                    id="transfer-price"
                    inputMode="numeric"
                    value={transferPrice}
                    onChange={(event) => setTransferPrice(event.target.value.replace(/\D/g, ''))}
                    placeholder="0 表示免费"
                  />
                </label>
                <div className="fee-row">
                  <span>预计手续费</span>
                  <strong>
                    {Math.floor(Number(transferPrice || 0) * 0.05)} {app.settings.yuanbao}
                  </strong>
                </div>
              </form>
              <SheetFooter>
                <Button form="transfer-create" type="submit" className="primary-cta" disabled={busy === 'transfer-create'}>
                  {busy === 'transfer-create' ? <LoaderCircle className="spin" /> : '确认发起转让'}
                  <Repeat2 />
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
