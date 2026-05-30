'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { MapDisplayIsland } from '@/lib/eza/mirror/relationshipPatternMetrics';
import BehaviorIslandBlob from '@/components/mirror/relationship/BehaviorIslandBlob';

/** Adaların rahatça yerleştiği referans harita genişliği (px). */
const REFERENCE_MAP_WIDTH = 460;
/** Dar ekranlarda ada/blob boyutları için alt ölçek sınırı. */
const MIN_BLOB_SCALE = 0.6;

/** Merkez çekirdek etrafında organik orbit yerleşimi (yüzde cinsinden). */
function orbitPosition(index: number, count: number): { left: number; top: number } {
  const safeCount = Math.max(1, count);
  const angle = (index / safeCount) * Math.PI * 2 - Math.PI / 2;
  // Hafif organik düzensizlik: tekil/çift adalar biraz farklı yörüngede.
  const radiusX = 36 + (index % 2 === 0 ? 1.5 : -2.5);
  const radiusY = 33 + (index % 3 === 0 ? -1.5 : 2);
  return {
    left: 50 + radiusX * Math.cos(angle),
    top: 50 + radiusY * Math.sin(angle),
  };
}

export type BehaviorIslandsMapProps = {
  islands: MapDisplayIsland[];
  className?: string;
  /** Harita seviyesinde ada seçimi (ghost adalar da tıklanabilir). */
  interactive?: boolean;
  selectedId?: string | null;
  onSelectIsland?: (island: MapDisplayIsland) => void;
  /** Merkez çekirdek ana etiketi (örn. "SEN"). */
  centerLabel?: string;
  /** Hafif canlı animasyonlar (reduced-motion'da kapalı). */
  animated?: boolean;
};

export default function BehaviorIslandsMap({
  islands,
  className,
  interactive = false,
  selectedId = null,
  onSelectIsland,
  centerLabel,
  animated = false,
}: BehaviorIslandsMapProps) {
  // Sabit 5 ana alan + en fazla 2 ek gerçek kategori (düzeni korumak için).
  const visible = islands.slice(0, 7);
  const positions = visible.map((_, i) => orbitPosition(i, visible.length));

  // Konteyner genişliğine göre blob ölçeği — dar telefonda çakışmayı önler.
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobScale, setBlobScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (width: number) => {
      if (width <= 0) return;
      const next = Math.min(1, Math.max(MIN_BLOB_SCALE, width / REFERENCE_MAP_WIDTH));
      setBlobScale(next);
    };
    update(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-[20rem] w-full overflow-hidden rounded-[2rem] sm:min-h-[28rem]',
        className
      )}
      aria-label="AI ilişki evreni — davranış adaları"
    >
      {/* Evren atmosferi — derin nebula gradyanları */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_58%_at_50%_50%,rgba(196,181,253,0.22),transparent_66%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-10 top-6 h-44 w-44 rounded-full bg-violet-300/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 bottom-4 h-48 w-48 rounded-full bg-sky-200/20 blur-3xl"
        aria-hidden
      />
      {/* Yıldız tozu */}
      {[
        { l: 18, t: 16 },
        { l: 78, t: 22 },
        { l: 30, t: 80 },
        { l: 68, t: 74 },
        { l: 50, t: 10 },
      ].map((s) => (
        <span
          key={`${s.l}-${s.t}`}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/70 shadow-[0_0_6px_2px_rgba(196,181,253,0.5)]"
          style={{ left: `${s.l}%`, top: `${s.t}%` }}
          aria-hidden
        />
      ))}

      {/* Yörünge halkaları + merkeze bağlantı çizgileri */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-violet-300/35"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="37"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.3"
          strokeDasharray="1.2 2"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="26"
          ry="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.2"
          strokeDasharray="0.8 2.6"
          opacity="0.6"
          vectorEffect="non-scaling-stroke"
        />
        {positions.map((p, i) =>
          visible[i]!.active ? (
            <line
              key={`conn-${visible[i]!.id}`}
              x1="50"
              y1="50"
              x2={p.left}
              y2={p.top}
              stroke={visible[i]!.color}
              strokeOpacity={selectedId === visible[i]!.id ? 0.55 : 0.16}
              strokeWidth={selectedId === visible[i]!.id ? 0.7 : 0.35}
              vectorEffect="non-scaling-stroke"
            />
          ) : null
        )}
      </svg>

      {/* Merkez çekirdek — "AI İLİŞKİN / SEN" (her zaman görünür) */}
      {centerLabel ? (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          {/* Canlı aura */}
          <span
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 -z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl sm:h-32 sm:w-32',
              animated && 'animate-core-aura'
            )}
            style={{
              background:
                'radial-gradient(circle, rgba(155,132,255,0.55), rgba(123,97,255,0.18) 60%, transparent 75%)',
            }}
            aria-hidden
          />
          <div
            className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-full border border-white/70 text-center backdrop-blur-md sm:h-24 sm:w-24"
            style={{
              background:
                'radial-gradient(circle at 34% 26%, rgba(255,255,255,0.96), rgba(244,241,253,0.8) 58%, rgba(225,216,250,0.62) 100%)',
              boxShadow:
                '0 16px 44px -14px rgba(123,97,255,0.5), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -10px 24px -14px rgba(123,97,255,0.35)',
            }}
          >
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#7B61FF]/75">
              AI İlişkin
            </span>
            <span className="mt-0.5 text-lg font-bold tracking-tight text-[#172033]">
              {centerLabel}
            </span>
          </div>
        </div>
      ) : null}

      {visible.map((island, index) => {
        const p = positions[index]!;
        return (
          <div
            key={island.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <BehaviorIslandBlob
              island={island}
              ghost={!island.active}
              interactive={interactive}
              selected={selectedId === island.id}
              onSelect={() => onSelectIsland?.(island)}
              animated={animated}
              animationDelay={index * 0.9}
              sizeScale={blobScale}
            />
          </div>
        );
      })}
    </div>
  );
}
