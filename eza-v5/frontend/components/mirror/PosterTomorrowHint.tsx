'use client';

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

const TOMORROW_PREFIX = 'Yarın için: ';

export type PosterTomorrowHintProps = {
  tomorrowHint?: string;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

/** P4-C3 — quiet line above footer (not a second glass card). */
export default function PosterTomorrowHint({
  tomorrowHint,
  skin,
  isSparse = false,
}: PosterTomorrowHintProps) {
  const hint = tomorrowHint?.trim();
  if (isSparse || !hint) return null;

  const display = hint.startsWith(TOMORROW_PREFIX)
    ? hint
    : hint.startsWith('Yarın')
      ? hint
      : `${TOMORROW_PREFIX}${hint}`;

  return (
    <p className={skin.tomorrowWhisper} aria-label="Yarın için ipucu">
      {display}
    </p>
  );
}
