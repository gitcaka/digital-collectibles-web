'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Inbox, RefreshCw, ScrollText, Search } from 'lucide-react';

import { callApi } from '@/lib/api';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-skeleton';

import type { AdminAuditLogRow, AdminSectionProps } from '../shared';
import { auditActionText, formatDate } from '../shared';

const PAGE_SIZE = 12;

type AuditPayload = { items: AdminAuditLogRow[]; total: number; page: number; pageSize: number };

/** 审计日志：只读分页列表，每次进入/筛选都会向 /api/admin/audit 拉取。 */
export function AuditSection(_props: AdminSectionProps) {
  const [rows, setRows] = useState<AdminAuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const actions = useMemo(() => Object.keys(auditActionText), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (actionFilter) query.set('action', actionFilter);
      if (keyword.trim()) query.set('keyword', keyword.trim());
      const payload = await callApi<AuditPayload>(`/api/admin/audit?${query.toString()}`);
      setRows(payload.data?.items ?? []);
      setTotal(payload.data?.total ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, keyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const resetPage = () => setPage(1);

  return (
    <div className="ops-audit">
      <div className="ops-list-toolbar">
        <div>
          <strong>管理员操作流水</strong>
          <p>后台每一次成功的关键写操作都会留痕，可追溯操作人与时间。</p>
        </div>
        <div className="ops-audit-controls">
          <label className="ops-audit-search">
            <Search />
            <input
              type="search"
              placeholder="搜索目标 / 详情 / 操作人"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                resetPage();
              }}
            />
          </label>
          <select
            className="ops-audit-select"
            value={actionFilter}
            aria-label="按操作类型筛选"
            onChange={(event) => {
              setActionFilter(event.target.value);
              resetPage();
            }}
          >
            <option value="">全部操作</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {auditActionText[action]}
              </option>
            ))}
          </select>
          <button type="button" className="ops-audit-refresh" aria-label="刷新审计日志" onClick={() => void load()}>
            <RefreshCw />
          </button>
        </div>
      </div>

      <section className="ops-panel ops-audit-panel">
        <div className="ops-panel-title">
          <div>
            <small>AUDIT TRAIL</small>
            <h2>操作明细</h2>
          </div>
          <span className="ops-audit-count">共 {total} 条</span>
        </div>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Inbox} title="没有匹配的审计记录" hint="试试清除关键字或切换操作类型" className="ui-empty-inline" />
        ) : (
          <div className="ops-audit-list">
            {rows.map((row) => (
              <article className="ops-audit-row" key={row.id}>
                <span className="ops-audit-ic">
                  <ScrollText />
                </span>
                <div className="ops-audit-main">
                  <div className="ops-audit-title">
                    <strong>{auditActionText[row.action] ?? row.action}</strong>
                    <em className="ops-audit-raw">{row.action}</em>
                  </div>
                  <small>
                    {row.target && <b>{row.target}</b>}
                    {row.detail && <span>{row.detail}</span>}
                  </small>
                </div>
                <div className="ops-audit-side">
                  <strong>{row.adminName}</strong>
                  <small>{formatDate(row.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="ops-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft />
              上一页
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              下一页
              <ChevronRight />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
