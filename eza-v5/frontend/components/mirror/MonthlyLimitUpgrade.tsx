'use client';

import { CalendarClock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FREE_MIRROR_LIMIT_BODY,
  FREE_MIRROR_LIMIT_CTA,
  FREE_MIRROR_LIMIT_NEXT_LABEL,
  FREE_MIRROR_LIMIT_PLUS_HINT,
  FREE_MIRROR_LIMIT_TITLE,
} from '@/lib/eza/mirror/copy';
import { formatNextFreeMirrorDate } from '@/lib/eza/plan/freeMirrorUsage';

export type MonthlyLimitUpgradeProps = {
  onUpgrade: () => void;
  onBack?: () => void;
  className?: string;
};

export default function MonthlyLimitUpgrade({
  onUpgrade,
  onBack,
  className,
}: MonthlyLimitUpgradeProps) {
  const nextDate = formatNextFreeMirrorDate();

  return (
    <section
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-6 text-center sm:px-6',
        className
      )}
      aria-labelledby="free-mirror-limit-title"
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100/80 text-amber-700/90"
          aria-hidden
        >
          <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <h2
            id="free-mirror-limit-title"
            className="text-[1.15rem] font-semibold leading-tight tracking-[-0.03em] text-stone-900 sm:text-[1.3rem]"
          >
            {FREE_MIRROR_LIMIT_TITLE}
          </h2>
          <p className="mx-auto max-w-[22rem] text-[13px] leading-relaxed text-stone-600">
            {FREE_MIRROR_LIMIT_BODY}
          </p>
        </div>

        <div className="w-full max-w-[17rem] rounded-2xl border border-stone-200/70 bg-white/70 px-4 py-3 text-center shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
            {FREE_MIRROR_LIMIT_NEXT_LABEL}
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-800">{nextDate}</p>
        </div>

        <p className="max-w-[20rem] text-[12px] leading-snug text-stone-500">
          {FREE_MIRROR_LIMIT_PLUS_HINT}
        </p>

        <button
          type="button"
          onClick={onUpgrade}
          className={cn(
            'inline-flex w-full max-w-[17rem] items-center justify-center gap-2 rounded-full',
            'bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600',
            'px-6 py-3 text-sm font-semibold tracking-tight text-white',
            'shadow-[0_10px_36px_-10px_rgba(99,102,241,0.72)]',
            'transition-all hover:from-violet-500 hover:via-violet-500 hover:to-indigo-500',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400'
          )}
        >
          <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
          {FREE_MIRROR_LIMIT_CTA}
        </button>

        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] font-medium text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
          >
            Geri dön
          </button>
        ) : null}
      </div>
    </section>
  );
}
