'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PATTERN_UPSELL_BODY,
  PATTERN_UPSELL_CTA,
  PATTERN_UPSELL_TITLE,
  PLAN_UPGRADE_BADGE,
} from '@/lib/eza/mirror/copy';
import UpgradeModal from '@/components/plan/UpgradeModal';

export interface PatternPlusUpsellBannerProps {
  className?: string;
}

/** Free kullanıcıya İlişki Deseni ekranında Plus yönlendirmesi. */
export default function PatternPlusUpsellBanner({ className }: PatternPlusUpsellBannerProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <>
      <aside
        className={cn(
          'relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-r from-violet-50/95 via-white/90 to-indigo-50/80 px-4 py-4 shadow-[0_12px_40px_-20px_rgba(123,97,255,0.45)] sm:px-5 sm:py-4',
          className
        )}
        aria-labelledby="pattern-upsell-title"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-300/25 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_6px_18px_-6px_rgba(123,97,255,0.8)]"
              aria-hidden
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p
                id="pattern-upsell-title"
                className="text-sm font-semibold tracking-tight text-[#172033] sm:text-[15px]"
              >
                {PATTERN_UPSELL_TITLE}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#667085]">
                {PATTERN_UPSELL_BODY}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-[#172033] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:self-center"
          >
            <span className="inline-flex items-center rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {PLAN_UPGRADE_BADGE}
            </span>
            {PATTERN_UPSELL_CTA}
          </button>
        </div>
      </aside>

      <UpgradeModal
        open={upgradeOpen}
        feature="relationship_pattern_upsell"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
