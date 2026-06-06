'use client';

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import type { PosterReadabilityInlineStyle } from '@/lib/eza/mirror/posterEditorialMathematics';

const TOMORROW_PREFIX = 'Yarın için: ';

export type PosterTomorrowHintProps = {
  tomorrowHint?: string;
  skin: PosterSkinTokens;
  isSparse?: boolean;
  readabilityStyle?: PosterReadabilityInlineStyle;
};

/** P4-C3 — quiet line above footer (not a second glass card). */
export default function PosterTomorrowHint({
  tomorrowHint,
  skin,
  isSparse = false,
  readabilityStyle,
}: PosterTomorrowHintProps) {
  const hint = tomorrowHint?.trim();
  if (isSparse || !hint) return null;

  const display = hint.startsWith(TOMORROW_PREFIX)
    ? hint
    : hint.startsWith('Yarın')
      ? hint
      : `${TOMORROW_PREFIX}${hint}`;

  return (
    <p
      className={skin.tomorrowWhisper}
      style={readabilityStyle}
      aria-label="Yarın için ipucu"
    >
      {display}
    </p>
  );
}
