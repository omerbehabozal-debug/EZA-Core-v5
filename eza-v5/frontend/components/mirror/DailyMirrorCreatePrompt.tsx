'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_CREATE_BUTTON,
  MIRROR_CREATE_PRIVACY_NOTE,
  MIRROR_ERROR_BODY,
  MIRROR_ERROR_RETRY,
  MIRROR_ERROR_TITLE,
  MIRROR_INSUFFICIENT_ACTION,
  MIRROR_INSUFFICIENT_BODY,
  MIRROR_INSUFFICIENT_TITLE,
  MIRROR_ONBOARDING_SUBTITLE,
  MIRROR_ONBOARDING_TITLE,
  MIRROR_STANDALONE_ROUTE,
} from '@/lib/eza/mirror/copy';
import MirrorOnboardingPreview from '@/components/mirror/MirrorOnboardingPreview';

export type DailyMirrorPromptVariant = 'idle' | 'insufficient' | 'error';

export type DailyMirrorCreatePromptProps = {
  variant: DailyMirrorPromptVariant;
  onGenerate: () => void;
  className?: string;
  buttonLabel?: string;
  onboardingTitle?: string;
  onboardingBody?: string;
  compact?: boolean;
  /** SAINA conversation mirror column — hide standalone-only CTAs. */
  embedded?: boolean;
  sampleCount?: number;
  minSamples?: number;
};

const primaryCtaClass = cn(
  'saina-primary-btn',
  '!mt-0 w-full max-w-[17rem]'
);

const panelCtaClass = cn(
  'saina-primary-btn',
  '!mt-0 w-full max-w-[17rem]'
);

export default function DailyMirrorCreatePrompt({
  variant,
  onGenerate,
  className,
  buttonLabel,
  onboardingTitle,
  onboardingBody,
  compact = false,
  embedded = false,
  sampleCount = 0,
  minSamples = 3,
}: DailyMirrorCreatePromptProps) {
  const isInsufficient = variant === 'insufficient';
  const isError = variant === 'error';
  const showOnboarding = variant === 'idle';

  const title = isError
    ? MIRROR_ERROR_TITLE
    : isInsufficient
      ? MIRROR_INSUFFICIENT_TITLE
      : (onboardingTitle ?? MIRROR_ONBOARDING_TITLE);

  const body = isError
    ? MIRROR_ERROR_BODY
    : isInsufficient
      ? embedded && sampleCount > 0 && sampleCount < minSamples
        ? `Ayna için ${minSamples} yanıt gerekli. Şu an ${sampleCount}/${minSamples} hazır — sohbete devam et.`
        : MIRROR_INSUFFICIENT_BODY
      : (onboardingBody ?? MIRROR_ONBOARDING_SUBTITLE);

  return (
    <section
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col items-center justify-center text-center',
        compact
          ? 'saina-mirror-create-prompt--compact px-2 py-1 sm:px-3 sm:py-2'
          : 'px-4 py-2 sm:px-6 sm:py-3',
        className
      )}
      aria-labelledby="daily-mirror-create-title"
    >
      <div
        className={cn(
          'relative mx-auto flex w-full max-w-md flex-col items-center overflow-visible',
          compact ? 'gap-2.5' : 'gap-2.5 sm:gap-3'
        )}
      >
        <div
          className={cn(
            'flex flex-col items-center',
            compact ? 'saina-mirror-create-prompt__hero gap-3.5' : 'gap-2.5'
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_18px_-6px_rgba(231,180,91,0.35)]',
              compact
                ? 'border border-[rgba(231,180,91,0.28)] bg-[rgba(231,180,91,0.12)] text-[#e7b45b]'
                : 'bg-violet-100/70 text-violet-600/90'
            )}
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>

          <div className="space-y-1">
            <h2
              id="daily-mirror-create-title"
              className={cn(
                'text-[1.15rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.3rem]',
                compact ? 'text-[rgba(246,244,239,0.94)]' : 'text-stone-900'
              )}
            >
              {title}
            </h2>
            {body.trim() ? (
              <p
                className={cn(
                  'mx-auto max-w-[19rem] text-[12px] leading-snug sm:text-[13px]',
                  compact ? 'text-[rgba(217,196,163,0.72)]' : 'text-stone-500/95'
                )}
              >
                {body}
              </p>
            ) : null}
          </div>
        </div>

        {showOnboarding ? (
          <button
            type="button"
            onClick={onGenerate}
            className={compact ? panelCtaClass : primaryCtaClass}
          >
            <Sparkles className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
            {buttonLabel ?? MIRROR_CREATE_BUTTON}
          </button>
        ) : null}

        {showOnboarding && !compact ? <MirrorOnboardingPreview className="w-full" /> : null}

        {isInsufficient && !embedded ? (
          <Link href={MIRROR_STANDALONE_ROUTE} className={cn(primaryCtaClass, 'no-underline')}>
            {MIRROR_INSUFFICIENT_ACTION}
          </Link>
        ) : null}

        {isInsufficient && embedded ? (
          <p className="text-[11px] leading-snug text-stone-500/90">
            Birkaç mesaj daha gönder; ayna otomatik hazırlanır.
          </p>
        ) : null}

        {isError ? (
          <button type="button" onClick={onGenerate} className={primaryCtaClass}>
            <Sparkles className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
            {MIRROR_ERROR_RETRY}
          </button>
        ) : null}

        {showOnboarding ? (
          <p
            className={cn(
              'text-[10px] leading-snug tracking-wide',
              compact ? 'text-[rgba(217,196,163,0.55)]' : 'text-stone-400/95'
            )}
          >
            {MIRROR_CREATE_PRIVACY_NOTE}
          </p>
        ) : null}
      </div>
    </section>
  );
}
