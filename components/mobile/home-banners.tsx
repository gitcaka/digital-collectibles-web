'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import type { Banner } from './types';

/** 首页推荐横幅：自动轮播 + 拖拽切换 + 指示点。 */
export function HomeBanners({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const dragStart = useRef<number | null>(null);
  const count = banners.length;

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const active = Math.min(index, count - 1);

  const step = (delta: number) => {
    setIndex((current) => (current + delta + count) % count);
  };

  return (
    <section className="home-banner" aria-roledescription="carousel" aria-label="首页推荐横幅">
      <div
        className="banner-viewport"
        onPointerDown={(event) => {
          dragStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (start === null) return;
          const distance = event.clientX - start;
          if (Math.abs(distance) < 40) return;
          step(distance < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <div className="banner-track" style={{ transform: `translateX(-${active * 100}%)` }}>
          {banners.map((banner, slideIndex) => (
            <a
              key={banner.id}
              className="banner-slide"
              href={banner.link || undefined}
              aria-hidden={slideIndex === active ? undefined : true}
              tabIndex={slideIndex === active ? undefined : -1}
            >
              <Image src={banner.imageUrl} alt={banner.title} fill sizes="100vw" unoptimized priority={slideIndex === 0} />
            </a>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="banner-dots">
          {banners.map((banner, dotIndex) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`切换到第 ${dotIndex + 1} 张横幅`}
              aria-current={dotIndex === active}
              className={dotIndex === active ? 'is-active' : ''}
              onClick={() => setIndex(dotIndex)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
