'use client';

import { useState } from 'react';
import { Check, LoaderCircle, Sparkles } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callApi } from '@/lib/api';

import { MediaUploader } from './media-uploader';
import { TransferSegmented } from './transfer-segmented';
import type { RedeemMode } from './shared';
import { adminRarities } from './shared';

export function CollectionCreator({
  names,
  onCreated,
}: {
  names: { yuanbao: string; points: string };
  /** ok=true 表示藏品已创建成功（父级可跳转列表）；ok=false 表示校验/请求失败，表单保留供修改 */
  onCreated: (message: string, ok: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [rarity, setRarity] = useState<string>('稀有');
  const [total, setTotal] = useState('1000');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [price, setPrice] = useState('0');
  const [pointsPrice, setPointsPrice] = useState('0');
  const [redeemMode, setRedeemMode] = useState<RedeemMode>('both');
  const [status, setStatus] = useState<'on_sale' | 'off_sale' | 'archived'>('on_sale');
  const [transferable, setTransferable] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      onCreated('请填写藏品名称', false);
      return;
    }
    if (!description.trim()) {
      onCreated('请填写藏品介绍', false);
      return;
    }
    setBusy(true);
    try {
      const response = await callApi('/api/admin', {
        method: 'POST',
        body: JSON.stringify({
          action: 'collection.create',
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
      onCreated(response.message ?? '藏品已创建', true);
    } catch (reason) {
      onCreated(reason instanceof Error ? reason.message : '创建失败', false);
    } finally {
      setBusy(false);
    }
  };

  const requiresPoints = redeemMode === 'points' || redeemMode === 'both';
  const requiresYuanbao = redeemMode === 'yuanbao' || redeemMode === 'both';

  return (
    <div className="ops-editor">
      <section className="ops-panel ops-editor-form">
        <div className="ops-panel-title">
          <div>
            <small>NEW COLLECTION</small>
            <h3>新增藏品</h3>
          </div>
          <Sparkles />
        </div>
        <p className="ops-editor-hint">先上传素材并填写藏品信息，创建后可立即在用户端商城上架。</p>
        <div className="ops-create-media">
          {imageUrl ? (
            <CollectibleVisual id="preview-new" name={name || '新藏品'} imageUrl={imageUrl} />
          ) : (
            <div className="ops-create-empty">
              <Sparkles />
              <p>上传一张封面来预览藏品效果</p>
            </div>
          )}
          <MediaUploader imageUrl={imageUrl} onPicked={setImageUrl} />
        </div>
        <label htmlFor="create-name">
          <span>藏品名称</span>
          <Input
            id="create-name"
            value={name}
            maxLength={30}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如 测试·流光盏"
          />
        </label>
        <div className="ops-editor-fields">
          <label className="ops-native-select" htmlFor="create-rarity">
            <span>稀有度</span>
            <select id="create-rarity" value={rarity} onChange={(event) => setRarity(event.target.value)}>
              {adminRarities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="create-total">
            <span>发行总量</span>
            <Input
              id="create-total"
              inputMode="numeric"
              value={total}
              onChange={(event) => setTotal(event.target.value.replace(/\D/g, ''))}
              placeholder="例如 1000"
            />
          </label>
        </div>
        <label htmlFor="create-subtitle">
          <span>副标题</span>
          <Input
            id="create-subtitle"
            value={subtitle}
            maxLength={40}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="一句话点题"
          />
        </label>
        <label htmlFor="create-desc">
          <span>藏品介绍</span>
          <textarea
            id="create-desc"
            className="ops-textarea"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="介绍这件藏品的设定与故事"
          />
        </label>
        <div className="ops-form-grid">
          <label htmlFor="create-price">
            <span>{names.yuanbao}价</span>
            <Input
              id="create-price"
              inputMode="numeric"
              disabled={!requiresYuanbao}
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label htmlFor="create-points">
            <span>{names.points}价</span>
            <Input
              id="create-points"
              inputMode="numeric"
              disabled={!requiresPoints}
              value={pointsPrice}
              onChange={(event) => setPointsPrice(event.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <div className="ops-editor-fields">
          <label className="ops-native-select" htmlFor="create-mode">
            <span>兑换方式</span>
            <select id="create-mode" value={redeemMode} onChange={(event) => setRedeemMode(event.target.value as RedeemMode)}>
              <option value="both">同时支持{names.yuanbao}与{names.points}</option>
              <option value="yuanbao">仅{names.yuanbao}</option>
              <option value="points">仅{names.points}</option>
              <option value="none">不支持兑换</option>
            </select>
          </label>
          <label className="ops-native-select" htmlFor="create-status">
            <span>销售状态</span>
            <select id="create-status" value={status} onChange={(event) => setStatus(event.target.value as 'on_sale' | 'off_sale' | 'archived')}>
              <option value="on_sale">立即上架</option>
              <option value="off_sale">暂不上架</option>
              <option value="archived">归档</option>
            </select>
          </label>
        </div>
        <div className="ops-switch-row">
          <span>
            <strong>允许转让</strong>
            <small>开启后持有者可将该藏品转让给他人</small>
          </span>
          <TransferSegmented value={transferable} name={name || '新藏品'} onChange={setTransferable} />
        </div>
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <Check />}
          创建该藏品
        </Button>
      </section>
    </div>
  );
}
