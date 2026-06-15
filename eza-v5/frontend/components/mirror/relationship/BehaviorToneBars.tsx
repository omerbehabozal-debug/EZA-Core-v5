'use client';

import { cn } from '@/lib/utils';
import type { BarMetric } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type BehaviorToneBarsProps = {
  title: string;
  subtitle: string;
  bars: BarMetric[];
  accent?: 'violet' | 'sky';
  className?: string;
  /** Free plan — silik, sabit placeholder; yüzde göstermez. */
  preview?: boolean;
};

export default function BehaviorToneBars({
  title,
  subtitle,
  bars,
  accent = 'violet',
  className,
  preview = false,
}: BehaviorToneBarsProps) {
  const fill = preview
    ? 'bg-white/10'
    : accent === 'violet'
      ? 'bg-gradient-to-r from-[#d8b16a] to-[#e7b45b]'
      : 'bg-gradient-to-r from-[#38bdf8] to-[#60a5fa]';

  return (
    <article
      className={cn(
        'saina-pattern-glass-side saina-pattern-metric-card',
        preview && 'pointer-events-none select-none opacity-45 saturate-[0.55]',
        className
      )}
    >
      <h3 className={cn('text-sm font-semibold saina-pattern-text', preview && 'opacity-60')}>
        {title}
      </h3>
      <p className={cn('mt-1 text-xs leading-relaxed saina-pattern-text-muted', preview && 'opacity-60')}>
        {subtitle}
      </p>
      <ul className="mt-4 space-y-3">
        {bars.map((bar) => (
          <li key={bar.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span
                className={cn('font-medium saina-pattern-text opacity-88', preview && 'opacity-60')}
              >
                {bar.label}
              </span>
              <span className={cn('tabular-nums saina-pattern-text-muted', preview && 'opacity-50')}>
                {preview ? '—' : `%${bar.percent}`}
              </span>
            </div>
            <div className="saina-pattern-bar-track h-2 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full transition-all duration-500', fill)}
                style={{ width: preview ? '42%' : `${Math.max(4, bar.percent)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
