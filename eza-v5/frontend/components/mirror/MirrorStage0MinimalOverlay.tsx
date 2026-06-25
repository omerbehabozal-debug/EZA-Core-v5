'use client';

/**
 * Mirror overlay intentionally stays minimal.
 *
 * The Mirror is an artwork.
 * The landing page carries the context.
 *
 * Do not add summaries, CTA, or metadata here.
 *
 * SAINA Mirror Philosophy — see @/lib/eza/mirror-network/philosophy.ts
 */

import { Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { MIRROR_V3_BRAND_SIGNATURE } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { POSTER_READABILITY_INLINE } from '@/lib/eza/mirror/posterEditorialMathematics';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

export type MirrorStage0MinimalOverlayProps = {
  card: DailyMirrorCardModel;
  skin: PosterSkinTokens;
  className?: string;
};

/**
 * Stage 0 — card surface: brand + title + date only (no body, themes, CTA, scores).
 */
export default function MirrorStage0MinimalOverlay({
  card,
  skin,
  className,
}: MirrorStage0MinimalOverlayProps) {
  const title = card.headline?.trim() || card.dailyJourney?.trim() || 'SAINA Mirror';

  return (
    <div
      className={cn(skin.overlayStack, 'pointer-events-none', className)}
      data-mirror-stage0-minimal
      aria-label={title}
    >
      <header className={cn(skin.overlayHeader, 'shrink-0')}>
        <p
          className={cn(skin.logoText, 'flex items-center gap-2')}
          style={POSTER_READABILITY_INLINE.masthead}
        >
          <span className={skin.logoMark}>
            <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </span>
          {MIRROR_V3_BRAND_SIGNATURE.line1}
        </p>
        <span className={skin.datePillGlass}>
          <span className={skin.datePill} style={POSTER_READABILITY_INLINE.masthead}>
            <Calendar className="mr-1 inline h-3 w-3 opacity-90" strokeWidth={1.5} aria-hidden />
            {card.dayLabel}
          </span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-end pb-6">
        <h2
          id="daily-mirror-poster-title"
          className={cn(skin.rhythmWhisperWord, 'text-balance')}
          style={POSTER_READABILITY_INLINE.headline}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}
