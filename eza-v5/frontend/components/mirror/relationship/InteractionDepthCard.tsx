'use client';

import { cn } from '@/lib/utils';
import type { InteractionDepthMetric } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type InteractionDepthCardProps = {
  metric: InteractionDepthMetric;
  className?: string;
  preview?: boolean;
};

export default function InteractionDepthCard({
  metric,
  className,
  preview = false,
}: InteractionDepthCardProps) {
  const showForming = preview || metric.forming;

  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]',
        preview && 'pointer-events-none select-none opacity-45 saturate-[0.55]',
        className
      )}
    >
      <h3 className={cn('text-sm font-semibold text-[#172033]', preview && 'text-stone-500')}>
        Ortalama etkileşim derinliği
      </h3>
      {showForming ? (
        <p className={cn('mt-3 text-sm text-[#667085]', preview && 'text-stone-400')}>
          {preview ? 'Plus ile oluşur' : metric.label}
        </p>
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
