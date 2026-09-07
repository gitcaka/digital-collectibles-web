'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Coins,
  LoaderCircle,
  Repeat2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { callApi } from '@/lib/api';

type TransferDetail = {
  id: string;
  status: string;
  price: number;
  fee: number;
  createdAt: string;
  completedAt: string | null;
  serialNo: number;
  source: string;
  collection: {
    id: string;
    name: string;
    rarity: string;
    imageUrl: string | null;
    transferable: boolean;
  };
  sender: { id: string; username: string; displayName: string };
  recipient: { id: string | null; username: string; displayName: string };
  isSender: boolean;
  isRecipient: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  names: { yuanbao: string; points: string };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusMeta(status: string) {
  if (status === 'pending') return { label: '待确认', tone: 'pending' };
  if (status === 'completed') return { label: '已完成', tone: 'completed' };
  if (status === 'rejected') return { label: '已拒绝', tone: 'rejected' };
  return { label: '已撤销', tone: 'cancelled' };
}

export default function TransferDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await callApi<TransferDetail>(`/api/transfers/${orderId}`, { method: 'GET' });
      setDetail(response.data ?? null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '转让单加载失败');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const act = async (action: 'accept' | 'reject' | 'cancel') => {
    setBusy(action);
    try {
      const result = await callApi('/api/transfers', {
        method: 'PATCH',
        body: JSON.stringify({ orderId, action }),
      });
      setNotice({ tone: 'success', message: result.message ?? '操作成功' });
      await load();
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : '操作失败' });
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <main className="owned-stage">
        <div className="owned-state">
          <LoaderCircle className="spin" />
          <p>正在读取转让单</p>
        </div>
      </main>
    );
  }

  if (!detail || error) {
    return (
      <main className="owned-stage">
        <section className="owned-state">
          <X />
          <h1>无法查看该转让单</h1>
          <p>{error || '转让单不存在或你无权查看'}</p>
          <a href="/vault/">
            <ArrowLeft />
            返回我的藏品
          </a>
        </section>
      </main>
    );
  }

  const status = statusMeta(detail.status);
  const income = detail.price - detail.fee;

  return (
    <main className="owned-stage">
      <div className="owned-shell">
        <header className="owned-header">
          {/* 独立 SSR 页的返回键一律用原生 <a> 整页跳转，避免 next/link 客户端路由（RSC runtime 初始化失败）导致点击无响应 */}
          <a href="/vault/" aria-label="返回我的藏品">
            <ArrowLeft />
          </a>
          <div>
            <small>TRANSFER ORDER</small>
            <strong>转让详情</strong>
          </div>
          <span>
            <Repeat2 />
          </span>
        </header>

        <section className="owned-hero">
          <div className="owned-visual-wrap">
            <span className="owned-edition">#{String(detail.serialNo).padStart(4, '0')}</span>
            <CollectibleVisual
              id={detail.collection.id}
              name={detail.collection.name}
              imageUrl={detail.collection.imageUrl}
            />
          </div>
          <div className="owned-intro">
            <div className="owned-badges">
              <Badge className={`rarity rarity-${detail.collection.rarity}`}>
                {detail.collection.rarity}
              </Badge>
              <Badge variant="outline" className={`status status-${status.tone}`}>
                {status.label}
              </Badge>
              {detail.isSender && <Badge variant="outline">我发起的</Badge>}
              {detail.isRecipient && <Badge variant="outline">待我处理</Badge>}
            </div>
            <h1>{detail.collection.name}</h1>
            <p>收藏编号 #{String(detail.serialNo).padStart(4, '0')} · {detail.source}获得</p>
          </div>
        </section>

        <section className="owned-identity">
          <small>ORDER INFO</small>
          <h2>转让信息</h2>
          <div className="owned-identity-grid">
            <article>
              <span>
                <Coins />
              </span>
              <div>
                <small>转让价格</small>
                <strong>{detail.price > 0 ? `${formatNumber(detail.price)} ${detail.names.yuanbao}` : '免费赠送'}</strong>
              </div>
            </article>
            <article>
              <span>
                <ShieldCheck />
              </span>
              <div>
                <small>平台手续费</small>
                <strong>{formatNumber(detail.fee)} {detail.names.yuanbao}</strong>
              </div>
            </article>
            <article>
              <span>
                <Repeat2 />
              </span>
              <div>
                <small>发起方实收</small>
                <strong>{formatNumber(income)} {detail.names.yuanbao}</strong>
              </div>
            </article>
            <article>
              <span>
                <UserRound />
              </span>
              <div>
                <small>发起时间</small>
                <strong>{formatDate(detail.createdAt)}</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="owned-story">
          <small>PARTIES</small>
          <h2>转让双方</h2>
          <div className="transfer-parties">
            <article>
              <span className="transfer-avatar">{detail.sender.displayName.slice(0, 1)}</span>
              <div>
                <small>转让方</small>
                <strong>{detail.sender.displayName}</strong>
                <em>@{detail.sender.username}</em>
              </div>
            </article>
            <span className="transfer-arrow">
              <Repeat2 />
            </span>
            <article>
              <span className="transfer-avatar is-recipient">
                {(detail.recipient.displayName ?? detail.recipient.username ?? '?').slice(0, 1)}
              </span>
              <div>
                <small>接收方</small>
                <strong>{detail.recipient.displayName || detail.recipient.username || '未指定'}</strong>
                <em>@{detail.recipient.username || '-'}</em>
              </div>
            </article>
          </div>
          {detail.completedAt && (
            <p className="transfer-timeline">
              <Check />
              该转让单已于 {formatDate(detail.completedAt)} 处理完成
            </p>
          )}
          {detail.status === 'pending' && (
            <p className="transfer-timeline is-pending">
              <ShieldCheck />
              等待{detail.recipient.displayName || detail.recipient.username}确认，确认后藏品将立即过户
            </p>
          )}
        </section>

        {(detail.canAccept || detail.canReject || detail.canCancel) && (
          <section className="owned-transfer">
            <div className="section-title">
              <div>
                <small>ACTIONS</small>
                <h2>处理转让</h2>
              </div>
            </div>
            <div className="transfer-detail-actions">
              {detail.canAccept && (
                <Button
                  className="primary-cta"
                  disabled={busy !== ''}
                  onClick={() => void act('accept')}
                >
                  {busy === 'accept' ? <LoaderCircle className="spin" /> : <Check />}
                  确认接收
                </Button>
              )}
              {detail.canReject && (
                <Button variant="outline" disabled={busy !== ''} onClick={() => void act('reject')}>
                  {busy === 'reject' ? <LoaderCircle className="spin" /> : <X />}
                  拒绝转让
                </Button>
              )}
              {detail.canCancel && (
                <Button variant="outline" disabled={busy !== ''} onClick={() => void act('cancel')}>
                  {busy === 'cancel' ? <LoaderCircle className="spin" /> : <X />}
                  撤销转让
                </Button>
              )}
            </div>
            {detail.canAccept && detail.price > 0 && (
              <p className="owned-transfer-note">
                接收将从你的{detail.names.yuanbao}余额扣除 {formatNumber(detail.price)}，
                请确保余额充足。
              </p>
            )}
          </section>
        )}

        <a className="owned-more" href={`/collections/${detail.collection.id}?from=store`}>
          <span>同款藏品</span>
          <strong>前往商城查看「{detail.collection.name}」</strong>
          <small>了解发行量与兑换规则</small>
        </a>
      </div>

      {notice && (
        <output className={`owned-toast toast-${notice.tone}`} aria-live="polite">
          {notice.tone === 'success' ? <Check /> : <X />}
          <span>{notice.message}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X />
          </button>
        </output>
      )}
    </main>
  );
}
