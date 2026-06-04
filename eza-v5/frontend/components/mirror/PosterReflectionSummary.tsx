'use client';

import type { PosterRhythmDisplay } from '@/lib/eza/mirror/posterCardContent';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

export type PosterReflectionSummaryProps = {
  rhythm: PosterRhythmDisplay;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

/**
 * P4-C3 — whisper-only relationship rhythm (no scores, story, or Sen/AI on poster).
 */
export default function PosterReflectionSummary({
  rhythm,
  skin,
  isSparse = false,
}: PosterReflectionSummaryProps) {
  if (isSparse) return null;

  return (
    <section
      className={skin.rhythmWhisperZone ?? skin.overlayReflection}
      aria-label="İlişki ritmi"
    >
      <p className={skin.rhythmWhisperEyebrow}>{rhythm.eyebrow}</p>
      <p className={skin.rhythmWhisperWord}>{rhythm.word}</p>
    </section>
  );
}
