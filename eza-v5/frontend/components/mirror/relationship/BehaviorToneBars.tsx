'use client';

import { cn } from '@/lib/utils';
import type { BarMetric } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type BehaviorToneBarsProps = {
  title: string;
  subtitle: string;
  bars: BarMetric[];
  accent?: 'violet' | 'sky';
  className?: string;
};

export default function BehaviorToneBars({
  title,
  subtitle,
  bars,
  accent = 'violet',
  className,
}: BehaviorToneBarsProps) {
  const fill =
    accent === 'violet'
      ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B84FF]'
      : 'bg-gradient-to-r from-[#38bdf8] to-[#60a5fa]';

  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#667085]">{subtitle}</p>
      <ul className="mt-4 space-y-3">
        {bars.map((bar) => (
          <li key={bar.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[#172033]/88">{bar.label}</span>
              <span className="tabular-nums text-[#667085]">%{bar.percent}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F3F1EC]">
              <div
                className={cn('h-full rounded-full transition-all duration-500', fill)}
                style={{ width: `${Math.max(4, bar.percent)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
