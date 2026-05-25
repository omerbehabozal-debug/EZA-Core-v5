'use client';

import { cn } from '@/lib/utils';
import type { TimeOfDayBucket } from '@/lib/eza/mirror/relationshipPatternMetrics';

export type ActiveTimeCardProps = {
  buckets: TimeOfDayBucket[];
  className?: string;
};

export default function ActiveTimeCard({ buckets, className }: ActiveTimeCardProps) {
  return (
    <article
      className={cn(
        'rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-[#172033]">En aktif olduğun zamanlar</h3>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map((b) => (
          <li
            key={b.id}
            className="rounded-2xl border border-[#EDE8F8] bg-[#F8F6F1]/80 px-3 py-2.5 text-center"
          >
            <p className="text-[11px] font-medium text-[#172033]/80">{b.label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-[#7B61FF]">%{b.percent}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
