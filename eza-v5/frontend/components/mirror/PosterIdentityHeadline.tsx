'use client';

import {
  formatPosterMirrorMomentDisplay,
  type PosterIdentityDisplay,
} from '@/lib/eza/mirror/posterCardContent';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';

export type PosterIdentityHeadlineProps = {
  identity: PosterIdentityDisplay;
  skin: PosterSkinTokens;
  isSparse?: boolean;
};

/**
 * Text-only daily identity + P4-C1 mirror moment (scene emotional line).
 */
export default function PosterIdentityHeadline({
  identity,
  skin,
  isSparse = false,
}: PosterIdentityHeadlineProps) {
  const momentDisplay =
    !isSparse && identity.mirrorMomentLine
      ? formatPosterMirrorMomentDisplay(identity.mirrorMomentLine)
      : '';
  const showFamily =
    !isSparse && identity.behaviorFamilyLabel && !momentDisplay;

  return (
    <section
      className={skin.overlayIdentity ?? skin.identityHeadlineZone}
      aria-labelledby="daily-mirror-poster-title"
    >
      <p className={skin.identityTodayLabel}>Bugün Sen</p>
      <h2 id="daily-mirror-poster-title" className={skin.identityAvatarName}>
        {isSparse ? 'Yansıma hazırlanıyor' : identity.avatarName}
      </h2>
      {momentDisplay ? (
        <p className={skin.identityMirrorMoment}>{momentDisplay}</p>
      ) : null}
      {showFamily ? (
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
