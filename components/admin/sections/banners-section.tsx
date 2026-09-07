'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { ImagePlus, PencilLine, Trash2 } from 'lucide-react';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

import type { AdminSectionProps } from '../shared';

export function BannersSection({ data, busy, action }: AdminSectionProps) {
  const [form, setForm] = useState({ bannerId: '', title: '', imageUrl: '', link: '', sortOrder: '0' });

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {
      action: form.bannerId ? 'banner.update' : 'banner.create',
      title: form.title,
      imageUrl: form.imageUrl,
      link: form.link,
      sortOrder: Number(form.sortOrder || 0),
    };
    if (form.bannerId) payload.bannerId = form.bannerId;
    void action(form.bannerId ? 'banner.save' : 'banner.create', payload).then((result) => {
      if (result) setForm({ bannerId: '', title: '', imageUrl: '', link: '', sortOrder: '0' });
    });
  };

  return (
    <div className="ops-split">
      <form className="ops-panel ops-form" onSubmit={(event) => submit(event)}>
        <div className="ops-panel-title">
          <div>
            <small>{form.bannerId ? 'EDIT BANNER' : 'NEW BANNER'}</small>
            <h2>{form.bannerId ? '编辑横幅' : '新增横幅'}</h2>
          </div>
          <ImagePlus />
        </div>
        <label htmlFor="banner-title">
          <span>横幅标题</span>
          <Input id="banner-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="中秋限定活动" />
        </label>
        <label htmlFor="banner-image">
          <span>图片地址</span>
          <Input id="banner-image" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://.../banner.png" />
        </label>
        <label htmlFor="banner-link">
          <span>跳转链接（可选）</span>
          <Input id="banner-link" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="留空则不跳转" />
        </label>
        <label htmlFor="banner-sort">
          <span>排序值（越小越靠前）</span>
          <Input
            id="banner-sort"
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: event.target.value.replace(/\D/g, '') })}
          />
        </label>
        <div className="ops-form-actions">
          <Button type="submit" disabled={busy === 'banner.create' || busy === 'banner.save'}>
            {form.bannerId ? '保存修改' : '添加横幅'}
          </Button>
          {form.bannerId && (
            <Button type="button" variant="ghost" onClick={() => setForm({ bannerId: '', title: '', imageUrl: '', link: '', sortOrder: '0' })}>
              取消编辑
            </Button>
          )}
        </div>
      </form>
      <section className="ops-panel">
        <div className="ops-panel-title">
          <div>
            <small>BANNER LIST</small>
            <h2>横幅列表</h2>
          </div>
          <Badge variant="outline">{data.banners.length} 个</Badge>
        </div>
        <div className="ops-banner-list">
          {data.banners.length === 0 ? (
            <EmptyState icon={ImagePlus} title="还没有横幅" hint="点击上方「添加横幅」上传第一张首页轮播" className="ui-empty-inline" />
          ) : (
            data.banners.map((item) => (
              <article key={item.id}>
                <div className="ops-banner-thumb">
                  {item.imageUrl ? <Image src={item.imageUrl} alt={item.title} fill sizes="120px" unoptimized /> : <span>无图</span>}
                </div>
                <div className="ops-banner-meta">
                  <strong>{item.title}</strong>
                  <small>
                    排序 {item.sortOrder} · {item.status === 'active' ? '启用中' : '已停用'}
                  </small>
                  {item.link && <small className="ops-banner-link">{item.link}</small>}
                </div>
                <div className="ops-banner-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ bannerId: item.id, title: item.title, imageUrl: item.imageUrl, link: item.link ?? '', sortOrder: String(item.sortOrder) })}
                  >
                    <PencilLine />编辑
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void action(`banner-${item.id}`, { action: 'banner.delete', bannerId: item.id })}>
                    <Trash2 />删除
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
