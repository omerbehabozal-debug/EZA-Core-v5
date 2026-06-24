'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_SCENE_RATE_LIMIT,
  MIRROR_SCENE_OPENAI_QUOTA,
  MIRROR_SCENE_RETRY,
  MIRROR_SCENE_SLOW_HINT,
  MIRROR_SCENE_UNAVAILABLE,
} from '@/lib/eza/mirror/copy';
import type { MirrorSceneImageStatus } from '@/lib/eza/mirror/types';

const LOADING_STEPS = [
  'EZA aynanı oluşturuyor',
  'Konular okunuyor',
  'İlişki ritmi çıkarılıyor',
  'Sahne hazırlanıyor',
] as const;

export type MirrorLoadingExperienceProps = {
  sceneImageStatus?: MirrorSceneImageStatus;
  rateLimited?: boolean;
  openaiQuota?: boolean;
  onRetry?: () => void;
  className?: string;
};

const ms = standaloneSkin.mirrorSurface;

/**
 * Full-page Mirror loading — shown instead of the poster card until sceneImageUrl is ready.
 */
export default function MirrorLoadingExperience({
  sceneImageStatus = 'generating',
  rateLimited = false,
  openaiQuota = false,
  onRetry,
  className,
}: MirrorLoadingExperienceProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const isError = sceneImageStatus === 'error';

  useEffect(() => {
    if (isError) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [isError]);

  useEffect(() => {
    if (isError) {
      setShowSlowHint(false);
      return;
    }
    const slowTimer = window.setTimeout(() => setShowSlowHint(true), 25_000);
    return () => window.clearTimeout(slowTimer);
  }, [isError]);

  const headline = useMemo(() => {
    if (isError) {
      if (openaiQuota) return 'AI servisi kotası';
      return rateLimited ? 'Çok fazla istek' : 'Sahne şu an hazırlanamadı';
    }
    return LOADING_STEPS[activeStep];
  }, [activeStep, isError, rateLimited, openaiQuota]);

  return (
    <section
      className={cn(ms.mirrorLoadingRoot, className)}
      role="status"
      aria-live="polite"
      aria-busy={!isError}
      aria-label={headline}
    >
      <div className={ms.mirrorLoadingRing} aria-hidden>
        <Sparkles className="h-6 w-6 text-amber-100/90" strokeWidth={1.5} />
      </div>

      <p className={ms.mirrorLoadingTitle}>{headline}</p>
      <p className={ms.mirrorLoadingSubtitle}>
        {isError
          ? openaiQuota
            ? MIRROR_SCENE_OPENAI_QUOTA
            : rateLimited
            ? MIRROR_SCENE_RATE_LIMIT
            : MIRROR_SCENE_UNAVAILABLE
          : showSlowHint
            ? MIRROR_SCENE_SLOW_HINT
            : 'Sahnen sakin bir ışıkla hazırlanıyor…'}
      </p>

      {isError && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-2 inline-flex items-center justify-center rounded-full border border-violet-200/50',
            'bg-violet-50/90 px-5 py-2 text-xs font-medium text-violet-900',
            'transition-colors hover:border-violet-300/60 hover:bg-violet-100/90',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50'
          )}
        >
          {MIRROR_SCENE_RETRY}
        </button>
      ) : null}

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
