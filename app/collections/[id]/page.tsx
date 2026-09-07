'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Coins,
  Fingerprint,
  Gem,
  LoaderCircle,
  PackageCheck,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { callApi } from '@/lib/api';

type RedeemMode = 'both' | 'yuanbao' | 'points' | 'none';

type DetailData = {
  collection: {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    rarity: string;
    price: number;
    pointsPrice: number;
    redeemMode: RedeemMode;
    total: number;
    sold: number;
    transferable: boolean;
    imageUrl: string;
    status: string;
  };
  holdings: Array<{
    id: string;
    serialNo: number;
    source: string;
    status: string;
    acquiredAt: string;
  }>;
  balance: number;
  pointsBalance: number;
  settings: { yuanbao: string; points: string };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [source, setSource] = useState<string | null>(null);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [currency, setCurrency] = useState<'yuanbao' | 'points'>('yuanbao');

  const backHref = source === 'vault' ? '/vault/' : source === 'store' ? '/store/' : '/';
  const backLabel = source === 'vault' ? '返回我的藏品' : source === 'store' ? '返回商城' : '返回首页';

  const load = useCallback(async () => {
    try {
      const response = await callApi<DetailData>(`/api/collections/${id}`, { method: 'GET' });
      setData(response.data ?? null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '藏品详情加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const sourceTimer = window.setTimeout(() => {
      setSource(new URLSearchParams(window.location.search).get('from'));
    }, 0);
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(sourceTimer);
      window.clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const purchase = async () => {
    setBusy(true);
    try {
      const result = await callApi('/api/purchase', {
        method: 'POST',
        body: JSON.stringify({ collectionId: id, currency }),
      });
      setNotice({ tone: 'success', message: result.message ?? '收藏成功' });
      await load();
    } catch (reason) {
      setNotice({ tone: 'error', message: reason instanceof Error ? reason.message : '兑换失败' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="detail-stage"><div className="detail-state"><Gem /><LoaderCircle className="spin" /><p>正在读取藏品档案</p></div></main>;
  }

  if (!data || error) {
    return <main className="detail-stage"><section className="detail-state"><X /><h1>暂时无法查看</h1><p>{error || '藏品不存在'}</p><a href={backHref}><ArrowLeft />{backLabel}</a></section></main>;
  }

  const item = data.collection;
  const remaining = Math.max(0, item.total - item.sold);
  const soldPercent = Math.min(100, (item.sold / item.total) * 100);
  const mode = item.redeemMode;
  const effectiveCurrency: 'yuanbao' | 'points' | null =
    mode === 'none'
      ? null
      : mode === 'points'
        ? 'points'
        : mode === 'yuanbao'
          ? 'yuanbao'
          : currency;
  const unitName = effectiveCurrency === 'points' ? data.settings.points : data.settings.yuanbao;
  const price = effectiveCurrency === 'points' ? item.pointsPrice : item.price;
  const balance = effectiveCurrency === 'points' ? data.pointsBalance : data.balance;
  const affordable = balance >= price;

  return (
    <main className="detail-stage">
      <div className="detail-shell">
        <header className="detail-header">
          <a href={backHref} aria-label={backLabel}><ArrowLeft /></a>
          <div><small>STORE · PRODUCT</small><strong>商城详情</strong></div>
          <span><Gem /></span>
        </header>

        <section className="detail-hero">
          <div className={`detail-visual-wrap tone-${item.rarity}`}>
            <span className="detail-edition">NO.{String(item.sold).padStart(4, '0')}</span>
            <CollectibleVisual id={item.id} name={item.name} imageUrl={item.imageUrl} />
          </div>
          <div className="detail-intro">
            <div className="detail-badges"><Badge className={`rarity rarity-${item.rarity}`}>{item.rarity}</Badge>{item.transferable && <Badge variant="outline"><Repeat2 />可转让</Badge>}</div>
            <h1>{item.name}</h1>
            <p>{item.subtitle}</p>
          </div>
        </section>

        <section className="detail-story">
          <small>COLLECTION STORY</small>
          <h2>藏品故事</h2>
          <p>{item.description}</p>
        </section>

        <section className="detail-stock">
          <div><span>流通进度</span><strong>{soldPercent.toFixed(1)}%</strong></div>
          <Progress value={soldPercent} />
          <div><small>已收藏 {formatNumber(item.sold)}</small><small>剩余 {formatNumber(remaining)}</small><small>总量 {formatNumber(item.total)}</small></div>
        </section>

        <section className="detail-facts">
          <article><Fingerprint /><span><small>链上标识</small><strong>{item.id.toUpperCase()} · AUTHENTIC</strong></span></article>
          <article><ShieldCheck /><span><small>发行凭证</small><strong>平台认证数字藏品</strong></span></article>
          <article><PackageCheck /><span><small>我的持有</small><strong>{data.holdings.length} 件</strong></span></article>
        </section>

        {data.holdings.length > 0 && <section className="detail-owned"><div><small>MY EDITIONS</small><h2>我的收藏信息</h2></div><div>{data.holdings.map((holding) => <article key={holding.id}><span>#{String(holding.serialNo).padStart(4, '0')}</span><div><strong>{holding.status === 'normal' ? '正常持有' : '转让处理中'}</strong><small>{holding.source}获得 · {formatDate(holding.acquiredAt)}</small></div><Check /></article>)}</div></section>}

        <footer className="detail-purchase">
          {mode === 'both' && (
            <div className="detail-currency-switch" role="radiogroup" aria-label="选择兑换货币">
              <button
                type="button"
                aria-pressed={currency === 'yuanbao'}
                className={currency === 'yuanbao' ? 'is-active' : ''}
                onClick={() => setCurrency('yuanbao')}
              >
                <Coins />{formatNumber(item.price)} {data.settings.yuanbao}
              </button>
              <button
                type="button"
                aria-pressed={currency === 'points'}
                className={currency === 'points' ? 'is-active' : ''}
                onClick={() => setCurrency('points')}
              >
                <Star />{formatNumber(item.pointsPrice)} {data.settings.points}
              </button>
            </div>
          )}
          <div>
            <small>当前兑换价</small>
            <strong>
              {effectiveCurrency === 'points' ? <Star /> : <Coins />}
              {formatNumber(price)} {unitName}
            </strong>
            <span>余额 {formatNumber(balance)}</span>
          </div>
          <Button
            disabled={busy || item.status !== 'on_sale' || remaining === 0 || mode === 'none' || !affordable}
            onClick={() => void purchase()}
          >
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <Sparkles />
            )}
            {remaining === 0
              ? '已兑完'
              : mode === 'none'
                ? '暂不支持兑换'
                : !affordable
                  ? `${unitName}不足`
                  : '立即收藏'}
          </Button>
        </footer>
      </div>
      {notice && <output className={`detail-toast detail-toast-${notice.tone}`} aria-live="polite">{notice.tone === 'success' ? <Check /> : <X />}<span>{notice.message}</span><button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}><X /></button></output>}
    </main>
  );
}
