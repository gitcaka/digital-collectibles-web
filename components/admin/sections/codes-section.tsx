'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { History, LoaderCircle, Search, Sparkles, Ticket, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { callApi } from '@/lib/api';

import type { AdminCode, AdminSectionProps } from '../shared';
import { formatDate } from '../shared';

type UsagePayload = {
  code: {
    id: string;
    code: string;
    title: string;
    kind: string;
    status: string;
    maxTotal: number;
    maxPerUser: number;
    usedCount: number;
    createdAt: string;
  };
  records: Array<{
    id: string;
    code: string;
    reward: string;
    createdAt: string;
    userId: string;
    username: string;
    displayName: string;
  }>;
};

export function CodesSection({ data, busy, action, setNotice }: AdminSectionProps) {
  const [form, setForm] = useState({
    code: '',
    title: '',
    yuanbao: '0',
    points: '0',
    collectionId: '',
    maxTotal: '100',
  });
  const [mode, setMode] = useState<'general' | 'once'>('general');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'general' | 'once'>('general');
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [usageCode, setUsageCode] = useState<AdminCode | null>(null);
  const [usageData, setUsageData] = useState<UsagePayload | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);

  const codeCounts = {
    general: data.codes.filter((item) => item.kind === 'general').length,
    once: data.codes.filter((item) => item.kind === 'once').length,
  };
  const filtered = data.codes
    .filter((item) => item.kind === category)
    .filter((item) => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      return `${item.code}${item.title}`.toLowerCase().includes(keyword);
    });

  const resetForm = () => {
    setForm({ code: '', title: '', yuanbao: '0', points: '0', collectionId: '', maxTotal: '100' });
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const yuanbao = Number(form.yuanbao || 0);
    const points = Number(form.points || 0);
    const collectionId = form.collectionId || undefined;
    if (mode === 'general') {
      void action('create-code', {
        action: 'code.create',
        code: form.code,
        title: form.title,
        yuanbao,
        points,
        collectionId,
        maxTotal: Number(form.maxTotal || 1),
      }).then((result) => {
        if (result) {
          resetForm();
          setGenerated(null);
        }
      });
    } else {
      void action('create-code', {
        action: 'code.generate',
        title: form.title,
        quantity: 1,
        yuanbao,
        points,
        collectionId,
      }).then((result) => {
        if (result) {
          resetForm();
          setGenerated(result.codes ?? []);
        }
      });
    }
  };

  const openUsage = async (code: AdminCode) => {
    setUsageCode(code);
    setUsageData(null);
    setUsageBusy(true);
    try {
      const response = await callApi(`/api/admin/code-usage?id=${encodeURIComponent(code.id)}`);
      setUsageData(response.data as UsagePayload);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '使用记录加载失败');
      setUsageCode(null);
      setUsageData(null);
    } finally {
      setUsageBusy(false);
    }
  };

  const deleteCode = (item: AdminCode) => {
    const usedHint = item.usedCount > 0 ? `该码已被使用 ${item.usedCount} 次，删除会连带移除对应使用记录（已发放奖励不受影响）。` : '该码尚未被使用。';
    if (!window.confirm(`确定删除兑换码 ${item.code}（${item.title}）吗？\n${usedHint}\n删除后不可恢复。`)) return;
    void action(`delete-code-${item.id}`, { action: 'code.delete', codeId: item.id });
  };

  return (
    <>
      <div className="ops-split">
        <form className="ops-panel ops-form" onSubmit={(event) => submit(event)}>
          <div className="ops-panel-title">
            <div>
              <small>NEW CAMPAIGN</small>
              <h2>创建兑换码</h2>
            </div>
            <Ticket />
          </div>
          <div className="ops-code-mode" role="tablist" aria-label="兑换码类型">
            <button type="button" role="tab" aria-selected={mode === 'general'} className={mode === 'general' ? 'is-active' : ''} onClick={() => setMode('general')}>
              <Ticket />通用兑换码
            </button>
            <button type="button" role="tab" aria-selected={mode === 'once'} className={mode === 'once' ? 'is-active' : ''} onClick={() => setMode('once')}>
              <Sparkles />一次性随机码
            </button>
          </div>
          <label htmlFor="new-code-title">
            <span>礼包名称</span>
            <Input
              id="new-code-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder={mode === 'general' ? '中秋月华礼包' : '限时尊享盲盒'}
            />
          </label>
          {mode === 'general' ? (
            <>
              <label htmlFor="new-code">
                <span>兑换码</span>
                <Input id="new-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="MOON-2026" />
              </label>
              <label htmlFor="code-limit">
                <span>总使用次数</span>
                <Input id="code-limit" inputMode="numeric" value={form.maxTotal} onChange={(event) => setForm({ ...form, maxTotal: event.target.value.replace(/\D/g, '') })} />
              </label>
            </>
          ) : (
            <p className="ops-form-hint" id="new-code-once-hint">
              每次提交生成 <b>1</b> 个一次性随机码；需要多个请多次点击。
            </p>
          )}
          <div className="ops-form-grid">
            <label htmlFor="code-yuanbao">
              <span>元宝</span>
              <Input id="code-yuanbao" inputMode="numeric" value={form.yuanbao} onChange={(event) => setForm({ ...form, yuanbao: event.target.value.replace(/\D/g, '') })} />
            </label>
            <label htmlFor="code-points">
              <span>积分</span>
              <Input id="code-points" inputMode="numeric" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value.replace(/\D/g, '') })} />
            </label>
          </div>
          <label className="ops-native-select" htmlFor="reward-collection">
            <span>奖励藏品</span>
            <select
              id="reward-collection"
              value={form.collectionId || 'none'}
              onChange={(event) => setForm({ ...form, collectionId: event.target.value === 'none' ? '' : event.target.value })}
            >
              <option value="none">不发放藏品</option>
              {data.collections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy === 'create-code'}>
            {busy === 'create-code' ? <LoaderCircle className="spin" /> : <Ticket />}
            {mode === 'general' ? '创建通用兑换码' : '生成一个一次性码'}
          </Button>
        </form>
        <section className="ops-panel">
          <div className="ops-panel-title">
            <div>
              <small>CAMPAIGN LIST</small>
              <h2>兑换码列表</h2>
            </div>
            <Badge variant="outline">{data.codes.length} 个</Badge>
          </div>
          {generated && generated.length > 0 && (
            <div className="ops-generated">
              <div className="ops-generated-head">
                <Sparkles />
                <span>本次生成 1 个一次性码</span>
                <button type="button" aria-label="收起" onClick={() => setGenerated(null)}>
                  <X />
                </button>
              </div>
              <ul className="ops-generated-list">
                {generated.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="ops-category-tabs" role="tablist" aria-label="兑换码分类">
            <button type="button" role="tab" aria-selected={category === 'general'} className={category === 'general' ? 'is-active' : ''} onClick={() => setCategory('general')}>
              通用码 <em>{codeCounts.general}</em>
            </button>
            <button type="button" role="tab" aria-selected={category === 'once'} className={category === 'once' ? 'is-active' : ''} onClick={() => setCategory('once')}>
              一次性码 <em>{codeCounts.once}</em>
            </button>
          </div>
          <label className="ops-search" htmlFor="code-search">
            <Search />
            <Input id="code-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索兑换码或礼包名称" />
          </label>
          <div className="ops-code-list">
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="没有匹配的兑换码" hint="换个关键字试试" className="ui-empty-inline" />
            ) : (
              filtered.map((item) => (
                <article key={item.id}>
                  <div>
                    <span className="ops-code-line">
                      <Badge className={`status status-${item.status}`}>{item.status === 'active' ? '启用' : '停用'}</Badge>
                      <Badge variant="outline" className="ops-code-kind">
                        {item.kind === 'once' ? '一次性' : '通用'}
                      </Badge>
                      <strong>{item.code}</strong>
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.rewards || '未配置奖励'}</p>
                    <small>
                      已用 {item.usedCount} / {item.maxTotal}
                      {item.kind === 'once' && '（仅限一次）'}
                    </small>
                  </div>
                  <div className="ops-code-actions">
                    <Button variant="outline" size="sm" onClick={() => void openUsage(item)}>
                      <History />使用记录
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void action(`code-${item.id}`, {
                          action: 'code.toggle',
                          codeId: item.id,
                          status: item.status === 'active' ? 'disabled' : 'active',
                        })
                      }
                    >
                      {item.status === 'active' ? '停用' : '启用'}
                    </Button>
                    <Button variant="outline" size="sm" className="is-danger" onClick={() => deleteCode(item)}>
                      <Trash2 />删除
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <Sheet open={usageCode !== null} onOpenChange={(open) => { if (!open) { setUsageCode(null); setUsageData(null); } }}>
        <SheetContent className="ops-usage-sheet">
          <SheetHeader>
            <SheetTitle>兑换码使用记录</SheetTitle>
            <SheetDescription>{usageCode ? `${usageCode.code} · ${usageCode.title}` : ''}</SheetDescription>
          </SheetHeader>
          {usageBusy ? (
            <div className="ops-usage-loading">
              <LoaderCircle className="spin" />
              <span>正在加载使用记录</span>
            </div>
          ) : usageData?.records && usageData.records.length > 0 ? (
            <ul className="ops-usage-list">
              {usageData.records.map((record) => (
                <li key={record.id}>
                  <div className="ops-usage-user">
                    <strong>{record.displayName || record.username}</strong>
                    <small>@{record.username}</small>
                  </div>
                  <div className="ops-usage-reward">{record.reward}</div>
                  <small className="ops-usage-time">{formatDate(record.createdAt)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={History} title="该兑换码还没有被使用过" className="ui-empty-inline" />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
