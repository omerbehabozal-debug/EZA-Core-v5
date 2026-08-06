'use client';

/**
 * Stage 2A — Mirror Landing Experience
 *
 * Mirror creates curiosity.
 * Landing preserves curiosity.
 * Conversation satisfies curiosity.
 */

import { useEffect } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import MirrorLandingCta from '@/components/mirror-landing/MirrorLandingCta';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';
import { MIRROR_V3_BRAND_SIGNATURE } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { MirrorLandingSurface } from '@/lib/eza/mirror-network/publicTypes';
import { trackLandingViewed } from '@/lib/eza/mirror-network/landingAnalytics';
import { cn } from '@/lib/utils';

export type MirrorLandingExperienceProps = {
  surface: MirrorLandingSurface;
  className?: string;
};

export default function MirrorLandingExperience({
  surface,
  className,
}: MirrorLandingExperienceProps) {
  useEffect(() => {
    trackLandingViewed(surface.slug);
  }, [surface.slug]);

  return (
    <div
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

      <div className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        <MirrorPublicCard
          title={surface.cardTitle}
          summary={surface.curiosityContext || surface.publicSummary}
          sceneImageUrl={surface.sceneImageUrl}
          slug={surface.slug}
          testIdPrefix="mirror-landing-card"
          className="mx-auto w-full max-w-md border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          footer={<MirrorLandingCta slug={surface.slug} />}
        />
      </div>
    </div>
  );
}
