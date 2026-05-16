'use client';

import { cn } from '@/lib/utils';

export type ReliabilityBand = 'high' | 'medium' | 'low' | 'unknown';

export interface ReliabilityPillProps {
  score?: number | null;
  band?: ReliabilityBand;
  className?: string;
}

function bandFromScore(score?: number | null): ReliabilityBand {
  if (score == null || Number.isNaN(score)) return 'unknown';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

const bandLabels: Record<ReliabilityBand, string> = {
  high: 'Yüksek güvenilirlik',
  medium: 'Orta güvenilirlik',
  low: 'Düşük güvenilirlik',
  unknown: 'Güvenilirlik —',
};

const bandClasses: Record<ReliabilityBand, string> = {
  high: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};

export default function ReliabilityPill({ score, band, className }: ReliabilityPillProps) {
  const resolved = band ?? bandFromScore(score);
  const label =
    score != null && !Number.isNaN(score)
      ? `${bandLabels[resolved]} · ${Math.round(score)}`
      : bandLabels[resolved];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-medium tabular-nums',
        bandClasses[resolved],
        className
      )}
    >
      {label}
    </span>
  );
}
