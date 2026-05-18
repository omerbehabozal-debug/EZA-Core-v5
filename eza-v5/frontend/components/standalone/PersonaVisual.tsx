'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { StandalonePersonaView } from '@/lib/eza/standalonePersonas';
import {
  PERSONA_COLOR_GRADIENT,
  personaIllustrationSrc,
} from '@/lib/eza/personaAssets';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const m = standaloneSkin.motion;

interface PersonaVisualProps {
  persona: StandalonePersonaView;
  size?: 'sm' | 'md' | 'hero';
  variant?: 'orb' | 'hero';
  className?: string;
}

export default function PersonaVisual({
  persona,
  size = 'md',
  variant = 'orb',
  className,
}: PersonaVisualProps) {
  const reducedMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const src = personaIllustrationSrc(persona.illustrationKey);
  const showImage = Boolean(src && !imgError);
  const gradient =
    PERSONA_COLOR_GRADIENT[persona.colorToken] ??
    PERSONA_COLOR_GRADIENT.stone;

  const orbDim =
    size === 'sm'
      ? 'h-11 w-11 max-h-11 max-w-11 text-lg'
      : 'h-14 w-14 max-h-14 max-w-14 text-2xl sm:h-16 sm:w-16 sm:max-h-16 sm:max-w-16 sm:text-[1.75rem]';

  const isHero = variant === 'hero' || size === 'hero';

  if (isHero) {
    return (
      <div
        className={cn('relative z-10 flex h-full w-full items-center justify-center', className)}
        aria-hidden
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt=""
            className="max-h-[92%] max-w-[92%] object-contain object-center"
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-5xl leading-none sm:text-6xl" role="img" aria-label={persona.name}>
            {persona.iconFallback || persona.emoji}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        m.personaOrb,
        `bg-gradient-to-br ${gradient}`,
        orbDim,
        'overflow-hidden',
        !reducedMotion && m.personaFloat,
        className
      )}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="max-h-[88%] max-w-[88%] object-contain object-center"
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="leading-none" role="img" aria-label={persona.name}>
          {persona.iconFallback || persona.emoji}
        </span>
      )}
    </div>
  );
}
