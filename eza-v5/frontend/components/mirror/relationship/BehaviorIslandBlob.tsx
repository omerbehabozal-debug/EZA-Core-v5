'use client';

import { cn } from '@/lib/utils';
import type { BehaviorIsland } from '@/lib/eza/relationshipMapModel';
import { islandBlobSizePx } from '@/lib/eza/mirror/relationshipPatternMetrics';
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  GitCompare,
  Lightbulb,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const ICONS: Record<string, typeof Sparkles> = {
  exploration: Compass,
  decision_support: GitCompare,
  clarity_seek: Search,
  creative_ideas: Lightbulb,
  intellectual_depth: Sparkles,
  explanation_seek: Search,
  safe_balance: ShieldCheck,
  flow_harmony: Sparkles,
};

/** Organik (asimetrik) köşe yarıçapı — her ada hafif farklı bir form alır. */
const ORGANIC_SHAPES = [
  '58% 42% 55% 45% / 52% 48% 52% 48%',
  '46% 54% 48% 52% / 56% 44% 56% 44%',
  '54% 46% 60% 40% / 44% 56% 44% 56%',
  '48% 52% 44% 56% / 58% 42% 58% 42%',
  '60% 40% 52% 48% / 50% 50% 50% 50%',
  '44% 56% 56% 44% / 48% 52% 48% 52%',
];

function hashIndex(id: string, mod: number) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

function pickIcon(id: string) {
  return ICONS[id] ?? Sparkles;
}

/** Sinyali olmayan (ghost) adalar için sabit, ölçülü boyut. */
const GHOST_BLOB_PX = 124;

export type BehaviorIslandBlobProps = {
  island: BehaviorIsland;
  className?: string;
  style?: React.CSSProperties;
  ghost?: boolean;
  /** Tıklanabilir hale getirir (Harita seviyesi). Ghost adalar da tıklanabilir. */
  interactive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  /** Hafif nefes alma animasyonu (reduced-motion'da kapalı). */
  animated?: boolean;
  /** Animasyon faz farkı için (saniye). */
  animationDelay?: number;
  /** Konteyner genişliğine göre boyut ölçeği (dar ekran). */
  sizeScale?: number;
};

export default function BehaviorIslandBlob({
  island,
  className,
  style,
  ghost = false,
  interactive = false,
  selected = false,
  onSelect,
  animated = false,
  animationDelay = 0,
  sizeScale = 1,
}: BehaviorIslandBlobProps) {
  const baseSize = ghost ? GHOST_BLOB_PX : islandBlobSizePx(island.percent);
  const size = Math.round(baseSize * sizeScale);
  const Icon = pickIcon(island.id);
  const clickable = interactive;
  const shape = ORGANIC_SHAPES[hashIndex(island.id, ORGANIC_SHAPES.length)]!;
  const TrendIcon =
    !ghost && island.trend === 'growing'
      ? ArrowUpRight
      : !ghost && island.trend === 'fading'
        ? ArrowDownRight
        : null;

  return (
    <div
      className={cn(
        'group relative transition-transform duration-500 ease-out',
        animated && !ghost && 'animate-island-breathe',
        clickable && 'cursor-pointer',
        selected && 'scale-[1.06]',
        className
      )}
      style={{ animationDelay: animated ? `${animationDelay}s` : undefined }}
    >
      {/* Renkli derinlik halesi (blob arkası) */}
      {!ghost ? (
        <div
          className="pointer-events-none absolute -inset-3 rounded-full opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          style={{
            borderRadius: shape,
            background: `radial-gradient(circle at 50% 45%, ${island.color}59, ${island.color}1a 60%, transparent 78%)`,
          }}
          aria-hidden
        />
      ) : null}

      <article
        className={cn(
          'relative flex flex-col items-center justify-center overflow-hidden border text-center backdrop-blur-md transition-all duration-500',
          ghost ? 'opacity-40 group-hover:opacity-65' : 'group-hover:scale-[1.03]',
          clickable && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B16A]/45'
        )}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-pressed={clickable ? selected : undefined}
        aria-label={
          clickable
            ? ghost
              ? `${island.label} adası — henüz yeterli veri yok`
              : `${island.label} adası — %${island.percent}`
            : undefined
        }
        onClick={clickable ? () => onSelect?.() : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.();
                }
              }
            : undefined
        }
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: shape,
          borderColor: selected ? island.color : `${island.color}55`,
          background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.62), rgba(255,255,255,0.14) 46%, ${island.color}26 78%, ${island.color}33 100%)`,
          boxShadow: selected
            ? `0 0 0 2px ${island.color}, 0 24px 60px -14px ${island.color}77, 0 8px 20px -10px rgba(23,32,51,0.28), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -12px 30px -14px ${island.color}4d`
            : `0 18px 50px -16px ${island.color}66, 0 6px 16px -10px rgba(23,32,51,0.22), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -10px 26px -14px ${island.color}40`,
          ...style,
        }}
      >
        {/* Cam parıltısı (üst-sol specular) */}
        <div
          className="pointer-events-none absolute -left-2 -top-2 h-1/2 w-1/2 rounded-full opacity-80 blur-md"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)' }}
          aria-hidden
        />

        <Icon
          className="relative mb-1 h-4 w-4 opacity-80"
          style={{ color: island.color }}
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="relative max-w-[86%] text-[13px] font-semibold leading-tight tracking-tight text-[#18332D]">
          {island.label}
        </p>
        {ghost ? (
          <p className="relative mt-1 max-w-[88%] text-[9px] font-medium leading-tight tracking-wide text-[#18332D]/35">
            Henüz Yeterli Veri Yok
          </p>
        ) : (
          <p className="relative mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums text-[#6B6B62]">
            {TrendIcon ? (
              <TrendIcon
                className="h-3 w-3"
                style={{ color: `${island.color}cc` }}
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            %{island.percent}
          </p>
        )}
      </article>
    </div>
  );
}
