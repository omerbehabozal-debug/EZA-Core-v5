'use client';

import type { PosterIdentityDisplay } from '@/lib/eza/mirror/posterCardContent';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

export type PosterIdentityHeadlineProps = {
  identity: PosterIdentityDisplay;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

/**
 * Text-only daily avatar — görsel temsil yalnızca sahne penceresinde (OpenAI).
 */
export default function PosterIdentityHeadline({
  identity,
  skin,
  isSparse = false,
}: PosterIdentityHeadlineProps) {
  return (
    <section className={skin.identityHeadlineZone} aria-labelledby="daily-mirror-poster-title">
      <p className={skin.identityTodayLabel}>Bugün Sen</p>
      <h2 id="daily-mirror-poster-title" className={skin.identityAvatarName}>
        {isSparse ? 'Yansıma hazırlanıyor' : identity.avatarName}
      </h2>
      {!isSparse && identity.behaviorFamilyLabel ? (
        <p className={skin.identityFamilyLabel}>{identity.behaviorFamilyLabel}</p>
      ) : null}
      {!isSparse && identity.themeTitle ? (
        <p className={skin.identityThemeLine}>
          <span className={skin.identityThemeTitle}>{identity.themeTitle}</span>
          {identity.themeSubtitle ? (
            <span className={skin.identityThemeSubtitle}> · {identity.themeSubtitle}</span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
