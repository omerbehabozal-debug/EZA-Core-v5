'use client';

import { Loader2, Sparkles } from 'lucide-react';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import type { MirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';

export type FullCanvasSceneProps = {
  personaFamilyId: PersonaFamilyId;
  renderMode?: MirrorRenderMode;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  skin: PosterSkinTokens;
  sceneFilter?: {
    brightness: number;
    contrast: number;
    saturate: number;
  };
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

/**
 * P4-B — Full-bleed editorial scene layer (entire 9:16 card surface).
 */
export default function FullCanvasScene({
  personaFamilyId,
  renderMode = 'scene_only',
  sceneImageUrl,
  sceneImageStatus,
  skin,
  sceneFilter = {
    brightness: 1.04,
    contrast: 1.06,
    saturate: 1.05,
  },
  onSceneImageLoad,
  onSceneImageError,
}: FullCanvasSceneProps) {
  const isGenerating = sceneImageStatus === 'generating';
  const isAwaitingScene =
    !isGenerating &&
    sceneImageStatus !== 'error' &&
    !sceneImageUrl?.trim();

  return (
    <div className={skin.fullCanvasLayer} aria-hidden>
      <DailyMirrorPosterScene
        layout="bleed"
        personaFamilyId={personaFamilyId}
        renderMode={renderMode}
        sceneImageUrl={sceneImageUrl}
        sceneImageStatus={sceneImageStatus}
        className={skin.fullCanvasSceneImage}
        sceneFilter={sceneFilter}
        onSceneImageLoad={onSceneImageLoad}
        onSceneImageError={onSceneImageError}
      />
      {isAwaitingScene && skin.fullCanvasAwaiting ? (
        <div className={skin.fullCanvasAwaiting} role="status" aria-live="polite">
          <div className={skin.fullCanvasGeneratingRing ?? ''}>
            <Sparkles className="h-5 w-5 text-amber-100/90" strokeWidth={1.5} aria-hidden />
          </div>
          <p className={skin.fullCanvasAwaitingTitle}>Ayna oluşuyor</p>
          <p className={skin.fullCanvasAwaitingText}>Sahnen sakin bir ışıkla hazırlanıyor…</p>
        </div>
      ) : null}
      {isGenerating ? (
        <div className={skin.fullCanvasGenerating} role="status" aria-live="polite">
          <div className={skin.fullCanvasGeneratingRing ?? ''}>
            <Loader2 className="h-5 w-5 animate-spin text-amber-50/90" aria-hidden />
          </div>
          <p className={skin.fullCanvasGeneratingTitle ?? skin.fullCanvasGeneratingText}>
            Sahne hazırlanıyor
          </p>
          <p className={skin.fullCanvasGeneratingText}>EZA aynanı sinematik bir sahneyle tamamlıyor…</p>
        </div>
      ) : null}
    </div>
  );
}
