'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_CREATE_BUTTON,
  MIRROR_CREATE_PRIVACY_NOTE,
  MIRROR_INSUFFICIENT_ACTION,
  MIRROR_INSUFFICIENT_BODY,
  MIRROR_INSUFFICIENT_TITLE,
  MIRROR_ONBOARDING_SUBTITLE,
  MIRROR_ONBOARDING_TITLE,
  MIRROR_STANDALONE_ROUTE,
} from '@/lib/eza/mirror/copy';
import MirrorOnboardingPreview from '@/components/mirror/MirrorOnboardingPreview';

export type DailyMirrorPromptVariant = 'idle' | 'insufficient';

export type DailyMirrorCreatePromptProps = {
  variant: DailyMirrorPromptVariant;
  onGenerate: () => void;
  className?: string;
};

const primaryCtaClass = cn(
  'inline-flex w-full max-w-[17rem] items-center justify-center gap-2 rounded-full',
  'bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600',
  'px-6 py-3 text-sm font-semibold tracking-tight text-white',
  'shadow-[0_10px_36px_-10px_rgba(99,102,241,0.72)]',
  'ring-2 ring-violet-300/35',
  'transition-all duration-200',
  'hover:from-violet-500 hover:via-violet-500 hover:to-indigo-500 hover:shadow-[0_12px_40px_-8px_rgba(99,102,241,0.8)]',
  'active:scale-[0.98] motion-reduce:active:scale-100',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400'
);

export default function DailyMirrorCreatePrompt({
  variant,
  onGenerate,
  className,
}: DailyMirrorCreatePromptProps) {
  const isInsufficient = variant === 'insufficient';

  return (
    <section
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-2 text-center sm:px-6 sm:py-3',
        className
      )}
      aria-labelledby="daily-mirror-create-title"
    >
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-2.5 overflow-visible sm:gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100/70 text-violet-600/90 shadow-[0_0_18px_-6px_rgba(139,92,246,0.35)]"
          aria-hidden
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>

        <div className="space-y-1">
          <h2
            id="daily-mirror-create-title"
            className="text-[1.15rem] font-semibold leading-tight tracking-[-0.03em] text-stone-900 sm:text-[1.3rem]"
          >
            {isInsufficient ? MIRROR_INSUFFICIENT_TITLE : MIRROR_ONBOARDING_TITLE}
          </h2>
          <p className="mx-auto max-w-[19rem] text-[12px] leading-snug text-stone-500/95 sm:text-[13px]">
            {isInsufficient ? MIRROR_INSUFFICIENT_BODY : MIRROR_ONBOARDING_SUBTITLE}
          </p>
        </div>

        {!isInsufficient ? (
          <button type="button" onClick={onGenerate} className={primaryCtaClass}>
            <Sparkles className="h-4 w-4 opacity-90" strokeWidth={2} aria-hidden />
            {MIRROR_CREATE_BUTTON}
          </button>
        ) : null}

        {!isInsufficient ? <MirrorOnboardingPreview className="w-full" /> : null}

        {isInsufficient ? (
          <Link href={MIRROR_STANDALONE_ROUTE} className={cn(primaryCtaClass, 'no-underline')}>
            {MIRROR_INSUFFICIENT_ACTION}
          </Link>
        ) : null}

        {!isInsufficient ? (
          <p className="text-[10px] leading-snug tracking-wide text-stone-400/95">
            {MIRROR_CREATE_PRIVACY_NOTE}
          </p>
        ) : null}
      </div>
    </section>
  );
}
