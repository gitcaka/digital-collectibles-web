'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { AdminSectionProps } from '../shared';

export function SettingsSection({ data, busy, action }: AdminSectionProps) {
  const [form, setForm] = useState({
    yuanbao: data.settings.yuanbao,
    points: data.settings.points,
  });

  return (
    <section className="ops-panel ops-form ops-settings">
      <div className="ops-panel-title">
        <div>
          <small>SYSTEM</small>
          <h2>货币名称设置</h2>
        </div>
        <Settings />
      </div>
      <p className="ops-settings-note">
        修改后将全站实时生效，用户端的「{data.settings.yuanbao}」「{data.settings.points}」文案会同步更新。
      </p>
      <label htmlFor="currency-yuanbao">
        <span>{data.settings.yuanbao} 名称</span>
        <Input
          id="currency-yuanbao"
          value={form.yuanbao}
          maxLength={8}
          onChange={(event) => setForm({ ...form, yuanbao: event.target.value })}
          placeholder="例如 元宝"
        />
      </label>
      <label htmlFor="currency-points">
        <span>{data.settings.points} 名称</span>
        <Input
          id="currency-points"
          value={form.points}
          maxLength={8}
          onChange={(event) => setForm({ ...form, points: event.target.value })}
          placeholder="例如 积分"
        />
      </label>
      <Button
        type="button"
        disabled={busy === 'settings.update'}
        onClick={() =>
          void action('settings.update', {
            action: 'settings.update',
            yuanbaoName: form.yuanbao.trim(),
            pointsName: form.points.trim(),
          })
        }
      >
        <Settings />保存货币名称
      </Button>
    </section>
  );
}
