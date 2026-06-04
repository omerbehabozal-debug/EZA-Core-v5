'use client';

import { Loader2 } from 'lucide-react';
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
      {isGenerating ? (
        <div className={skin.fullCanvasGenerating} role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-white/80" aria-hidden />
          <p className={skin.fullCanvasGeneratingText}>Sahne hazırlanıyor…</p>
        </div>
      ) : null}
    </div>
  );
}
