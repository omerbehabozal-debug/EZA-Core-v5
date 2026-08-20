'use client';

/**
 * Stage 2A / Phase 5.0–5.1 — Mirror Landing Experience
 *
 * Progressive frozen replay + continuous published-child scroll.
 * Own continuation uses existing /sohbet path from the active Yansı.
 */

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';
import { MIRROR_V3_BRAND_SIGNATURE } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { MirrorLandingSurface } from '@/lib/eza/mirror-network/publicTypes';
import { trackLandingViewed } from '@/lib/eza/mirror-network/landingAnalytics';
import {
  fetchPublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { cn } from '@/lib/utils';
import YansiPublicMetricsLine from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import YansiTrustActions from '@/components/mirror-landing/YansiTrustActions';

export type MirrorLandingExperienceProps = {
  surface: MirrorLandingSurface;
  className?: string;
};

type FrozenLoadState =
  | { status: 'loading' }
  | { status: 'ready'; artifact: PublicFrozenJourneyArtifact }
  | { status: 'unavailable' }
  | { status: 'error' };

export default function MirrorLandingExperience({
  surface,
  className,
}: MirrorLandingExperienceProps) {
  const [frozenState, setFrozenState] = useState<FrozenLoadState>({ status: 'loading' });
  const [replayStarted, setReplayStarted] = useState(false);

  useEffect(() => {
    trackLandingViewed(surface.slug);
  }, [surface.slug]);

  const loadFrozen = useCallback(async () => {
    setFrozenState({ status: 'loading' });
    try {
      const artifact = await fetchPublicFrozenJourneyArtifact({ slug: surface.slug });
      if (!artifact) {
        setFrozenState({ status: 'unavailable' });
        return;
      }
      setFrozenState({ status: 'ready', artifact });
    } catch {
      setFrozenState({ status: 'error' });
    }
  }, [surface.slug]);

  useEffect(() => {
    void loadFrozen();
  }, [loadFrozen]);

  const handleStartExperience = () => {
    if (frozenState.status !== 'ready') return;
    // Landing CTA only opens the replay container. STARTED fires on first
    // frozen-question engagement inside MirrorFrozenReplay.
    setReplayStarted(true);
  };

  const title =
    frozenState.status === 'ready'
      ? frozenState.artifact.publicTitle || surface.cardTitle
      : surface.cardTitle;
  const summary =
    frozenState.status === 'ready'
      ? frozenState.artifact.publicSummary ||
        surface.curiosityContext ||
        surface.publicSummary
      : surface.curiosityContext || surface.publicSummary;
  const sceneImageUrl =
    frozenState.status === 'ready'
      ? frozenState.artifact.sceneImageUrl || surface.sceneImageUrl
      : surface.sceneImageUrl;

  return (
    <div
      className={cn(
        'relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[#0c0b0a] text-[#f4f0e8]',
        className
      )}
      data-mirror-landing
      data-mirror-landing-slug={surface.slug}
      data-replay-started={replayStarted ? 'true' : 'false'}
    >
      <header className="relative z-[2] flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[#c9bba8]">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          {MIRROR_V3_BRAND_SIGNATURE.line1}
        </p>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-[#e8dfd0] backdrop-blur-sm">
          <Calendar className="mr-1 h-3 w-3 opacity-80" strokeWidth={1.5} aria-hidden />
          {surface.dayLabel}
        </span>
      </header>

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        {!replayStarted ? (
          <YansiExposureRoot
            slug={surface.slug}
            journeyVersion={
              frozenState.status === 'ready'
                ? frozenState.artifact.journeyVersion
                : null
            }
            context="landing"
          >
          <MirrorPublicCard
            title={title}
            summary={summary}
            sceneImageUrl={sceneImageUrl}
            slug={surface.slug}
            testIdPrefix="mirror-landing-card"
            className="mx-auto w-full max-w-md border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            meta={
              frozenState.status === 'ready' ? (
                <YansiPublicMetricsLine
                  slug={frozenState.artifact.slug}
                  journeyVersion={frozenState.artifact.journeyVersion}
                  variant="card"
                />
              ) : null
            }
            footer={
              frozenState.status === 'ready' ? (
                <div className="mt-auto space-y-3 pt-10">
                  <button
                    type="button"
                    onClick={handleStartExperience}
                    className="flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/40 bg-[#e8d5b5]/15 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/25"
                    data-testid="mirror-experience-start"
                  >
                    Bu merakı deneyimle
                  </button>
                  <YansiTrustActions
                    slug={surface.slug}
                    authorUserId={frozenState.artifact.authorUserId}
                    className="pt-1"
                  />
                </div>
              ) : frozenState.status === 'loading' ? (
                <div className="mt-auto pt-10 text-center text-xs text-[#a89880]">
                  Deneyim hazırlanıyor…
                </div>
              ) : frozenState.status === 'error' ? (
                <div className="mt-auto space-y-3 pt-10">
                  <p className="text-center text-xs text-[#a89880]">
                    Deneyim yüklenemedi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadFrozen()}
                    className="flex w-full items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm text-[#e8dfd0]"
                    data-testid="mirror-experience-retry"
                  >
                    Yeniden dene
                  </button>
                </div>
              ) : (
                <p
                  className="mt-auto pt-10 text-center text-xs text-[#a89880]"
                  data-testid="mirror-experience-unavailable-inline"
                >
                  Bu Yansı şu an deneyimlenemiyor.
                </p>
              )
            }
          />
          </YansiExposureRoot>
        ) : frozenState.status === 'ready' ? (
          <MirrorYansiChainExperience
            rootArtifact={frozenState.artifact}
            className="min-h-0 flex-1"
          />
        ) : (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
            data-testid="mirror-experience-unavailable"
          >
            <p className="text-sm text-[#c9bba8]">Bu Yansı şu an deneyimlenemiyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
