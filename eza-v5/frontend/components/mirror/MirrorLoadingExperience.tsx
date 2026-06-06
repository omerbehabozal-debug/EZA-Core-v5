'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

const LOADING_STEPS = [
  'EZA aynanı oluşturuyor',
  'Konular okunuyor',
  'İlişki ritmi çıkarılıyor',
  'Sahne hazırlanıyor',
] as const;

export type MirrorLoadingExperienceProps = {
  sceneImageStatus?: MirrorSceneImageStatus;
  className?: string;
};

const ms = standaloneSkin.mirrorSurface;

/**
 * Full-page Mirror loading — shown instead of the poster card until sceneImageUrl is ready.
 */
export default function MirrorLoadingExperience({
  sceneImageStatus = 'generating',
  className,
}: MirrorLoadingExperienceProps) {
  const [activeStep, setActiveStep] = useState(0);
  const isError = sceneImageStatus === 'error';

  useEffect(() => {
    if (isError) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [isError]);

  const headline = useMemo(() => {
    if (isError) return 'Sahne şu an hazırlanamadı';
    return LOADING_STEPS[activeStep];
  }, [activeStep, isError]);

  return (
    <section
      className={cn(ms.mirrorLoadingRoot, className)}
      role="status"
      aria-live="polite"
      aria-busy={!isError}
      aria-label={headline}
    >
      <div className={ms.mirrorLoadingRing} aria-hidden>
        <Sparkles className="h-5 w-5 text-amber-100/90" strokeWidth={1.5} />
      </div>

      <p className={ms.mirrorLoadingTitle}>{headline}</p>
      <p className={ms.mirrorLoadingSubtitle}>
        {isError
          ? 'Sayfayı yenile veya biraz sonra tekrar dene.'
          : 'Sahnen sakin bir ışıkla hazırlanıyor…'}
      </p>

      {!isError ? (
        <ul className={ms.mirrorLoadingSteps} aria-hidden>
          {LOADING_STEPS.map((step, index) => (
            <li
              key={step}
              className={cn(
                ms.mirrorLoadingStep,
                index === activeStep && ms.mirrorLoadingStepActive,
                index < activeStep && ms.mirrorLoadingStepDone
              )}
            >
              <span
                className={cn(
                  ms.mirrorLoadingStepDot,
                  index === activeStep && 'bg-violet-400',
                  index < activeStep && 'bg-amber-300/80'
                )}
              />
              {step}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
