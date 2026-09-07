/**
 * 用户端格式化工具：数字 / 日期 / 价格文案 / 排行榜数值。
 */
import type { CurrencyNames, PricedItem, RankingKey } from './types';

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 * 藏品价格展示：兑换方式由后台控制，可能只支持某一种货币或暂不可兑换。
 */
export function priceTag(item: PricedItem, names: CurrencyNames) {
  if (item.redeemMode === 'none') return '暂不可兑换';
  if (item.redeemMode === 'yuanbao') return `${formatNumber(item.price)} ${names.yuanbao}`;
  if (item.redeemMode === 'points') return `${formatNumber(item.pointsPrice)} ${names.points}`;
  return `${formatNumber(item.price)} ${names.yuanbao} · ${formatNumber(item.pointsPrice)} ${names.points}`;
}

export function rankingValue(key: RankingKey, value: number, names: CurrencyNames) {
  if (key === 'collections') return `${formatNumber(value)} 件`;
  if (key === 'yuanbao') return `${formatNumber(value)} ${names.yuanbao}`;
  if (key === 'points') return `${formatNumber(value)} ${names.points}`;
  return `${formatNumber(value)} 稀有值`;
}
