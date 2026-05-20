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
 * Full-bleed poster hero — gradient or AI scene only (no centered mascot).
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
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className={cn('absolute inset-0 bg-gradient-to-br', gradient)} />
      {showSceneImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sceneImageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
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
        className="absolute inset-0 bg-gradient-to-r from-[#1a1035]/75 via-[#2d1b4e]/45 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#f5f0ff] via-transparent to-[#1a1035]/25"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#faf7ff]/90"
        style={{ backgroundSize: '100% 100%' }}
        aria-hidden
      />
    </div>
  );
}
