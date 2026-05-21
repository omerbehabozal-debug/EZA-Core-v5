'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS, PERSONA_COLOR_GRADIENT } from '@/lib/eza/personaAssets';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

export type DailyMirrorPosterSceneProps = {
  personaFamilyId: PersonaFamilyId;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  className?: string;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

function sceneImageNeedsCrossOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Full-bleed poster hero — AI scene or premium gradient placeholder.
 */
export default function DailyMirrorPosterScene({
  personaFamilyId,
  sceneImageUrl,
  sceneImageStatus,
  className,
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

  return (
    <div className={cn('absolute inset-0 h-full w-full overflow-hidden', className)} aria-hidden>
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br',
          gradient,
          'opacity-90'
        )}
      />
      {!showSceneImage ? (
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_20%_30%,rgba(255,255,255,0.22),transparent_55%),radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(196,181,253,0.35),transparent_50%)]"
          aria-hidden
        />
      ) : null}
      {showSceneImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sceneImageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_32%] brightness-[1.04] contrast-[1.06] saturate-[1.05] eza-mirror-scene-image-enter"
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
        className="absolute inset-0 bg-gradient-to-r from-[#0a0614]/52 via-[#0a0614]/12 via-40% to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-[#0a0614]/42 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_50%_38%,transparent_52%,rgba(8,4,16,0.14)_100%)]"
        aria-hidden
      />
    </div>
  );
}
