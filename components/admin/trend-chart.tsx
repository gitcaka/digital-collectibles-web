'use client';

import type { AdminStatsSeries } from './shared';

/**
 * 运营趋势迷你图（自绘 SVG，无第三方图表依赖）。
 * 三组折线共用一张图：兑换次数 / 新增用户 / 转让成交，纵向归一化到同一刻度。
 */

const SERIES_TONES: Record<string, { color: string; dash: string }> = {
  redeem: { color: '#6e5fc2', dash: '' },
  user: { color: '#397fb0', dash: '' },
  transfer: { color: '#a97622', dash: '' },
};

const WIDTH = 680;
const HEIGHT = 218;
const PAD_LEFT = 30;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

type Props = {
  series: AdminStatsSeries[];
};

export function TrendChart({ series }: Props) {
  const primary = series[0];
  const points = primary?.points ?? [];
  const count = points.length;
  if (count === 0) {
    return <p className="ops-chart-empty">暂无统计数据</p>;
  }

  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const maxValue = Math.max(1, ...values);
  const niceMax = Math.max(1, Math.ceil(maxValue / 4) * 4);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = count > 1 ? plotWidth / (count - 1) : 0;

  const xOf = (index: number) => PAD_LEFT + index * stepX;
  const yOf = (value: number) => PAD_TOP + plotHeight - (value / niceMax) * plotHeight;

  const gridTicks = [0, 1, 2, 3, 4].map((tick) => (niceMax / 4) * tick);

  const labelEvery = Math.ceil(count / 8);
  const xLabels = points.map((point, index) => {
    const show =
      index === 0 ||
      index === count - 1 ||
      (index % labelEvery === 0 && index < count - labelEvery);
    return show ? point.date : '';
  });

  return (
    <div className="ops-chart-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="运营趋势图">
        <g className="ops-chart-grid">
          {gridTicks.map((tick) => (
            <line
              key={tick}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yOf(tick)}
              y2={yOf(tick)}
            />
          ))}
        </g>
        {series.map((item) => {
          const tone = SERIES_TONES[item.key] ?? { color: '#8a93a6', dash: '' };
          const path = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)},${yOf(point.value).toFixed(1)}`)
            .join(' ');
          return (
            <path
              key={item.key}
              d={path}
              fill="none"
              stroke={tone.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={tone.dash || undefined}
            />
          );
        })}
        {/* 末点标记：一眼看出今天各指标的位置 */}
        {series.map((item) => {
          const tone = SERIES_TONES[item.key] ?? { color: '#8a93a6', dash: '' };
          const lastIndex = item.points.length - 1;
          return (
            <circle
              key={item.key}
              cx={xOf(lastIndex)}
              cy={yOf(item.points[lastIndex].value)}
              r={3.2}
              fill={tone.color}
              stroke="#ffffff"
              strokeWidth={1.4}
            />
          );
        })}
        <g className="ops-chart-axis">
          {xLabels.map((label, index) =>
            label === '' ? null : (
              <text
                key={`${label}-${index}`}
                x={xOf(index)}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
              >
                {label}
              </text>
            ),
          )}
          {gridTicks.map((tick) => (
            <text key={`tick-${tick}`} x={PAD_LEFT - 6} y={yOf(tick) + 3} textAnchor="end">
              {Math.round(tick)}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
