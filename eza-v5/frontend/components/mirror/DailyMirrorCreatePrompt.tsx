'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_CREATE_BUTTON,
  MIRROR_CREATE_DESCRIPTION,
  MIRROR_CREATE_PRIVACY_NOTE,
  MIRROR_CREATE_TITLE,
  MIRROR_INSUFFICIENT_ACTION,
  MIRROR_INSUFFICIENT_BODY,
  MIRROR_INSUFFICIENT_TITLE,
  MIRROR_STANDALONE_ROUTE,
} from '@/lib/eza/mirror/copy';

export type DailyMirrorPromptVariant = 'idle' | 'insufficient';

export type DailyMirrorCreatePromptProps = {
  variant: DailyMirrorPromptVariant;
  onGenerate: () => void;
  className?: string;
};

const ms = standaloneSkin.mirrorSurface;

export default function DailyMirrorCreatePrompt({
  variant,
  onGenerate,
  className,
}: DailyMirrorCreatePromptProps) {
  const isInsufficient = variant === 'insufficient';

  return (
    <section
      className={cn(ms.idleRoot, className)}
      aria-labelledby="daily-mirror-create-title"
    >
      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center gap-7">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100/70 text-violet-600/90 shadow-[0_0_28px_-6px_rgba(139,92,246,0.35)]"
          aria-hidden
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <div className="space-y-2.5">
          <h2
            id="daily-mirror-create-title"
            className="text-[1.35rem] font-semibold tracking-[-0.03em] text-stone-900 sm:text-2xl"
          >
            {isInsufficient ? MIRROR_INSUFFICIENT_TITLE : MIRROR_CREATE_TITLE}
          </h2>
          <p className="text-sm leading-relaxed text-stone-500/95 sm:text-[15px]">
            {isInsufficient ? MIRROR_INSUFFICIENT_BODY : MIRROR_CREATE_DESCRIPTION}
          </p>
        </div>

        {isInsufficient ? (
          <Link
            href={MIRROR_STANDALONE_ROUTE}
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-stone-900 px-7 py-2.5 text-sm font-medium text-white transition-colors',
              'hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400'
            )}
          >
            {MIRROR_INSUFFICIENT_ACTION}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-stone-900 px-8 py-3 text-sm font-medium text-white transition-colors',
              'hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400'
            )}
          >
            {MIRROR_CREATE_BUTTON}
          </button>
        )}

        {!isInsufficient ? (
          <p className="text-[11px] tracking-wide text-stone-400/95">
            {MIRROR_CREATE_PRIVACY_NOTE}
          </p>
        ) : null}
      </div>
    </section>
  );
}
