'use client';

import { cn } from '@/lib/utils';
import type { TimeOfDayBucket } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type ActiveTimeCardProps = {
  buckets: TimeOfDayBucket[];
  className?: string;
  preview?: boolean;
};

export default function ActiveTimeCard({
  buckets,
  className,
  preview = false,
}: ActiveTimeCardProps) {
  return (
    <article
      className={cn(
        'saina-pattern-glass-side saina-pattern-metric-card',
        preview && 'pointer-events-none select-none opacity-45 saturate-[0.55]',
        className
      )}
    >
      <h3 className={cn('text-sm font-semibold saina-pattern-text', preview && 'opacity-60')}>
        En aktif olduğun zamanlar
      </h3>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map((b) => (
          <li
            key={b.id}
            className={cn(
              'saina-pattern-glass-tile rounded-2xl px-3 py-2.5 text-center',
              preview && 'opacity-70'
            )}
          >
            <p
              className={cn('text-[11px] font-medium saina-pattern-text-muted', preview && 'opacity-60')}
            >
              {b.label}
            </p>
            <p
              className={cn(
                'mt-0.5 text-lg font-bold tabular-nums saina-pattern-text-accent',
                preview && 'text-base font-medium opacity-50'
              )}
            >
              {preview ? '—' : `%${b.percent}`}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
