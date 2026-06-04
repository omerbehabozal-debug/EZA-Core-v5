'use client';

import { Loader2 } from 'lucide-react';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import type { MirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import type { PosterIdentityDisplay } from '@/lib/eza/mirror/posterCardContent';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';

export type PosterSceneWindowProps = {
  personaFamilyId: PersonaFamilyId;
  renderMode?: MirrorRenderMode;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  skin: PosterSkinTokens;
  identity?: PosterIdentityDisplay;
  showThemeCaption?: boolean;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

export default function PosterSceneWindow({
  personaFamilyId,
  renderMode = 'scene_only',
  sceneImageUrl,
  sceneImageStatus,
  skin,
  identity,
  showThemeCaption = true,
  onSceneImageLoad,
  onSceneImageError,
}: PosterSceneWindowProps) {
  const isGenerating = sceneImageStatus === 'generating';
  const captionTheme = identity?.themeTitle?.trim();

  return (
    <section className={skin.sceneWindowZone} aria-label="Günün sahnesi — avatar ve tema">
      <div className={skin.sceneWindowOuter}>
        <DailyMirrorPosterScene
          layout="contained"
          personaFamilyId={personaFamilyId}
          renderMode={renderMode}
          sceneImageUrl={sceneImageUrl}
          sceneImageStatus={sceneImageStatus}
          className="h-full w-full"
          sceneFilter={{
            brightness: 1.04,
            contrast: 1.06,
            saturate: 1.05,
          }}
          onSceneImageLoad={onSceneImageLoad}
          onSceneImageError={onSceneImageError}
        />
        {isGenerating ? (
          <div className={skin.sceneWindowGenerating} role="status">
            <Loader2 className="h-5 w-5 animate-spin text-[#7B61FF]/70" aria-hidden />
            <p className={skin.sceneWindowGeneratingText}>Sahne hazırlanıyor…</p>
          </div>
        ) : null}
        {showThemeCaption && captionTheme ? (
          <div className={skin.sceneWindowCaption} aria-hidden>
            <p className={skin.sceneWindowCaptionTitle}>{captionTheme}</p>
            {identity?.themeSubtitle ? (
              <p className={skin.sceneWindowCaptionSub}>{identity.themeSubtitle}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
