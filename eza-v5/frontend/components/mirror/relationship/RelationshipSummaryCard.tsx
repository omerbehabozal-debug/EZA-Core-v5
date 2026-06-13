'use client';

import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RelationshipSummaryCardProps = {
  label: string;
  hint: string;
  scorePercent?: number;
  className?: string;
  preview?: boolean;
};

export default function RelationshipSummaryCard({
  label,
  hint,
  scorePercent = 72,
  className,
  preview = false,
}: RelationshipSummaryCardProps) {
  const ring = preview ? 38 : Math.min(100, Math.max(24, scorePercent));
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (ring / 100) * circumference;

  return (
    <article
      className={cn(
        'saina-pattern-glass-side rounded-3xl p-4 sm:p-5',
        preview && 'pointer-events-none select-none opacity-45 saturate-[0.55]',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
            <circle cx="32" cy="32" r="28" fill="none" stroke="#EFE8DA" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={preview ? '#d4d4d8' : 'url(#balanceRing)'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
            {!preview ? (
              <defs>
                <linearGradient id="balanceRing" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D8B16A" />
                  <stop offset="100%" stopColor="#0F3D32" />
                </linearGradient>
              </defs>
            ) : null}
          </svg>
          <Activity
            className={cn(
              'absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#D8B16A]',
              preview && 'text-stone-300'
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B6B62]',
              preview && 'text-stone-400'
            )}
          >
            Genel Denge
          </p>
          <p
            className={cn(
              'mt-1 text-base font-semibold leading-snug text-[#18332D]',
              preview && 'text-stone-400'
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              'mt-1.5 text-xs leading-relaxed text-[#667085]/90',
              preview && 'text-stone-400'
            )}
          >
            {hint}
          </p>
        </div>
      </div>
    </article>
  );
}
