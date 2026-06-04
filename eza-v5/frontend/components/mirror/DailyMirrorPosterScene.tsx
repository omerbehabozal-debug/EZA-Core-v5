'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS, PERSONA_COLOR_GRADIENT } from '@/lib/eza/personaAssets';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import type { MirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import { shouldUseHybridPosterLayout } from '@/lib/eza/mirror/mirrorPosterLayout';

export type SceneFilterProfile = {
  brightness: number;
  contrast: number;
  saturate: number;
};

export type DailyMirrorPosterSceneProps = {
  personaFamilyId: PersonaFamilyId;
  renderMode?: MirrorRenderMode;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  className?: string;
  /** P2 — contained window vs legacy full-bleed backdrop */
  layout?: 'bleed' | 'contained';
  sceneFilter?: SceneFilterProfile;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

function sceneImageNeedsCrossOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const DEFAULT_FILTER: SceneFilterProfile = {
  brightness: 1.08,
  contrast: 1.12,
  saturate: 1.08,
};

const HYBRID_PLACEHOLDER_GRADIENT =
  'bg-[linear-gradient(165deg,#F8F6F1_0%,#F3F1EC_38%,#EDE8F8_72%,#E8E4F4_100%)]';

/**
 * Full-bleed poster hero — cinematic depth, warm light, editorial energy.
 */
export default function DailyMirrorPosterScene({
  personaFamilyId,
  renderMode = 'scene_only',
  sceneImageUrl,
  sceneImageStatus,
  className,
  layout = 'bleed',
  sceneFilter = DEFAULT_FILTER,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorPosterSceneProps) {
  const [bgError, setBgError] = useState(false);
  const isHybridPlaceholder = shouldUseHybridPosterLayout(renderMode, false);
  const colorToken = FAMILY_ASSET_SLOTS[personaFamilyId]?.colorToken ?? 'violet';
  const gradient =
    PERSONA_COLOR_GRADIENT[colorToken] ?? PERSONA_COLOR_GRADIENT.violet;

  useEffect(() => {
    setBgError(false);
  }, [sceneImageUrl]);

  const showSceneImage = Boolean(
    sceneImageUrl &&
      !bgError &&
      sceneImageStatus !== 'error' &&
      sceneImageStatus !== 'idle' &&
      sceneImageStatus !== 'generating'
  );

  const filterStyle = {
    filter: `brightness(${sceneFilter.brightness}) contrast(${sceneFilter.contrast}) saturate(${sceneFilter.saturate})`,
  };

  const isContained = layout === 'contained';

  return (
    <div
      className={cn(
        isContained ? 'relative h-full w-full overflow-hidden' : 'absolute inset-0 h-full w-full overflow-hidden',
        className
      )}
      aria-hidden
    >
      {isHybridPlaceholder && !showSceneImage ? (
        <div className={cn('absolute inset-0', HYBRID_PLACEHOLDER_GRADIENT)} />
      ) : (
        <div
          className={cn('absolute inset-0 bg-gradient-to-br', gradient, 'opacity-95')}
        />
      )}
      {!showSceneImage && !isHybridPlaceholder ? (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_22%_28%,rgba(255,220,180,0.28),transparent_58%),radial-gradient(ellipse_55%_45%_at_78%_18%,rgba(196,181,253,0.38),transparent_52%)]"
          aria-hidden
        />
      ) : null}
      {isHybridPlaceholder && !showSceneImage ? (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_72%_42%,rgba(196,181,253,0.22),transparent_62%),radial-gradient(ellipse_50%_40%_at_18%_22%,rgba(255,235,210,0.18),transparent_55%)]"
          aria-hidden
        />
      ) : null}
      {showSceneImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sceneImageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_32%] eza-mirror-scene-image-enter"
          style={filterStyle}
          crossOrigin={
            sceneImageNeedsCrossOrigin(sceneImageUrl!) ? 'anonymous' : undefined
          }
          onLoad={() => onSceneImageLoad?.()}
          onError={() => {
            setBgError(true);
            onSceneImageError?.();
          }}
        />
      ) : null}
      {isHybridPlaceholder ? (
        <div
          className="absolute inset-0 bg-gradient-to-b from-[rgba(248,246,241,0.35)] via-transparent via-[18%] to-[rgba(243,241,236,0.42)]"
          aria-hidden
        />
      ) : isContained ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-[rgba(123,97,255,0.08)]"
          aria-hidden
        />
      ) : (
        <>
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#12081c]/58 via-[#0a0614]/08 via-38% to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-[#12081c]/55 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_42%,transparent_48%,rgba(6,2,14,0.22)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_40%_at_50%_100%,rgba(255,200,160,0.06),transparent_70%)]"
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
