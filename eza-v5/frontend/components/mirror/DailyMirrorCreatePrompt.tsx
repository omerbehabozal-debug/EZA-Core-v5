'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_CREATE_BUTTON,
  MIRROR_CREATE_DESCRIPTION,
  MIRROR_CREATE_GENERATING,
  MIRROR_CREATE_TITLE,
  MIRROR_INSUFFICIENT,
  MIRROR_PRIVACY_SHORT,
} from '@/lib/eza/mirror/copy';

export type DailyMirrorPromptVariant = 'idle' | 'generating' | 'insufficient';

export type DailyMirrorCreatePromptProps = {
  variant: DailyMirrorPromptVariant;
  onGenerate: () => void;
  className?: string;
};

export default function DailyMirrorCreatePrompt({
  variant,
  onGenerate,
  className,
}: DailyMirrorCreatePromptProps) {
  const isGenerating = variant === 'generating';
  const isInsufficient = variant === 'insufficient';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white via-white to-violet-50/25 px-6 py-10 text-center shadow-[0_16px_48px_-20px_rgba(99,102,241,0.2)] sm:px-10 sm:py-12',
        className
      )}
      aria-labelledby="daily-mirror-create-title"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-violet-100/50 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-md space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100/90 text-violet-700">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>

        <div className="space-y-2">
          <h2
            id="daily-mirror-create-title"
            className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl"
          >
            {isInsufficient ? 'Henüz erken' : MIRROR_CREATE_TITLE}
          </h2>
          <p className="text-sm leading-relaxed text-stone-600 sm:text-[15px]">
            {isInsufficient ? MIRROR_INSUFFICIENT : MIRROR_CREATE_DESCRIPTION}
          </p>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className={cn(
            'inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors',
            'hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500',
            'disabled:cursor-wait disabled:opacity-80'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {MIRROR_CREATE_GENERATING}
            </>
          ) : (
            MIRROR_CREATE_BUTTON
          )}
        </button>

        <p className="text-xs leading-relaxed text-stone-500">{MIRROR_PRIVACY_SHORT}</p>
      </div>
    </section>
  );
}
