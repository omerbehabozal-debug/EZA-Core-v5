'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS, PERSONA_COLOR_GRADIENT } from '@/lib/eza/personaAssets';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

export type SceneFilterProfile = {
  brightness: number;
  contrast: number;
  saturate: number;
};

export type DailyMirrorPosterSceneProps = {
  personaFamilyId: PersonaFamilyId;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  className?: string;
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

/**
 * Full-bleed poster hero — cinematic depth, warm light, editorial energy.
 */
export default function DailyMirrorPosterScene({
  personaFamilyId,
  sceneImageUrl,
  sceneImageStatus,
  className,
  sceneFilter = DEFAULT_FILTER,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorPosterSceneProps) {
  const [bgError, setBgError] = useState(false);
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

  return (
    <div className={cn('absolute inset-0 h-full w-full overflow-hidden', className)} aria-hidden>
      <div
        className={cn('absolute inset-0 bg-gradient-to-br', gradient, 'opacity-95')}
      />
      {!showSceneImage ? (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_22%_28%,rgba(255,220,180,0.28),transparent_58%),radial-gradient(ellipse_55%_45%_at_78%_18%,rgba(196,181,253,0.38),transparent_52%)]"
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
    </div>
  );
}
