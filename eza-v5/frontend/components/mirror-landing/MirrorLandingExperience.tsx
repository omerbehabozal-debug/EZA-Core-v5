'use client';

/**
 * Public /m consumer experience — Reel-first + Chat depth (Phase A–C).
 *
 * Depth: REEL_PREVIEW (default) | CHAT_REPLAY (?mode=chat).
 * Same exact artifact/scene/session; presentation depth only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MirrorYansiChainExperience from '@/components/mirror-landing/MirrorYansiChainExperience';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';
import { YansiExperienceSessionProvider } from '@/components/mirror-landing/YansiExperienceSession';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import type { MirrorLandingSurface } from '@/lib/eza/mirror-network/publicTypes';
import { trackLandingViewed } from '@/lib/eza/mirror-network/landingAnalytics';
import {
  fetchPublicFrozenJourneyArtifact,
  type PublicFrozenJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { cn } from '@/lib/utils';
import IdentityModal from '@/components/plan/IdentityModal';
import { useAuth } from '@/context/AuthContext';
import {
  consumePendingYansiSaveIntent,
} from '@/lib/eza/mirror-network/yansiSavePendingIntent';
import {
  hydrateYansiSaveStore,
  noteYansiSaveState,
} from '@/lib/eza/mirror-network/yansiSaveStore';
import { saveYansi } from '@/lib/eza/mirror-network/yansiSaveApi';
import {
  parsePinnedJourneyVersion,
  parseYansiPublicDepth,
  type YansiPublicDepth,
} from '@/lib/eza/mirror-network/yansiPublicDepth';

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
  const searchParams = useSearchParams();
  const urlDepth = useMemo(
    () => parseYansiPublicDepth(searchParams),
    [searchParams]
  );
  const [depth, setDepth] = useState<YansiPublicDepth>(urlDepth);
  const pinnedJourneyVersion = useMemo(
    () => parsePinnedJourneyVersion(searchParams),
    [searchParams]
  );

  useEffect(() => {
    setDepth(urlDepth);
  }, [urlDepth]);

  useEffect(() => {
    const onPop = () => {
      setDepth(parseYansiPublicDepth(window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleDepthChange = useCallback((next: YansiPublicDepth) => {
    setDepth(next);
  }, []);

  const [frozenState, setFrozenState] = useState<FrozenLoadState>({ status: 'loading' });
  const [identityOpen, setIdentityOpen] = useState(false);
  const isDesktop = useSainaCompactShell();
  const { isAuthenticated, isAuthReady } = useAuth();

  useEffect(() => {
    trackLandingViewed(surface.slug);
  }, [surface.slug]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      await hydrateYansiSaveStore();
      if (cancelled) return;
      const pending = consumePendingYansiSaveIntent();
      if (!pending) return;
      if (pending !== surface.slug.trim().toLowerCase()) return;
      const result = await saveYansi(pending);
      if (cancelled) return;
      if (result.ok) {
        noteYansiSaveState(result.slug, true);
        void hydrateYansiSaveStore();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isAuthenticated, surface.slug]);

  const openAuth = useCallback(() => setIdentityOpen(true), []);

  const loadFrozen = useCallback(async () => {
    setFrozenState({ status: 'loading' });
    try {
      const artifact = await fetchPublicFrozenJourneyArtifact({
        slug: surface.slug,
        journeyVersion: pinnedJourneyVersion,
      });
      if (!artifact) {
        setFrozenState({ status: 'unavailable' });
        void import('@/lib/eza/opsTelemetry').then(({ reportOpsFailure }) => {
          reportOpsFailure('frozen_replay_load_failed', 'FROZEN_ARTIFACT_INVALID');
        });
        return;
      }
      // Exact node pin: reject latest substitution when URL pins a version.
      if (
        pinnedJourneyVersion != null &&
        artifact.journeyVersion !== pinnedJourneyVersion
      ) {
        setFrozenState({ status: 'unavailable' });
        return;
      }
      setFrozenState({ status: 'ready', artifact });
    } catch {
      setFrozenState({ status: 'error' });
      void import('@/lib/eza/opsTelemetry').then(({ reportOpsFailure }) => {
        reportOpsFailure('frozen_replay_load_failed', 'FROZEN_ARTIFACT_INVALID');
      });
    }
  }, [surface.slug, pinnedJourneyVersion]);

  useEffect(() => {
    void loadFrozen();
  }, [loadFrozen]);

  return (
    <div
      className={cn(
        'relative mx-0 flex min-h-[100dvh] w-full max-w-none flex-col bg-[#090b0b] text-[#f4f0e8]',
        isDesktop && 'yansi-desktop-reel-root',
        className
      )}
      data-mirror-landing
      data-mirror-landing-slug={surface.slug}
      data-yansi-public-depth={depth}
      data-yansi-experience-mode={depth === 'chat' ? 'chat' : 'reel'}
      data-yansi-reel-presentation={isDesktop ? 'desktop-stage' : 'mobile-fullscreen'}
    >
      {frozenState.status === 'ready' ? (
        <YansiExperienceSessionProvider slug={frozenState.artifact.slug}>
          <MirrorYansiChainExperience
            rootArtifact={frozenState.artifact}
            depth={depth}
            onDepthChange={handleDepthChange}
            className="min-h-0 flex-1"
            onRequireAuth={openAuth}
          />
          {isDesktop && depth === 'chat' ? <YansiExperienceControls /> : null}
        </YansiExperienceSessionProvider>
      ) : frozenState.status === 'loading' ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
          data-testid="mirror-experience-loading"
        >
          <p className="text-sm text-[#a89880]">Deneyim hazırlanıyor…</p>
        </div>
      ) : frozenState.status === 'error' ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
          data-testid="mirror-experience-error"
        >
          <p className="text-sm text-[#c9bba8]">Deneyim yüklenemedi.</p>
          <button
            type="button"
            onClick={() => void loadFrozen()}
            className="rounded-full border border-white/15 px-6 py-3 text-sm text-[#e8dfd0]"
            data-testid="mirror-experience-retry"
          >
            Yeniden dene
          </button>
        </div>
      ) : (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
          data-testid="mirror-experience-unavailable"
        >
          <p className="text-sm text-[#c9bba8]">Bu Yansı şu an deneyimlenemiyor.</p>
        </div>
      )}
      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
    </div>
  );
}
