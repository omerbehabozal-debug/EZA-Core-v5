'use client';

import { ArrowDownRight, ArrowUpRight, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BehaviorIsland } from '@/lib/eza/relationshipMapModel';

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
    tone: 'text-[#667085]',
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
        className={cn(
          'relative overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/85 p-5 shadow-[0_18px_52px_-20px_rgba(123,97,255,0.32)] backdrop-blur-md',
          className
        )}
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
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[#667085]/70 transition-colors hover:bg-stone-100 hover:text-[#172033] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/40"
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
          <h3 className="text-lg font-semibold tracking-tight text-[#172033]/80">{island.label}</h3>
        </div>

        <p className="relative mt-4 text-[15px] font-medium leading-relaxed text-[#172033]/80">
          Bu alanda henüz yeterli davranış sinyali oluşmadı.
        </p>
        <p className="relative mt-2 text-sm leading-relaxed text-[#667085]">
          EZA bu davranış alanını gözlemliyor; bu yönde birkaç etkileşim biriktiğinde ada canlanıp
          haritada belirginleşecek.
        </p>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/85 p-5 shadow-[0_18px_52px_-20px_rgba(123,97,255,0.32)] backdrop-blur-md',
        className
      )}
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
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[#667085]/70 transition-colors hover:bg-stone-100 hover:text-[#172033] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]/40"
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
        <h3 className="text-lg font-semibold tracking-tight text-[#172033]">{island.label}</h3>
      </div>

      {/* Anlam cümlesi — veri değil, his */}
      <p className="relative mt-4 text-[15px] font-medium leading-relaxed text-[#172033]">
        {trend.sentence}
      </p>

      <div className="relative mt-4 flex items-center gap-5 border-t border-stone-100 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]/80">
            Durum
          </p>
          <p className={cn('mt-1 inline-flex items-center gap-1 text-sm font-semibold', trend.tone)}>
            <TrendIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
            {trend.label}
          </p>
        </div>
        <div className="h-8 w-px bg-stone-100" aria-hidden />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]/80">
            Pay
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#172033]/70">
            %{island.percent}
          </p>
        </div>
      </div>

      {island.description ? (
        <p className="relative mt-4 text-sm leading-relaxed text-[#475467]">{island.description}</p>
      ) : null}
    </article>
  );
}
