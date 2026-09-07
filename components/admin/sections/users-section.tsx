'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Coins, LoaderCircle, PackageOpen, Repeat2, Search, Star, Ticket, X } from 'lucide-react';

import { CollectibleVisual } from '@/components/collectible-visual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { callApi } from '@/lib/api';

import type { AdminSectionProps, AdminUserDetail } from '../shared';
import { formatDate, formatNumber } from '../shared';

/**
 * 用户与资产 section。
 * 形态由路由驱动：/admin/users/[id]（detailId 详情）与 /admin/users（列表）。
 */
export function UsersSection({
  data,
  detailId = null,
  busy,
  action,
  setNotice,
}: AdminSectionProps & { detailId?: string | null }) {
  const [search, setSearch] = useState('');
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailBusy, setUserDetailBusy] = useState(false);
  const [walletForm, setWalletForm] = useState({ username: '', yuanbaoDelta: '0', pointsDelta: '0', note: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const target = detailId ? data.users.find((item) => item.id === detailId) ?? null : null;
  const filtered = data.users.filter((item) => `${item.displayName}${item.username}`.toLowerCase().includes(search.trim().toLowerCase()));

  /** 可批量操作的用户（管理员账号不可被停用，不出现在勾选里）。 */
  const selectable = filtered.filter((item) => item.role !== 'admin');
  const chosen = selectable.filter((item) => selected.has(item.id));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allChosen ? new Set() : new Set(selectable.map((item) => item.id)));
  };

  const clearSelect = () => setSelected(new Set());

  const runBatch = (nextStatus: 'active' | 'disabled') => {
    const ids = chosen.filter((item) => item.status !== nextStatus).map((item) => item.id);
    if (ids.length === 0) {
      setNotice('所选用户已是该状态，无需重复操作');
      clearSelect();
      return;
    }
    void action('users-batch', { action: 'user.batch', ids, status: nextStatus }).then((result) => {
      if (result) clearSelect();
    });
  };

  const fetchUserDetail = useCallback(async (id: string) => {
    setUserDetailBusy(true);
    try {
      const response = await callApi(`/api/admin/user?id=${encodeURIComponent(id)}`, { method: 'GET' });
      setUserDetail(response.data as AdminUserDetail);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '用户详情加载失败');
    } finally {
      setUserDetailBusy(false);
    }
  }, [setNotice]);

  // 独立用户详情页：数据就绪后按路由 id 自动拉取一次完整档案
  useEffect(() => {
    if (!detailId) return;
    if (userDetail?.user.id === detailId) return;
    const timer = window.setTimeout(() => void fetchUserDetail(detailId), 0);
    return () => window.clearTimeout(timer);
  }, [detailId, userDetail, fetchUserDetail]);

  if (target) {
    return (
      <>
        <div className="ops-detail-head">
          <button type="button" className="ops-back-to-list" onClick={() => window.location.assign('/admin/users')}>
            <ArrowLeft />
            返回用户列表
          </button>
          <div>
            <small>USER PROFILE</small>
            <h2>{target.displayName}</h2>
          </div>
        </div>
        {userDetailBusy && !userDetail ? (
          <div className="ops-inline-state">
            <LoaderCircle className="spin" />
            <span>正在读取用户档案</span>
          </div>
        ) : userDetail ? (
          <div className="ops-user-detail">
            <section className="ops-panel ops-user-hero">
              <span className="ops-avatar ops-user-avatar">{userDetail.user.displayName.slice(0, 1)}</span>
              <div className="ops-user-hero-copy">
                <span className="ops-user-hero-title">
                  <h2>{userDetail.user.displayName}</h2>
                  <Badge variant="outline">{userDetail.user.role === 'admin' ? '管理员' : '用户'}</Badge>
                  <Badge className={userDetail.user.status === 'active' ? 'status status-active' : 'status status-disabled'}>
                    {userDetail.user.status === 'active' ? '正常' : '已停用'}
                  </Badge>
                </span>
                <small>
                  @{userDetail.user.username} · 注册于 {formatDate(userDetail.user.createdAt)}
                </small>
              </div>
              {userDetail.user.role !== 'admin' && (
                <Button
                  variant="outline"
                  disabled={busy === `user-${userDetail.user.id}`}
                  onClick={() =>
                    void action(`user-${userDetail.user.id}`, {
                      action: 'user.toggle',
                      userId: userDetail.user.id,
                      status: userDetail.user.status === 'active' ? 'disabled' : 'active',
                    }).then((result) => {
                      if (result) void fetchUserDetail(userDetail.user.id);
                    })
                  }
                >
                  {userDetail.user.status === 'active' ? '停用账号' : '启用账号'}
                </Button>
              )}
            </section>
            <section className="ops-user-stats">
              <article>
                <span>
                  <Coins />
                </span>
                <div>
                  <small>{data.settings.yuanbao}余额</small>
                  <strong>{formatNumber(userDetail.assets.yuanbao)}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Star />
                </span>
                <div>
                  <small>{data.settings.points}余额</small>
                  <strong>{formatNumber(userDetail.assets.points)}</strong>
                </div>
              </article>
              <article>
                <span>
                  <PackageOpen />
                </span>
                <div>
                  <small>持有藏品</small>
                  <strong>{userDetail.holdings.length}</strong>
                </div>
              </article>
              <article>
                <span>
                  <Ticket />
                </span>
                <div>
                  <small>兑换记录</small>
                  <strong>{userDetail.redeemRecords.length}</strong>
                </div>
              </article>
            </section>
            <div className="ops-user-columns">
              <section className="ops-panel">
                <div className="ops-panel-title">
                  <div>
                    <small>HOLDINGS</small>
                    <h2>持有藏品</h2>
                  </div>
                  <Badge variant="outline">{userDetail.holdings.length}</Badge>
                </div>
                <div className="ops-user-holdings">
                  {userDetail.holdings.length === 0 ? (
                    <EmptyState icon={PackageOpen} title="暂无持有藏品" className="ui-empty-inline" />
                  ) : (
                    userDetail.holdings.map((holding) => (
                      <article key={holding.id}>
                        <CollectibleVisual id={holding.collectionId} name={holding.name} imageUrl={holding.imageUrl} compact />
                        <div>
                          <strong>{holding.name}</strong>
                          <small>
                            #{String(holding.serialNo).padStart(4, '0')} · {holding.source}获得 · {holding.rarity}
                          </small>
                        </div>
                        <Badge variant="outline">
                          {holding.status === 'normal' ? '持有中' : holding.status === 'transferring' ? '转让中' : holding.status}
                        </Badge>
                      </article>
                    ))
                  )}
                </div>
              </section>
              <section className="ops-panel">
                <div className="ops-panel-title">
                  <div>
                    <small>REDEEM RECORDS</small>
                    <h2>兑换记录</h2>
                  </div>
                  <Badge variant="outline">{userDetail.redeemRecords.length}</Badge>
                </div>
                <div className="ops-user-records">
                  {userDetail.redeemRecords.length === 0 ? (
                    <EmptyState icon={Ticket} title="暂无兑换记录" className="ui-empty-inline" />
                  ) : (
                    userDetail.redeemRecords.map((record, index) => (
                      <article key={`${record.code}-${index}`}>
                        <div>
                          <strong>{record.reward}</strong>
                          <small>{record.code}</small>
                        </div>
                        <time>{formatDate(record.createdAt)}</time>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
            <section className="ops-panel">
              <div className="ops-panel-title">
                <div>
                  <small>TRANSFER ORDERS</small>
                  <h2>转让记录</h2>
                </div>
                <Badge variant="outline">{userDetail.transfers.length}</Badge>
              </div>
              <div className="ops-transfer-list">
                {userDetail.transfers.length === 0 ? (
                  <EmptyState icon={Repeat2} title="暂无转让记录" className="ui-empty-inline" />
                ) : (
                  userDetail.transfers.map((order) => {
                    const incoming = order.recipientUserId === userDetail.user.id;
                    return (
                      <article key={order.id}>
                        <span>
                          <Repeat2 />
                        </span>
                        <div>
                          <strong>{order.name}</strong>
                          <small>
                            {order.senderDisplayName || order.senderUsername} → {order.recipientUsername}
                          </small>
                        </div>
                        <div>
                          <strong>{order.price ? `${formatNumber(order.price)} ${data.settings.yuanbao}` : '免费'}</strong>
                          <small>{incoming ? '接收' : '发起'}</small>
                        </div>
                        <time>{formatDate(order.createdAt)}</time>
                        <Badge className={`status status-${order.status}`}>
                          {order.status === 'pending'
                            ? '待确认'
                            : order.status === 'completed'
                              ? '已完成'
                              : order.status === 'rejected'
                                ? '已拒绝'
                                : '已撤销'}
                        </Badge>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
            <section className="ops-panel ops-adjust-panel">
              <div className="ops-panel-title">
                <div>
                  <small>ASSET CONTROL</small>
                  <h2>调整「{userDetail.user.displayName}」的资产</h2>
                </div>
                <Coins />
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action('adjust-wallet', {
                    action: 'wallet.adjust',
                    username: userDetail.user.username,
                    yuanbaoDelta: Number(walletForm.yuanbaoDelta || 0),
                    pointsDelta: Number(walletForm.pointsDelta || 0),
                    note: walletForm.note,
                  }).then((result) => {
                    if (result) {
                      setWalletForm({ username: userDetail.user.username, yuanbaoDelta: '0', pointsDelta: '0', note: '' });
                      void fetchUserDetail(userDetail.user.id);
                    }
                  });
                }}
              >
                <div className="ops-form-grid">
                  <label htmlFor="detail-wallet-yuanbao">
                    <span>{data.settings.yuanbao}增减</span>
                    <Input
                      id="detail-wallet-yuanbao"
                      inputMode="numeric"
                      value={walletForm.yuanbaoDelta}
                      onChange={(event) => setWalletForm({ ...walletForm, yuanbaoDelta: event.target.value.replace(/[^0-9-]/g, '') })}
                      placeholder="正加负减，如 100 / -50"
                    />
                  </label>
                  <label htmlFor="detail-wallet-points">
                    <span>{data.settings.points}增减</span>
                    <Input
                      id="detail-wallet-points"
                      inputMode="numeric"
                      value={walletForm.pointsDelta}
                      onChange={(event) => setWalletForm({ ...walletForm, pointsDelta: event.target.value.replace(/[^0-9-]/g, '') })}
                      placeholder="正加负减，如 200 / -30"
                    />
                  </label>
                </div>
                <label htmlFor="detail-wallet-note">
                  <span>调整原因</span>
                  <Input
                    id="detail-wallet-note"
                    value={walletForm.note}
                    onChange={(event) => setWalletForm({ ...walletForm, note: event.target.value })}
                    placeholder="活动补发 / 异常扣回"
                  />
                </label>
                <Button type="submit" disabled={busy === 'adjust-wallet'}>
                  {busy === 'adjust-wallet' ? <LoaderCircle className="spin" /> : <Check />}
                  确认调整
                </Button>
              </form>
            </section>
          </div>
        ) : (
          <div className="ops-inline-state">
            <X />
            <span>用户档案读取失败，请返回后重试。</span>
          </div>
        )}
      </>
    );
  }

  if (detailId && data.users.every((item) => item.id !== detailId)) {
    return (
      <div className="ops-detail-head">
        <button type="button" className="ops-back-to-list" onClick={() => window.location.assign('/admin/users')}>
          <ArrowLeft />
          返回用户列表
        </button>
        <div>
          <small>USER PROFILE</small>
          <h2>用户不存在</h2>
        </div>
      </div>
    );
  }

  return (
    <section className="ops-panel">
      <div className="ops-panel-title">
        <div>
          <small>ACCOUNTS</small>
          <h2>用户列表</h2>
        </div>
        <Badge variant="outline">{filtered.length} 人</Badge>
      </div>
      <div className="ops-search">
        <Search />
        <Input aria-label="搜索用户" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索昵称或用户名" />
      </div>
      <div className="ops-batch-bar">
        <span className="ops-batch-info">
          {chosen.length > 0 ? (
            <>
              已选 <strong>{chosen.length}</strong> 个用户
              <button type="button" className="ops-batch-clear" onClick={clearSelect}>
                取消选择
              </button>
            </>
          ) : (
            '勾选行左侧方框，可批量启用 / 停用账号（管理员账号不可操作）'
          )}
        </span>
        {chosen.length > 0 && (
          <span className="ops-batch-actions">
            <button type="button" disabled={busy === 'users-batch'} onClick={() => runBatch('active')}>
              {busy === 'users-batch' ? <LoaderCircle className="spin" /> : <Check />}
              批量启用
            </button>
            <button type="button" className="is-danger" disabled={busy === 'users-batch'} onClick={() => runBatch('disabled')}>
              批量停用
            </button>
            <button type="button" className="is-plain" disabled={busy === 'users-batch'} onClick={toggleSelectAll}>
              {allChosen ? '取消全选' : '全选当前'}
            </button>
          </span>
        )}
      </div>
      <div className="ops-user-list">
        {filtered.map((item) => {
          const isAdmin = item.role === 'admin';
          const on = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={`ops-user-row-shell${isAdmin ? ' is-plain' : ''}${on ? ' is-selected' : ''}`}
            >
              {!isAdmin && (
                <button
                  type="button"
                  className={`ops-check${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  aria-label={on ? `取消选择 ${item.displayName}` : `选择 ${item.displayName}`}
                  onClick={() => toggleSelect(item.id)}
                >
                  <Check />
                </button>
              )}
              <button
                type="button"
                className="ops-user-row"
                onClick={() => window.location.assign(`/admin/users/${encodeURIComponent(item.id)}`)}
              >
                <span className="ops-avatar">{item.displayName.slice(0, 1)}</span>
                <div>
                  <span>
                    <strong>{item.displayName}</strong>
                    <Badge variant="outline">{item.role === 'admin' ? '管理员' : '用户'}</Badge>
                    {item.status === 'disabled' && <Badge className="status status-disabled">已停用</Badge>}
                  </span>
                  <small>
                    @{item.username} · {item.holdingCount} 件藏品
                  </small>
                  <p>
                    <Coins />
                    {formatNumber(item.yuanbao)} {data.settings.yuanbao}
                    <i />
                    <Star />
                    {formatNumber(item.points)} {data.settings.points}
                  </p>
                </div>
                <span className="ops-user-row-go">
                  <ChevronRight />
                </span>
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState icon={Search} title="没有匹配的用户" hint="换个关键字或筛选条件试试" className="ui-empty-inline" />
        )}
      </div>
    </section>
  );
}
