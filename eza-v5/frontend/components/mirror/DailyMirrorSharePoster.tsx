'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import {
  buildPosterCardContent,
  formatPosterMirrorMomentDisplay,
  resolvePosterIdentityDisplay,
} from '@/lib/eza/mirror/posterCardContent';
import { resolvePosterSceneTone } from '@/lib/eza/mirror/posterSceneTone';
import { getSharePosterSkin, SHARE_POSTER_WIDTH_PX } from '@/lib/eza/mirror/sharePosterSkin';
import { resolveCardRenderMode } from '@/lib/eza/mirror/mirrorPosterLayout';
import FullCanvasScene from '@/components/mirror/FullCanvasScene';

export type DailyMirrorSharePosterProps = {
  card: DailyMirrorCardModel;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

/**
 * P4-C4 — viral share poster (scene + identity + mirror moment only).
 * Captured for PNG export; not shown in-app.
 */
export default function DailyMirrorSharePoster({
  card,
  sceneImageUrl,
  sceneImageStatus,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorSharePosterProps) {
  const sceneUrl = sceneImageUrl ?? card.visual?.sceneImageUrl ?? null;
  const sceneStatus = sceneImageStatus ?? card.visual?.sceneImageStatus ?? 'idle';
  const renderMode = resolveCardRenderMode(card);
  const sceneTone = useMemo(() => resolvePosterSceneTone(card), [card]);
  const skin = useMemo(() => getSharePosterSkin(sceneTone.id), [sceneTone.id]);
  const content = useMemo(() => buildPosterCardContent(card), [card]);
  const identity = useMemo(
    () => resolvePosterIdentityDisplay(card, content),
    [card, content]
  );

  const avatarName =
    identity.avatarName?.trim() || card.dailyAvatarName?.trim() || card.characterName?.trim() || '';
  const momentDisplay = identity.mirrorMomentLine
    ? formatPosterMirrorMomentDisplay(identity.mirrorMomentLine)
    : '';
  const themeTitle = identity.themeTitle?.trim() || card.dailyThemeTitle?.trim() || '';
  const themeSubtitle = identity.themeSubtitle?.trim() || card.dailyThemeSubtitle?.trim() || '';

  const cardStyle = useMemo(
    () => ({
      maxWidth: SHARE_POSTER_WIDTH_PX,
      width: '100%',
    }),
    []
  );

  return (
    <article
      data-mirror-share-root
      data-mirror-aspect="9-16"
      data-mirror-poster="share-story-v1"
      data-mirror-scene-tone={sceneTone.id}
      className={skin.root}
      style={cardStyle}
      aria-label={avatarName || 'EZA Daily Mirror share poster'}
    >
      <FullCanvasScene
        personaFamilyId={card.personaFamilyId}
        renderMode={renderMode}
        sceneImageUrl={sceneUrl}
        sceneImageStatus={sceneStatus}
        skin={skin}
        sceneFilter={{ brightness: 1.06, contrast: 1.08, saturate: 1.06 }}
        onSceneImageLoad={onSceneImageLoad}
        onSceneImageError={onSceneImageError}
      />

      <div className={skin.overlayScrim} aria-hidden>
        <div className={skin.overlayTopScrim} aria-hidden />
        <div className={skin.overlayBottomScrim} aria-hidden />
      </div>

      <div className={skin.grain} aria-hidden />

      <div className={skin.overlayStack}>
        <header className={skin.shareMasthead}>
          <span className={cn(skin.shareMastheadBrand, 'inline-flex items-center gap-1')}>
            <Sparkles className="h-2.5 w-2.5 text-amber-200/80" aria-hidden />
            EZA · AI İlişki Aynası
          </span>
          <span className={skin.shareMastheadDate}>{card.dayLabel}</span>
        </header>

        <div className="min-h-0 flex-1" aria-hidden />

        <section
          className={cn(
            skin.shareIdentityZone,
            'mx-auto max-w-[92%] items-center justify-center text-center'
          )}
          aria-label={avatarName || 'Kimlik'}
        >
          {avatarName ? (
            <h2
              className={cn(
                skin.shareAvatarName,
                'font-serif text-[clamp(1.75rem,9vw,2.65rem)]'
              )}
            >
              {avatarName}
            </h2>
          ) : null}
          {momentDisplay ? (
            <p className={cn(skin.shareMirrorMoment, 'mx-auto max-w-[88%]')}>{momentDisplay}</p>
          ) : null}
          {themeTitle ? (
            <p className={cn(skin.shareThemeLine, 'mx-auto max-w-[90%]')}>
              <span className={skin.shareThemeTitle}>{themeTitle}</span>
              {themeSubtitle ? (
                <span className={skin.shareThemeSubtitle}> · {themeSubtitle}</span>
              ) : null}
            </p>
          ) : null}
        </section>

        <footer className={skin.shareFooter}>
          <span>EZA</span>
          <span className="text-center">#EZAİlişkiAynası</span>
          <span className="text-right">eza.ai</span>
        </footer>
      </div>
    </article>
  );
}
