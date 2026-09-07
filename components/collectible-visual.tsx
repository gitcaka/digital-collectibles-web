'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * 藏品动态视觉：统一的图片加载体验。
 * - 首屏（change 首页主视觉 / 详情主图）priority 预载；其余一律 lazy + decoding async；
 * - 固定 aspect-ratio 容器（见 .collectible-visual）防 CLS；
 * - 加载完成后淡入，避免 GIF/PNG 弹出感。
 */
export function CollectibleVisual({
  id,
  name,
  imageUrl,
  compact = false,
  priority = false,
}: {
  id: string;
  name: string;
  imageUrl?: string | null;
  compact?: boolean;
  /** 明确要求预载时传入（详情主图）；默认仅首页嫦娥主视觉预载 */
  priority?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const source = imageUrl || '/media/change.gif';
  return (
    <div className={`collectible-visual visual-${id}${compact ? ' is-compact' : ''}`}>
      <span className="visual-halo" aria-hidden="true" />
      <Image
        className={`collectible-gif${ready ? ' is-ready' : ''}`}
        src={source}
        alt={`${name}动态展示`}
        fill
        sizes={compact ? '96px' : '(max-width: 520px) 80vw, 420px'}
        unoptimized
        priority={priority || (!compact && id === 'change')}
        decoding="async"
        style={{ objectFit: 'contain' }}
        onLoad={() => setReady(true)}
      />
      <span className="visual-star star-a" aria-hidden="true" />
      <span className="visual-star star-b" aria-hidden="true" />
    </div>
  );
}
