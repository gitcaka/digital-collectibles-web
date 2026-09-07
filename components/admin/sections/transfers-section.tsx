'use client';

import { useCallback, useState } from 'react';
import { LoaderCircle, Repeat2 } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { callApi } from '@/lib/api';

import type { AdminSectionProps, AdminTransferDetail } from '../shared';
import { formatDate, formatNumber, statusText } from '../shared';

export function TransfersSection({ data }: AdminSectionProps) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<AdminTransferDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const openDetail = useCallback(async (item: { id: string; name: string }) => {
    setTarget(item);
    setDetail(null);
    setBusy(true);
    try {
      const response = await callApi<AdminTransferDetail>(`/api/transfers/${encodeURIComponent(item.id)}`, { method: 'GET' });
      setDetail(response.data ?? null);
    } catch {
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <section className="ops-panel">
        <div className="ops-panel-title">
          <div>
            <small>TRANSFER ORDERS</small>
            <h2>全部转让单</h2>
          </div>
          <Badge variant="outline">{data.transfers.length} 笔</Badge>
        </div>
        <p className="ops-transfer-hint">点击任意一条转让单查看双方、金额与进度详情。</p>
        <div className="ops-transfer-list">
          {data.transfers.map((item) => (
            <button type="button" key={item.id} className="ops-transfer-row-click" aria-label={`查看「${item.name}」转让详情`} onClick={() => void openDetail(item)}>
              <span>
                <Repeat2 />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.senderUsername} → {item.recipientUsername}
                </small>
              </div>
              <div>
                <strong>{item.price ? `${formatNumber(item.price)} 元宝` : '免费'}</strong>
                <small>手续费 {item.fee}</small>
              </div>
              <time>{formatDate(item.createdAt)}</time>
              <Badge className={`status status-${item.status}`}>{statusText(item.status)}</Badge>
            </button>
          ))}
        </div>
      </section>

      <Sheet open={target !== null} onOpenChange={(open) => { if (!open) { setTarget(null); setDetail(null); } }}>
        <SheetContent className="ops-transfer-sheet">
          <SheetHeader>
            <SheetTitle>转让单详情</SheetTitle>
            <SheetDescription>{target ? `${target.name} · ${detail?.id ?? ''}` : ''}</SheetDescription>
          </SheetHeader>
          {busy ? (
            <div className="ops-inline-state">
              <LoaderCircle className="spin" />
              <span>正在读取转让单</span>
            </div>
          ) : detail ? (
            <div className="ops-transfer-detail">
              <div className="ops-transfer-detail-media">
                <CollectibleVisual id={detail.collection.id} name={detail.collection.name} imageUrl={detail.collection.imageUrl} compact />
                <div>
                  <span>
                    <Badge className={`rarity rarity-${detail.collection.rarity}`}>{detail.collection.rarity}</Badge>
                    <Badge className={`status status-${detail.status}`}>{statusText(detail.status)}</Badge>
                  </span>
                  <strong>{detail.collection.name}</strong>
                  <small>
                    #{String(detail.serialNo).padStart(4, '0')} · {detail.source}获得
                  </small>
                </div>
              </div>
              <div className="ops-transfer-detail-parties">
                <article>
                  <small>转让方</small>
                  <strong>{detail.sender.displayName}</strong>
                  <em>@{detail.sender.username}</em>
                </article>
                <span className="ops-transfer-detail-arrow">
                  <Repeat2 />
                </span>
                <article>
                  <small>接收方</small>
                  <strong>{detail.recipient.displayName || detail.recipient.username || '未指定'}</strong>
                  <em>@{detail.recipient.username || '-'}</em>
                </article>
              </div>
              <dl className="ops-transfer-detail-facts">
                <div>
                  <dt>转让价格</dt>
                  <dd>{detail.price > 0 ? `${formatNumber(detail.price)} ${detail.names.yuanbao}` : '免费赠送'}</dd>
                </div>
                <div>
                  <dt>平台手续费</dt>
                  <dd>
                    {formatNumber(detail.fee)} {detail.names.yuanbao}
                  </dd>
                </div>
                <div>
                  <dt>发起方实收</dt>
                  <dd>
                    {formatNumber(Math.max(0, detail.price - detail.fee))} {detail.names.yuanbao}
                  </dd>
                </div>
                <div>
                  <dt>发起时间</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
                {detail.completedAt && (
                  <div>
                    <dt>处理时间</dt>
                    <dd>{formatDate(detail.completedAt)}</dd>
                  </div>
                )}
              </dl>
              <p className="ops-transfer-detail-note">后台仅可查看转让详情；接收、拒绝或撤销需由相关用户在用户端操作。</p>
            </div>
          ) : (
            <p className="ops-empty">转让单不存在或已删除</p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
