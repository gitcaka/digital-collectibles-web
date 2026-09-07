'use client';

/* oxlint-disable next/no-html-link-for-pages -- 站内整页跳转统一用原生 <a>：vinext 的 next/link 客户端路由(RSC runtime)在生产构建下初始化失败，点击会无响应。 */

import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Coins,
  Fingerprint,
  Gem,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  Repeat2,
  ShieldCheck,
  X,
} from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callApi } from '@/lib/api';

type OwnedItem = {
  id: string;
  collectionId: string;
  serialNo: number;
  source: string;
  status: string;
  acquiredAt: string;
  name: string;
  subtitle: string;
  description: string;
  rarity: string;
  total: number;
  sold: number;
  transferable: boolean;
  imageUrl: string | null;
};

type StateData = {
  user: { displayName: string };
  inventory: OwnedItem[];
  settings: { yuanbao: string; points: string };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export default function OwnedCollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [recipient, setRecipient] = useState('');
  const [price, setPrice] = useState('0');

  const load = useCallback(async () => {
    try {
      const response = await callApi<StateData>('/api/app-state', { method: 'GET' });
      setData(response.data ?? null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '藏品档案加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const startTransfer = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    setBusy('transfer');
    try {
      const result = await callApi('/api/transfers', {
        method: 'POST',
        body: JSON.stringify({
          userCollectionId: id,
          recipientUsername: recipient.trim(),
          price: Number(price || 0),
        }),
      });
      setNotice({ tone: 'success', message: result.message ?? '转让已发起，等待对方确认' });
      setRecipient('');
      setPrice('0');
      await load();
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : '转让发起失败' });
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <main className="owned-stage">
        <div className="owned-state">
          <Gem />
          <LoaderCircle className="spin" />
          <p>正在调取藏品档案</p>
        </div>
      </main>
    );
  }

  if (!data || error) {
    return (
      <main className="owned-stage">
        <section className="owned-state">
          <X />
          <h1>暂时无法查看</h1>
          <p>{error || '藏品不存在'}</p>
          <a href="/vault/" aria-label="返回我的藏品">
            <ArrowLeft />
            返回我的藏品
          </a>
        </section>
      </main>
    );
  }

  const owned = data.inventory.find((item) => item.id === id);
  if (!owned) {
    return (
      <main className="owned-stage">
        <section className="owned-state">
          <LockKeyhole />
          <h1>未找到这件藏品</h1>
          <p>它可能已转让，或不属于当前账号。</p>
          <a href="/vault/">
            <ArrowLeft />
            返回我的藏品
          </a>
        </section>
      </main>
    );
  }

  const holding = owned.status === 'normal';
  const fee = Math.floor(Number(price || 0) * 0.05);
  const serialLabel = `#${String(owned.serialNo).padStart(4, '0')}`;

  return (
    <main className="owned-stage">
      <div className="owned-shell">
        <header className="owned-header">
          {/* 独立 SSR 页的返回键一律用原生 <a> 整页跳转，避免 next/link 客户端路由（RSC runtime 初始化失败）导致点击无响应 */}
          <a href="/vault/" aria-label="返回我的藏品">
            <ArrowLeft />
          </a>
          <div>
            <small>MY COLLECTION</small>
            <strong>藏品详情</strong>
          </div>
          <span>
            <Gem />
          </span>
        </header>

        <section className="owned-hero">
          <div className={`owned-visual-wrap tone-${owned.rarity}`}>
            <span className="owned-edition">{serialLabel}</span>
            <CollectibleVisual id={owned.collectionId} name={owned.name} imageUrl={owned.imageUrl} />
          </div>
          <div className="owned-intro">
            <div className="owned-badges">
              <Badge className={`rarity rarity-${owned.rarity}`}>{owned.rarity}</Badge>
              <Badge variant="outline" className={owned.status === 'transferring' ? 'owned-status transferring' : 'owned-status'}>
                {owned.status === 'transferring' ? <Repeat2 /> : <Check />}
                {owned.status === 'transferring' ? '转让处理中' : '持有中'}
              </Badge>
            </div>
            <h1>{owned.name}</h1>
            <p>{owned.subtitle}</p>
          </div>
        </section>

        <section className="owned-identity">
          <small>PROVENANCE</small>
          <h2>藏品凭证</h2>
          <div className="owned-identity-grid">
            <article>
              <span>
                <Fingerprint />
              </span>
              <div>
                <small>收藏编号</small>
                <strong>{serialLabel}</strong>
              </div>
            </article>
            <article>
              <span>
                <PackageCheck />
              </span>
              <div>
                <small>获得方式</small>
                <strong>{owned.source}</strong>
              </div>
            </article>
            <article>
              <span>
                <CalendarDays />
              </span>
              <div>
                <small>收藏时间</small>
                <strong>{formatDate(owned.acquiredAt)}</strong>
              </div>
            </article>
            <article>
              <span>
                <ShieldCheck />
              </span>
              <div>
                <small>限量状态</small>
                <strong>
                  NO.{owned.id.toUpperCase()} · AUTHENTIC
                </strong>
              </div>
            </article>
          </div>
        </section>

        <section className="owned-story">
          <small>COLLECTION STORY</small>
          <h2>藏品故事</h2>
          <p>{owned.description}</p>
        </section>

        <a className="owned-more" href={`/collections/${owned.collectionId}?from=store`}>
          <span>想再收藏一件同系列藏品？</span>
          <div>
            <strong>前往商城查看该藏品</strong>
            <small>使用元宝或积分兑换同款</small>
          </div>
          <ChevronRight />
        </a>

        {owned.transferable ? (
          holding ? (
            <section className="owned-transfer">
              <div className="section-title">
                <div>
                  <small>TRANSFER</small>
                  <h2>转让这件藏品</h2>
                </div>
                <Repeat2 />
              </div>
              <p className="owned-transfer-note">
                受让方确认后完成过户，有偿转让收取 5% 手续费。转让后编号将随藏品转移。
              </p>
              <form onSubmit={(event) => void startTransfer(event)}>
                <label htmlFor="owned-transfer-user">
                  <span>受让方用户名</span>
                  <Input
                    id="owned-transfer-user"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    autoComplete="off"
                    placeholder="例如 qinghe"
                  />
                </label>
                <label htmlFor="owned-transfer-price">
                  <span>转让价格（{data.settings.yuanbao}）</span>
                  <Input
                    id="owned-transfer-price"
                    inputMode="numeric"
                    value={price}
                    onChange={(event) => setPrice(event.target.value.replace(/\D/g, ''))}
                    placeholder="0 表示免费赠送"
                  />
                </label>
                <div className="owned-fee-row">
                  <span>
                    预计手续费
                    <small>转让价 × 5%</small>
                  </span>
                  <strong>
                    <Coins />
                    {fee} {data.settings.yuanbao}
                  </strong>
                </div>
                <Button type="submit" className="primary-cta" disabled={busy === 'transfer' || !recipient.trim()}>
                  {busy === 'transfer' ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Repeat2 />
                  )}
                  发起转让
                </Button>
              </form>
            </section>
          ) : (
            <section className="owned-pending">
              <span>
                <Repeat2 />
              </span>
              <div>
                <strong>转让处理中</strong>
                <p>待受让方确认期间，藏品暂不可再次发起转让。</p>
              </div>
            </section>
          )
        ) : (
          <section className="owned-pending">
            <span>
              <LockKeyhole />
            </span>
            <div>
              <strong>仅收藏，不可转让</strong>
              <p>该藏品由发行方设置不支持转让。</p>
            </div>
          </section>
        )}
      </div>

      {notice && (
        <output className={`owned-toast toast-${notice.tone}`} aria-live="polite">
          <span>{notice.tone === 'success' ? <Check /> : <X />}</span>
          <p>{notice.message}</p>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X />
          </button>
        </output>
      )}
    </main>
  );
}
