'use client';

import { useState } from 'react';
import { Check, Coins, LoaderCircle, Sparkles } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callApi } from '@/lib/api';

import { MediaUploader } from './media-uploader';
import { TransferSegmented } from './transfer-segmented';
import type { AdminCollection, RedeemMode } from './shared';
import { adminRarities, formatNumber } from './shared';

export function CollectionEditor({
  item,
  names,
  onSaved,
}: {
  item: AdminCollection;
  names: { yuanbao: string; points: string };
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [subtitle, setSubtitle] = useState(item.subtitle);
  const [description, setDescription] = useState(item.description);
  const [rarity, setRarity] = useState(item.rarity);
  const [total, setTotal] = useState(String(item.total));
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl);
  const [price, setPrice] = useState(String(item.price));
  const [pointsPrice, setPointsPrice] = useState(String(item.pointsPrice));
  const [redeemMode, setRedeemMode] = useState<RedeemMode>(item.redeemMode);
  const [status, setStatus] = useState(item.status);
  const [transferable, setTransferable] = useState(item.transferable);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      onSaved('请填写藏品名称');
      return;
    }
    if (!description.trim()) {
      onSaved('请填写藏品介绍');
      return;
    }
    setBusy(true);
    try {
      const response = await callApi('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'collection.update',
          collectionId: item.id,
          name: name.trim(),
          subtitle: subtitle.trim(),
          description: description.trim(),
          rarity,
          total: Number(total || 0),
          imageUrl: imageUrl || undefined,
          price: Number(price || 0),
          pointsPrice: Number(pointsPrice || 0),
          redeemMode,
          status,
          transferable,
        }),
      });
      onSaved(response.message ?? '藏品设置已保存');
    } catch (reason) {
      onSaved(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  // 允许转让开关：切换后立即保存，无需再点“保存”按钮，避免误以为改不动。
  const persistTransferable = async (next: boolean) => {
    setTransferable(next);
    if (busy) return;
    setBusy(true);
    try {
      await callApi('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'collection.update',
          collectionId: item.id,
          name: name.trim(),
          subtitle: subtitle.trim(),
          description: description.trim(),
          rarity,
          total: Number(total || 0),
          imageUrl: imageUrl || undefined,
          price: Number(price || 0),
          pointsPrice: Number(pointsPrice || 0),
          redeemMode,
          status,
          transferable: next,
        }),
      });
      onSaved(next ? '已允许该藏品转让' : '已禁止该藏品转让');
    } catch (reason) {
      setTransferable(!next);
      onSaved(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const requiresPoints = redeemMode === 'points' || redeemMode === 'both';
  const requiresYuanbao = redeemMode === 'yuanbao' || redeemMode === 'both';

  return (
    <div className="ops-editor">
      <div className="ops-editor-hero">
        <div className="ops-editor-media">
          <CollectibleVisual id={item.id} name={name} imageUrl={imageUrl} />
          <Badge className={`rarity rarity-${rarity}`}>{rarity}</Badge>
          <MediaUploader imageUrl={imageUrl} onPicked={setImageUrl} />
        </div>
        <div className="ops-editor-identity">
          <small>COLLECTION IDENTITY</small>
          <h2>{name || '未命名藏品'}</h2>
          <p>{subtitle || '—'}</p>
          <dl>
            <div>
              <dt>发行总量</dt>
              <dd>{formatNumber(Number(total || 0))} 件</dd>
            </div>
            <div>
              <dt>已收藏</dt>
              <dd>{formatNumber(item.sold)} 件</dd>
            </div>
            <div>
              <dt>流通进度</dt>
              <dd>{Number(total) > 0 ? Math.min(100, Math.round((item.sold / Number(total)) * 100)) : 0}%</dd>
            </div>
          </dl>
          <blockquote>{description || '暂无介绍'}</blockquote>
          <span className="ops-editor-id">发行编号 · {item.id.toUpperCase()}</span>
        </div>
      </div>

      <section className="ops-panel ops-editor-form">
        <div className="ops-panel-title">
          <div>
            <small>IDENTITY</small>
            <h3>藏品信息</h3>
          </div>
          <Sparkles />
        </div>
        <p className="ops-editor-hint">名称、副标题、介绍、稀有度与发行量均可调整；保存后用户端实时生效。</p>
        <label htmlFor={`name-${item.id}`}>
          <span>藏品名称</span>
          <Input
            id={`name-${item.id}`}
            value={name}
            maxLength={30}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如 月宫·嫦娥"
          />
        </label>
        <div className="ops-editor-fields">
          <label className="ops-native-select" htmlFor={`rarity-${item.id}`}>
            <span>稀有度</span>
            <select id={`rarity-${item.id}`} value={rarity} onChange={(event) => setRarity(event.target.value)}>
              {adminRarities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`total-${item.id}`}>
            <span>发行总量</span>
            <Input
              id={`total-${item.id}`}
              inputMode="numeric"
              value={total}
              onChange={(event) => setTotal(event.target.value.replace(/\D/g, ''))}
              placeholder="例如 2000"
            />
          </label>
        </div>
        <label htmlFor={`subtitle-${item.id}`}>
          <span>副标题</span>
          <Input
            id={`subtitle-${item.id}`}
            value={subtitle}
            maxLength={40}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="一句话点题"
          />
        </label>
        <label htmlFor={`desc-${item.id}`}>
          <span>藏品介绍</span>
          <textarea
            id={`desc-${item.id}`}
            className="ops-textarea"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="介绍这件藏品的设定与故事"
          />
        </label>
      </section>

      <section className="ops-panel ops-editor-form">
        <div className="ops-panel-title">
          <div>
            <small>PRICING & RULES</small>
            <h3>定价与兑换规则</h3>
          </div>
          <Coins />
        </div>
        <div className="ops-form-grid">
          <label htmlFor={`price-${item.id}`}>
            <span>{names.yuanbao}价</span>
            <Input
              id={`price-${item.id}`}
              inputMode="numeric"
              disabled={!requiresYuanbao}
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label htmlFor={`points-${item.id}`}>
            <span>{names.points}价</span>
            <Input
              id={`points-${item.id}`}
              inputMode="numeric"
              disabled={!requiresPoints}
              value={pointsPrice}
              onChange={(event) => setPointsPrice(event.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <div className="ops-editor-fields">
          <label className="ops-native-select" htmlFor={`mode-${item.id}`}>
            <span>兑换方式</span>
            <select id={`mode-${item.id}`} value={redeemMode} onChange={(event) => setRedeemMode(event.target.value as RedeemMode)}>
              <option value="both">同时支持{names.yuanbao}与{names.points}</option>
              <option value="yuanbao">仅{names.yuanbao}</option>
              <option value="points">仅{names.points}</option>
              <option value="none">不支持兑换</option>
            </select>
          </label>
          <label className="ops-native-select" htmlFor={`status-${item.id}`}>
            <span>销售状态</span>
            <select id={`status-${item.id}`} value={status} onChange={(event) => setStatus(event.target.value as AdminCollection['status'])}>
              <option value="on_sale">上架</option>
              <option value="off_sale">下架</option>
              <option value="archived">归档</option>
            </select>
          </label>
        </div>
        <div className="ops-switch-row">
          <span>
            <strong>允许转让</strong>
            <small>关闭后不可发起新转让</small>
          </span>
          <TransferSegmented value={transferable} name={name} onChange={(next) => void persistTransferable(next)} />
        </div>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <Check />}
          保存该藏品设置
        </Button>
      </section>
    </div>
  );
}
