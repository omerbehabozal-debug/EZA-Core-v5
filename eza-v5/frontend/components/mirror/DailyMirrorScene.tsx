'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { FAMILY_ASSET_SLOTS, PERSONA_COLOR_GRADIENT } from '@/lib/eza/personaAssets';
import PersonaVisual from '@/components/standalone/PersonaVisual';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import { mirrorFocalToCssPosition } from '@/lib/eza/mirror/mirrorSceneFocal';

export interface DailyMirrorSceneProps {
  personaFamilyId: PersonaFamilyId;
  characterName: string;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
  subdued?: boolean;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
}

function sceneImageNeedsCrossOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export default function DailyMirrorScene({
  personaFamilyId,
  characterName,
  sceneImageUrl,
  sceneImageStatus,
  focalX,
  focalY,
  className,
  subdued = false,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorSceneProps) {
  const reducedMotion = useReducedMotion();
  const [bgError, setBgError] = useState(false);
  const persona = useMemo(
    () => pickStandalonePersona(personaFamilyId, `mirror-scene-${personaFamilyId}`),
    [personaFamilyId]
  );
  const colorToken = FAMILY_ASSET_SLOTS[personaFamilyId]?.colorToken ?? 'stone';
  const gradient =
    PERSONA_COLOR_GRADIENT[colorToken] ?? PERSONA_COLOR_GRADIENT.stone;

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
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[1.35rem]',
        subdued ? 'min-h-[11rem] sm:min-h-[12rem]' : 'min-h-[13rem] sm:min-h-[15rem]',
        className
      )}
      aria-hidden
    >
      <div
        className={cn('absolute inset-0 z-0 bg-gradient-to-br', gradient)}
        aria-hidden
      />

      {showSceneImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sceneImageUrl!}
          alt=""
          className="absolute inset-0 z-[1] h-full w-full object-cover"
          style={{
            objectPosition: mirrorFocalToCssPosition({
              ...(typeof focalX === 'number' ? { focalX } : {}),
              ...(typeof focalY === 'number' ? { focalY } : {}),
            }),
          }}
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
        className="pointer-events-none absolute -left-8 top-6 z-[2] h-32 w-32 rounded-full bg-violet-200/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 bottom-4 z-[2] h-28 w-28 rounded-full bg-sky-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 z-[2] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 blur-2xl',
          !reducedMotion && 'animate-pulse [animation-duration:5s]'
        )}
        aria-hidden
      />

      <div
        className={cn(
          'relative z-10 flex h-full min-h-[inherit] items-center justify-center px-6 py-8',
          showSceneImage && 'bg-black/10'
        )}
      >
        <PersonaVisual persona={persona} size="hero" variant="hero" />
      </div>

      {characterName ? (
        <p className="sr-only">{characterName} görsel sahnesi</p>
      ) : null}
    </div>
  );
}
