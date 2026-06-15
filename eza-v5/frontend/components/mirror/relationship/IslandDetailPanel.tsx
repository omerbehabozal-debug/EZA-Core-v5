'use client';

import { ArrowDownRight, ArrowUpRight, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import type { BehaviorIsland } from '@/lib/eza/relationshipMapModel';

const sp = standaloneSkin.sainaPatternPolish;

export type IslandDetailPanelProps = {
  island: BehaviorIsland;
  onClose: () => void;
  className?: string;
  /** false ise: bu alanda henüz gerçek davranış sinyali yok (ghost ada). */
  active?: boolean;
};

const TREND_VIEW: Record<
  NonNullable<BehaviorIsland['trend']>,
  { label: string; sentence: string; Icon: typeof ArrowUpRight; tone: string }
> = {
  growing: {
    label: 'Yükselişte',
    sentence: 'Bu davranış son dönemde daha baskın hale geldi.',
    Icon: ArrowUpRight,
    tone: 'text-emerald-600',
  },
  stable: {
    label: 'Dengede',
    sentence: 'Bu davranış dengede; istikrarlı bir biçimin.',
    Icon: Minus,
    tone: 'saina-pattern-text-muted',
  },
  fading: {
    label: 'Azalıyor',
    sentence: 'Bu davranış son dönemde biraz geri çekildi.',
    Icon: ArrowDownRight,
    tone: 'text-amber-600',
  },
};

export default function IslandDetailPanel({
  island,
  onClose,
  className,
  active = true,
}: IslandDetailPanelProps) {
  const trend = TREND_VIEW[island.trend ?? 'stable'];
  const TrendIcon = trend.Icon;

  if (!active) {
    return (
      <article
        className={cn(sp.sideCard, 'relative overflow-hidden', className)}
        aria-label={`${island.label} ada ayrıntısı`}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
          style={{ background: `radial-gradient(circle, ${island.color}33, transparent 70%)` }}
          aria-hidden
        />

        <button
          type="button"
          onClick={onClose}
          className="saina-pattern-close-btn absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B16A]/40"
          aria-label="Ayrıntıyı kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full opacity-60"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${island.color}33, ${island.color}14 60%, transparent 78%)`,
              border: `1px solid ${island.color}40`,
            }}
            aria-hidden
          >
            <span className="h-2 w-2 rounded-full" style={{ background: `${island.color}99` }} />
          </span>
          <h3 className="text-lg font-semibold tracking-tight saina-pattern-text opacity-85">{island.label}</h3>
        </div>

        <p className="relative mt-4 text-[15px] font-medium leading-relaxed saina-pattern-text opacity-80">
          Bu alanda henüz yeterli davranış sinyali oluşmadı.
        </p>
        <p className="relative mt-2 text-sm leading-relaxed saina-pattern-text-muted">
          EZA bu davranış alanını gözlemliyor; bu yönde birkaç etkileşim biriktiğinde ada canlanıp
          haritada belirginleşecek.
        </p>
      </article>
    );
  }

  return (
    <article
      className={cn(sp.sideCard, 'relative overflow-hidden', className)}
      aria-label={`${island.label} ada ayrıntısı`}
    >
      {/* Adanın renginden hafif atmosfer */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-50 blur-2xl"
        style={{ background: `radial-gradient(circle, ${island.color}40, transparent 70%)` }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onClose}
        className="saina-pattern-close-btn absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B16A]/40"
        aria-label="Ayrıntıyı kapat"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex items-center gap-2.5">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 28%, ${island.color}40, ${island.color}1a 60%, transparent 78%)`,
            border: `1px solid ${island.color}66`,
          }}
          aria-hidden
        >
          <span className="h-2 w-2 rounded-full" style={{ background: island.color }} />
        </span>
        <h3 className="text-lg font-semibold tracking-tight saina-pattern-text">{island.label}</h3>
      </div>

      {/* Anlam cümlesi — veri değil, his */}
      <p className="relative mt-4 text-[15px] font-medium leading-relaxed saina-pattern-text">
        {trend.sentence}
      </p>

      <div className="relative mt-4 flex items-center gap-5 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] saina-pattern-text-muted opacity-80">
            Durum
          </p>
          <p className={cn('mt-1 inline-flex items-center gap-1 text-sm font-semibold', trend.tone)}>
            <TrendIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
            {trend.label}
          </p>
        </div>
        <div className="saina-pattern-divider h-8 w-px" aria-hidden />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] saina-pattern-text-muted opacity-80">
            Pay
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums saina-pattern-text opacity-70">
            %{island.percent}
          </p>
        </div>
      </div>

      {island.description ? (
        <p className="relative mt-4 text-sm leading-relaxed saina-pattern-text-muted">{island.description}</p>
      ) : null}
    </article>
  );
}
