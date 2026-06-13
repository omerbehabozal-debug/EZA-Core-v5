'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { MapDisplayIsland } from '@/lib/eza/mirror/relationshipPatternMetrics';
import BehaviorIslandBlob from '@/components/mirror/relationship/BehaviorIslandBlob';

const REFERENCE_MAP_WIDTH = 460;
const MIN_BLOB_SCALE = 0.6;

function orbitPosition(index: number, count: number): { left: number; top: number } {
  const safeCount = Math.max(1, count);
  const angle = (index / safeCount) * Math.PI * 2 - Math.PI / 2;
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
  interactive?: boolean;
  selectedId?: string | null;
  onSelectIsland?: (island: MapDisplayIsland) => void;
  centerLabel?: string;
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
  const visible = islands.slice(0, 7);
  const positions = visible.map((_, i) => orbitPosition(i, visible.length));

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
      <div className="pointer-events-none absolute inset-0 saina-pattern-map-atmosphere" aria-hidden />

      {[
        { l: 18, t: 16 },
        { l: 78, t: 22 },
        { l: 30, t: 80 },
        { l: 68, t: 74 },
        { l: 50, t: 10 },
      ].map((s) => (
        <span
          key={`${s.l}-${s.t}`}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#D8B16A]/55 shadow-[0_0_6px_2px_rgba(216,177,106,0.28)]"
          style={{ left: `${s.l}%`, top: `${s.t}%` }}
          aria-hidden
        />
      ))}

      <svg
        className="saina-pattern-connection-glow pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="sainaOrbitStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D8B16A" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#0F3D32" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D8B16A" stopOpacity="0.36" />
          </linearGradient>
        </defs>
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="37"
          fill="none"
          stroke="url(#sainaOrbitStroke)"
          strokeWidth="0.28"
          strokeDasharray="0.6 2.8"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="26"
          ry="24"
          fill="none"
          stroke="url(#sainaOrbitStroke)"
          strokeWidth="0.2"
          strokeDasharray="0.4 3.2"
          opacity="0.72"
          vectorEffect="non-scaling-stroke"
        />
        {positions.map((p, i) => {
          const island = visible[i];
          if (!island?.active) return null;
          const active = selectedId === island.id;
          return (
            <g key={`conn-${island.id}`}>
              <line
                x1="50"
                y1="50"
                x2={p.left}
                y2={p.top}
                stroke="#D8B16A"
                strokeOpacity={active ? 0.48 : 0.22}
                strokeWidth={active ? 0.55 : 0.32}
                strokeDasharray={active ? '0.8 2.4' : '0.5 3'}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={p.left}
                cy={p.top}
                r="0.55"
                fill="#D8B16A"
                fillOpacity={active ? 0.72 : 0.38}
              />
            </g>
          );
        })}
        <circle cx="50" cy="50" r="0.75" fill="#D8B16A" fillOpacity="0.55" />
      </svg>

      {centerLabel ? (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 -z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl sm:h-32 sm:w-32',
              animated && 'animate-core-aura'
            )}
            style={{
              background:
                'radial-gradient(circle, rgba(216,177,106,0.42), rgba(15,61,50,0.12) 60%, transparent 75%)',
            }}
            aria-hidden
          />
          <div
            className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-full border border-[#D8B16A]/35 text-center backdrop-blur-md sm:h-24 sm:w-24"
            style={{
              background:
                'radial-gradient(circle at 34% 26%, rgba(255,252,245,0.96), rgba(243,238,226,0.82) 58%, rgba(239,232,218,0.68) 100%)',
              boxShadow:
                '0 16px 44px -14px rgba(15,61,50,0.22), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -10px 24px -14px rgba(216,177,106,0.22)',
            }}
          >
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[#0F3D32]/70">
              AI İlişkin
            </span>
            <span className="mt-0.5 text-lg font-bold tracking-tight text-[#18332D]">
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
