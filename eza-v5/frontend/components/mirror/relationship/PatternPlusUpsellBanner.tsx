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
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import UpgradeModal from '@/components/plan/UpgradeModal';

const sp = standaloneSkin.sainaPatternPolish;

export interface PatternPlusUpsellBannerProps {
  className?: string;
  onCtaClick?: () => void;
}

/** Free kullanıcıya İlişki Deseni ekranında Plus yönlendirmesi. */
export default function PatternPlusUpsellBanner({
  className,
  onCtaClick,
}: PatternPlusUpsellBannerProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    setUpgradeOpen(true);
  };

  return (
    <>
      <aside
        className={cn(sp.upsellBanner, className)}
        aria-labelledby="pattern-upsell-title"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#d8b16a]/15 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#d8b16a]/35 bg-[rgba(5,72,58,0.9)] text-[#e7b45b] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)]"
              aria-hidden
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p
                id="pattern-upsell-title"
                className="text-sm font-semibold tracking-tight saina-pattern-text sm:text-[15px]"
              >
                {PATTERN_UPSELL_TITLE}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed saina-pattern-text-muted">
                {PATTERN_UPSELL_BODY}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCta}
            className={sp.upsellCta}
          >
            <span className="inline-flex items-center rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {PLAN_UPGRADE_BADGE}
            </span>
            {PATTERN_UPSELL_CTA}
          </button>
        </div>
      </aside>

      <UpgradeModal
        open={upgradeOpen && !onCtaClick}
        feature="relationship_pattern_upsell"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
