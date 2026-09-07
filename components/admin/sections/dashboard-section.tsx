'use client';

import { useEffect, useState } from 'react';
import { Boxes, ChevronRight, Coins, Download, ImagePlus, LineChart, LoaderCircle, Repeat2, Settings, Ticket, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { callApi, downloadCsv, type CsvExportType } from '@/lib/api';

import type { AdminSectionProps, AdminStats } from '../shared';
import { formatDate, formatNumber, statusText } from '../shared';
import { TrendChart } from '../trend-chart';

/** 运营总览：关键指标 + 趋势图 + 今日待办 + 最近转让。 */
export function DashboardSection({ data, openSection }: AdminSectionProps) {
  const activeCodes = data.codes.filter((item) => item.status === 'active').length;
  const [days, setDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setStatsError('');
      callApi<AdminStats>(`/api/admin/stats?days=${days}`, { method: 'GET' })
        .then((payload) => {
          if (!cancelled) setStats(payload.data ?? null);
        })
        .catch(() => {
          if (!cancelled) setStatsError('趋势数据加载失败，请稍后重试');
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [days]);

  const metrics = [
    { label: '注册用户', value: data.metrics.userCount, icon: Users, tone: 'violet' },
    { label: '流通藏品', value: data.metrics.holdingCount, icon: Boxes, tone: 'blue' },
    { label: '累计兑换', value: data.metrics.redemptionCount, icon: Ticket, tone: 'amber' },
    { label: '待确认转让', value: data.metrics.pendingTransferCount, icon: Repeat2, tone: 'green' },
  ];

  const exportOptions: Array<{ type: CsvExportType; label: string; note: string; count: number; icon: typeof Users }> = [
    { type: 'users', label: '注册用户', note: '用户名、余额、持有数与注册时间', count: data.metrics.userCount, icon: Users },
    { type: 'redeems', label: '兑换记录', note: '兑换码、奖励内容与兑换时间', count: data.metrics.redemptionCount, icon: Ticket },
    { type: 'transfers', label: '转让记录', note: '订单状态、金额、手续费与完成时间', count: data.transfers.length, icon: Repeat2 },
  ];
  return (
    <>
      <section className="ops-metric-grid">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`metric-${tone}`}>
            <span>
              <Icon />
            </span>
            <div>
              <small>{label}</small>
              <strong>{formatNumber(value)}</strong>
            </div>
            <em>实时</em>
          </article>
        ))}
      </section>
      <section className="ops-panel ops-chart-panel">
        <div className="ops-panel-title">
          <div>
            <small>TREND</small>
            <h2>运营趋势</h2>
          </div>
          <fieldset className="ops-seg" aria-label="统计周期">
            <button type="button" data-active={days === 7} onClick={() => setDays(7)}>
              近 7 日
            </button>
            <button type="button" data-active={days === 30} onClick={() => setDays(30)}>
              近 30 日
            </button>
          </fieldset>
        </div>
        {stats && (
          <div className="ops-chart-legend">
            {stats.series.map((item) => (
              <span key={item.key}>
                <i className={`tone-${item.key}`} />
                {item.name}
                <em>{formatNumber(item.total)}</em>
              </span>
            ))}
          </div>
        )}
        <div className="ops-chart-body">
          {statsError ? (
            <div className="ops-state is-inline">
              <LineChart />
              <p>{statsError}</p>
            </div>
          ) : stats ? (
            <TrendChart series={stats.series} />
          ) : (
            <div className="ops-state is-inline">
              <LoaderCircle className="spin" />
              <p>正在统计运营趋势</p>
            </div>
          )}
        </div>
      </section>
      <section className="ops-panel ops-export-panel">
        <div className="ops-panel-title">
          <div>
            <small>EXPORT</small>
            <h2>数据导出</h2>
          </div>
          <Badge variant="outline">CSV · UTF-8</Badge>
        </div>
        <p className="ops-export-note">导出平台当前全量数据为 CSV（带 BOM），保存后可直接用 Excel / WPS 打开。</p>
        <div className="ops-export-grid">
          {exportOptions.map(({ type, label, note, count, icon: Icon }) => (
            <button key={type} type="button" className="ops-export-cell" onClick={() => downloadCsv(type)}>
              <span className="ops-export-ic">
                <Icon />
              </span>
              <span className="ops-export-main">
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
              <span className="ops-export-meta">
                <em>{formatNumber(count)} 条</em>
                <i>
                  <Download />
                  下载 CSV
                </i>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="ops-dashboard-grid">
        <section className="ops-panel ops-priority">
          <div className="ops-panel-title">
            <div>
              <small>PRIORITY</small>
              <h2>今日运营待办</h2>
            </div>
            <Badge>{data.metrics.pendingTransferCount + activeCodes}</Badge>
          </div>
          <button type="button" onClick={() => openSection('transfers')}>
            <span>
              <Repeat2 />
            </span>
            <div>
              <strong>{data.metrics.pendingTransferCount} 笔转让待确认</strong>
              <small>快速核对异常价格与超时订单</small>
            </div>
            <ChevronRight />
          </button>
          <button type="button" onClick={() => openSection('codes')}>
            <span>
              <Ticket />
            </span>
            <div>
              <strong>{activeCodes} 个兑换码启用中</strong>
              <small>查看活动使用量并随时停用</small>
            </div>
            <ChevronRight />
          </button>
          <button type="button" onClick={() => openSection('users')}>
            <span>
              <Coins />
            </span>
            <div>
              <strong>{formatNumber(data.metrics.yuanbaoTotal)} 元宝在账户中</strong>
              <small>资产调整会立即写入本地数据库</small>
            </div>
            <ChevronRight />
          </button>
          <button type="button" onClick={() => openSection('banners')}>
            <span>
              <ImagePlus />
            </span>
            <div>
              <strong>{data.banners.length} 个首页横幅</strong>
              <small>管理首页轮播图与跳转</small>
            </div>
            <ChevronRight />
          </button>
          <button type="button" onClick={() => openSection('settings')}>
            <span>
              <Settings />
            </span>
            <div>
              <strong>货币名称设置</strong>
              <small>自定义「{data.settings.yuanbao}」「{data.settings.points}」</small>
            </div>
            <ChevronRight />
          </button>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-title">
            <div>
              <small>RECENT</small>
              <h2>最近转让</h2>
            </div>
            <Button variant="ghost" onClick={() => openSection('transfers')}>
              全部记录
            </Button>
          </div>
          <div className="ops-mini-table">
            {data.transfers.slice(0, 5).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.senderUsername} → {item.recipientUsername}
                  </small>
                </div>
                <div>
                  <strong>{item.price ? `${formatNumber(item.price)} 元宝` : '免费'}</strong>
                  <small>{formatDate(item.createdAt)}</small>
                </div>
                <Badge className={`status status-${item.status}`}>{statusText(item.status)}</Badge>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
