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
  size?: 'sm' | 'md';
  className?: string;
}

export default function PersonaVisual({
  persona,
  size = 'md',
  className,
}: PersonaVisualProps) {
  const reducedMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const src = personaIllustrationSrc(persona.illustrationKey);
  const showImage = Boolean(src && !imgError);
  const gradient =
    PERSONA_COLOR_GRADIENT[persona.colorToken] ??
    PERSONA_COLOR_GRADIENT.stone;

  const dim = size === 'sm' ? 'h-11 w-11 text-lg' : 'h-14 w-14 text-2xl sm:h-16 sm:w-16 sm:text-[1.75rem]';

  return (
    <div
      className={cn(
        m.personaOrb,
        `bg-gradient-to-br ${gradient}`,
        dim,
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
          className="h-[70%] w-[70%] object-contain"
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
