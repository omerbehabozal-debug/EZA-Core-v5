'use client';

/**
 * Stage 2A — Mirror Landing Experience
 *
 * Mirror creates curiosity.
 * Landing preserves curiosity.
 * Conversation satisfies curiosity.
 *
 * Renders only: mirror image, title, curiosityContext, date, single CTA (placeholder).
 * No hooks, seedQuestions, tags, coreCuriosity, or discovery metadata.
 */

import { Calendar, Sparkles } from 'lucide-react';
import { MIRROR_V3_BRAND_SIGNATURE } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { MirrorLandingSurface } from '@/lib/eza/mirror-network/publicTypes';
import { cn } from '@/lib/utils';

export type MirrorLandingExperienceProps = {
  surface: MirrorLandingSurface;
  className?: string;
};

export default function MirrorLandingExperience({
  surface,
  className,
}: MirrorLandingExperienceProps) {
  const hasImage = Boolean(surface.sceneImageUrl);

  return (
    <article
      className={cn(
        'mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[#0c0b0a] text-[#f4f0e8]',
        className
      )}
      data-mirror-landing
      data-mirror-landing-slug={surface.slug}
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9bba8]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          {MIRROR_V3_BRAND_SIGNATURE.line1}
        </p>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-[#e8dfd0] backdrop-blur-sm">
          <Calendar className="mr-1 h-3 w-3 opacity-80" strokeWidth={1.5} aria-hidden />
          {surface.dayLabel}
        </span>
      </header>

      <div className="relative mx-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141210] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[4/5] w-full">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- scene URL is dynamic per mirror node
            <img
              src={surface.sceneImageUrl!}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#2a2520] via-[#1a1714] to-[#0f0e0c]"
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c0b0a]/80 via-transparent to-transparent"
            aria-hidden
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        <h1 className="text-balance font-serif text-[2rem] font-medium leading-[1.12] tracking-[-0.02em] text-[#faf6ee]">
          {surface.cardTitle}
        </h1>

        {surface.curiosityContext ? (
          <p className="mt-5 text-pretty text-[15px] leading-[1.7] text-[#c8bfb0]">
            {surface.curiosityContext}
          </p>
        ) : null}

        <div className="mt-auto pt-10">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full rounded-full border border-[#e8d5b5]/25 bg-[#e8d5b5]/10 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] opacity-70"
          >
            Bu konudan devam et
          </button>
          <p className="mt-2 text-center text-[11px] text-[#8a8074]">Yakında</p>
        </div>
      </div>
    </article>
  );
}
