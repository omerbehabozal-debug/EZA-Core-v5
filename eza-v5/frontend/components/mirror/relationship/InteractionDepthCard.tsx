'use client';

import { cn } from '@/lib/utils';
import type { InteractionDepthMetric } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type InteractionDepthCardProps = {
  metric: InteractionDepthMetric;
  className?: string;
};

export default function InteractionDepthCard({ metric, className }: InteractionDepthCardProps) {
  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-[#172033]">Ortalama etkileşim derinliği</h3>
      {metric.forming ? (
        <p className="mt-3 text-sm text-[#667085]">{metric.label}</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[#172033]">{metric.label}</p>
          {metric.deltaPercent != null ? (
            <p className="mt-1 text-xs font-medium text-emerald-600/90">
              {metric.deltaPercent >= 0 ? '+' : ''}
              {metric.deltaPercent}% önceki 30 güne göre
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
