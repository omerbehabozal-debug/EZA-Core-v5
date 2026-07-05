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
        'saina-pattern-glass-side saina-pattern-metric-card',
        preview && 'pointer-events-none select-none opacity-45 saturate-[0.55]',
        className
      )}
    >
      <h3 className={cn('text-sm font-semibold saina-pattern-text', preview && 'opacity-60')}>
        Ortalama etkileşim derinliği
      </h3>
      {showForming ? (
        <p className={cn('mt-3 text-sm saina-pattern-text-muted', preview && 'opacity-60')}>
          {preview ? 'Hesabını yükselttiğinde oluşur' : metric.label}
        </p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight saina-pattern-text">{metric.label}</p>
          {metric.deltaPercent != null ? (
            <p className="mt-1 text-xs font-medium text-emerald-400/90">
              {metric.deltaPercent >= 0 ? '+' : ''}
              {metric.deltaPercent}% önceki 30 güne göre
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
