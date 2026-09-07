'use client';

import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import { Gift, LoaderCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { formatDate } from './format';
import { PageHeader } from './page-header';
import type { AppState, NavigateFn, PerformFn } from './types';

/** 兑换中心：兑换码输入 + 兑换记录。 */
export function RedeemView({
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
  const [quickCode, setQuickCode] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = quickCode.trim();
    if (!code) return;
    void perform('redeem', '/api/redeem', { code }).then((result) => {
      if (result.success) setQuickCode('');
    });
  };

  return (
    <>
      <PageHeader title="兑换中心" onBack={() => navigate('home')} />
      <section className="redeem-card">
        <span className="ticket-mark">
          <Gift />
        </span>
        <small>REWARD CODE</small>
        <h2>
          一枚兑换码，
          <br />
          开启一份惊喜。
        </h2>
        <form onSubmit={(event) => submit(event)}>
          <label htmlFor="redeem-input">兑换码</label>
          <Input id="redeem-input" value={quickCode} onChange={(event) => setQuickCode(event.target.value.toUpperCase())} placeholder="例如 VIP-2026" />
          <Button type="submit" className="primary-cta" disabled={busy === 'redeem'}>
            {busy === 'redeem' ? <LoaderCircle className="spin" /> : '确认兑换'}
            <Gift />
          </Button>
        </form>
        <div className="code-samples">
          <span>试用码</span>
          {['VIP-2026', 'YUANBAO88', 'MEET-QILIN'].map((code) => (
            <button type="button" key={code} onClick={() => setQuickCode(code)}>
              {code}
            </button>
          ))}
        </div>
      </section>
      <section className="records-mobile">
        <div className="section-title">
          <div>
            <small>HISTORY</small>
            <h2>兑换记录</h2>
          </div>
          <Badge variant="outline">{app.redeemRecords.length} 条</Badge>
        </div>
        {app.redeemRecords.length ? (
          app.redeemRecords.map((record) => (
            <div key={`${record.code}-${record.createdAt}`}>
              <span>
                <Gift />
              </span>
              <div>
                <strong>{record.reward}</strong>
                <small>{record.code}</small>
              </div>
              <time>{formatDate(record.createdAt)}</time>
            </div>
          ))
        ) : (
          <EmptyState icon={Gift} title="暂时没有兑换记录" hint="兑换任意礼包码后会记录在这里" className="ui-empty-inline" />
        )}
      </section>
    </>
  );
}
