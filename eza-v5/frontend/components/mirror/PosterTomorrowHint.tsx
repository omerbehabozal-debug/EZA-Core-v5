'use client';

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

const TOMORROW_PREFIX = 'Yarın için: ';

export type PosterTomorrowHintProps = {
  tomorrowHint?: string;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

export default function PosterTomorrowHint({
  tomorrowHint,
  skin,
  isSparse = false,
}: PosterTomorrowHintProps) {
  const hint = tomorrowHint?.trim();
  if (isSparse || !hint) return null;

  const display = hint.startsWith(TOMORROW_PREFIX)
    ? hint
    : `${TOMORROW_PREFIX}${hint}`;

  return (
    <section className={skin.tomorrowZone} aria-label="Yarın için ipucu">
      <p className={skin.tomorrowLabel}>Yarın</p>
      <p className={skin.tomorrowText}>{display}</p>
    </section>
  );
}
