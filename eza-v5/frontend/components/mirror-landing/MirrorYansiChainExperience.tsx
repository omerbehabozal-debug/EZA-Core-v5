'use client';

/**
 * Slice 3 + Slice 4 — public /m navigation.
 *
 * ↓ = next Discover product (or forward session history)
 * ↑ = previous visited product in THIS Discover session
 * → = next true continuation (same curiosity)
 * ← = previous true continuation
 *
 * Not /children lineage. Not parent_slug authority.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import YansiExperienceShareButton from '@/components/mirror-landing/YansiExperienceShareButton';
import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import { resolvePublicAuthorIdentity } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  YANSI_CONTINUATION_NEXT,
  YANSI_CONTINUATION_PREVIOUS,
  YANSI_DISCOVER_END_OF_POOL,
  YANSI_OWN_CONTINUATION_CTA,
  YANSI_PREVIOUS_MERAK,
  YANSI_SKIP_TO_NEXT_MERAK,
} from '@/lib/eza/mirror/copy';
import {
  shouldRecordYansiSkip,
  trackYansiExperienceSkipped,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import { loadFrozenReplayProgress } from '@/lib/eza/mirror/journey/frozenReplaySession';
import {
  activeDiscoverSlug,
  canDiscoverGoDownInHistory,
  canDiscoverGoUp,
  createYansiDiscoverySession,
  discoverAppendAndActivate,
  discoverExcludeSet,
  discoverGoDownInHistory,
  discoverGoUp,
  discoverMarkPoolExhausted,
  discoverReplaceActiveAndTruncate,
  discoverWithNextOffset,
  needsDiscoverFetchForDown,
  type YansiDiscoverySession,
} from '@/lib/eza/mirror/journey/yansiDiscoverySession';
import { fetchNextDiscoverCandidate } from '@/lib/eza/mirror/journey/fetchNextDiscoverCandidate';
import {
  fetchContinuationNeighbors,
  type PublicContinuationNeighbor,
} from '@/lib/eza/mirror-network/fetchContinuationNeighbors';
import { cn } from '@/lib/utils';
import YansiPublicMetricsLine from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';

export type MirrorYansiChainExperienceProps = {
  rootArtifact: PublicFrozenJourneyArtifact;
  className?: string;
};

type ReplayNodeProgress = {
  completedStepCount: number;
  replayCompleted: boolean;
  selectedCount: number;
  journeyVersion: number;
};

type ExperienceNode = {
  artifact: PublicFrozenJourneyArtifact;
  authorDisplayName: string;
  authorHonorific: string;
  authorAvatarUrl: string | null;
  authorAvatarRevision: number | null;
  parentAuthorDisplayName: string | null;
  parentPublicTitle: string | null;
};

async function enrichNode(
  artifact: PublicFrozenJourneyArtifact
): Promise<ExperienceNode> {
  const author = await resolvePublicAuthorIdentity(artifact.authorUserId);
  let parentAuthorDisplayName: string | null = null;
  let parentPublicTitle: string | null = null;
  if (artifact.parentSlug) {
    const parent = await fetchPublicFrozenJourneyArtifact({ slug: artifact.parentSlug });
    if (parent) {
      parentPublicTitle = parent.publicTitle || null;
      const parentAuthor = await resolvePublicAuthorIdentity(parent.authorUserId);
      parentAuthorDisplayName = parentAuthor.displayName;
    }
  }
  return {
    artifact,
    authorDisplayName: author.displayName,
    authorHonorific: author.publicHonorific,
    authorAvatarUrl: author.publicAvatarUrl?.trim() || null,
    authorAvatarRevision:
      typeof author.publicAvatarRevision === 'number' ? author.publicAvatarRevision : null,
    parentAuthorDisplayName,
    parentPublicTitle,
  };
}

function preloadSceneImage(url: string | null | undefined): void {
  const src = (url || '').trim();
  if (!src || typeof window === 'undefined') return;
  try {
    const img = new window.Image();
    img.src = src;
  } catch {
    /* ignore */
  }
}

function publicPathForSlug(slug: string): string {
  return `/m/${encodeURIComponent(slug)}`;
}

export default function MirrorYansiChainExperience({
  rootArtifact,
  className,
}: MirrorYansiChainExperienceProps) {
  const router = useRouter();
  const entrySlug = rootArtifact.slug.trim().toLowerCase();
  const [session, setSession] = useState<YansiDiscoverySession | null>(() =>
    createYansiDiscoverySession(entrySlug)
  );
  const [nodesBySlug, setNodesBySlug] = useState<Record<string, ExperienceNode>>({});
  const [bootstrapped, setBootstrapped] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const [poolEndVisible, setPoolEndVisible] = useState(false);
  const [continuationPrevious, setContinuationPrevious] =
    useState<PublicContinuationNeighbor | null>(null);
  const [continuationNext, setContinuationNext] =
    useState<PublicContinuationNeighbor | null>(null);
  const [replayProgress, setReplayProgress] = useState<Record<string, ReplayNodeProgress>>(
    {}
  );
  const previousActiveSlugRef = useRef(entrySlug);
  const skipFiredRef = useRef<Set<string>>(new Set());
  const navInFlightRef = useRef(false);
  const neighborsRequestIdRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const replayProgressRef = useRef(replayProgress);
  replayProgressRef.current = replayProgress;
  const nodesBySlugRef = useRef(nodesBySlug);
  nodesBySlugRef.current = nodesBySlug;

  const activeSlug = session ? activeDiscoverSlug(session) : entrySlug;
  const activeNode = nodesBySlug[activeSlug] ?? null;

  // Bootstrap entry artifact into the node map.
  useEffect(() => {
    let cancelled = false;
    void enrichNode(rootArtifact).then((node) => {
      if (cancelled) return;
      setNodesBySlug((prev) => ({
        ...prev,
        [node.artifact.slug.trim().toLowerCase()]: node,
      }));
      setBootstrapped(true);
    });
    return () => {
      cancelled = true;
    };
  }, [rootArtifact]);

  /**
   * Keep browser URL aligned with the active product without stacking a competing
   * history model. Discovery session owns ↑/↓; replace avoids Back fighting the stack.
   */
  useEffect(() => {
    if (!activeSlug || typeof window === 'undefined') return;
    const desired = publicPathForSlug(activeSlug);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === desired || window.location.pathname === desired) return;
    router.replace(desired);
  }, [activeSlug, router]);

  useEffect(() => {
    const fromSlug = previousActiveSlugRef.current;
    if (fromSlug === activeSlug) return;
    const toSlug = activeSlug;
    const timer = window.setTimeout(() => {
      previousActiveSlugRef.current = toSlug;
      const fromNode = nodesBySlugRef.current[fromSlug];
      const live = replayProgressRef.current[fromSlug];
      const stored = fromNode
        ? loadFrozenReplayProgress(fromNode.artifact.slug, fromNode.artifact.journeyVersion)
        : null;
      const fromProgress =
        live ??
        (stored
          ? {
              completedStepCount: stored.completedStepCount,
              replayCompleted: stored.replayCompleted,
              selectedCount:
                fromNode?.artifact.selectedCount ?? fromNode?.artifact.steps.length ?? 0,
              journeyVersion: fromNode?.artifact.journeyVersion ?? 1,
            }
          : null);
      if (
        !shouldRecordYansiSkip({
          fromSlug,
          toSlug,
          fromProgress,
        })
      ) {
        return;
      }
      const skipKey = `${fromSlug}:${fromProgress?.journeyVersion ?? 1}:${fromProgress?.completedStepCount ?? 0}:${toSlug}`;
      if (skipFiredRef.current.has(skipKey)) return;
      skipFiredRef.current.add(skipKey);
      trackYansiExperienceSkipped({
        slug: fromSlug,
        journeyVersion: fromProgress?.journeyVersion ?? 1,
        completedStepCount: fromProgress?.completedStepCount ?? 0,
        selectedCount: fromProgress?.selectedCount ?? 0,
        destinationSlug: toSlug,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeSlug]);

  // Load continuation neighbors for the active product (slug-scoped; ignore stale).
  useEffect(() => {
    if (!activeSlug) return;
    const requestId = ++neighborsRequestIdRef.current;
    setContinuationPrevious(null);
    setContinuationNext(null);
    let cancelled = false;
    void fetchContinuationNeighbors(activeSlug)
      .then((result) => {
        if (cancelled || requestId !== neighborsRequestIdRef.current) return;
        if (!result.ok) return;
        if (result.data.slug !== activeSlug) return;
        setContinuationPrevious(result.data.previous);
        setContinuationNext(result.data.next);
      })
      .catch(() => {
        /* keep current product; no fake neighbors */
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  const ensureArtifactLoaded = useCallback(async (slug: string): Promise<ExperienceNode | null> => {
    const key = slug.trim().toLowerCase();
    const existing = nodesBySlugRef.current[key];
    if (existing) return existing;
    const artifact = await fetchPublicFrozenJourneyArtifact({ slug: key });
    if (!artifact) return null;
    preloadSceneImage(artifact.sceneImageUrl);
    const node = await enrichNode(artifact);
    setNodesBySlug((prev) => ({ ...prev, [key]: node }));
    return node;
  }, []);

  const handleReplayProgress = useCallback(
    (notice: {
      slug: string;
      journeyVersion: number;
      completedStepCount: number;
      replayCompleted: boolean;
      selectedCount: number;
    }) => {
      setReplayProgress((prev) => ({
        ...prev,
        [notice.slug]: {
          completedStepCount: notice.completedStepCount,
          replayCompleted: notice.replayCompleted,
          selectedCount: notice.selectedCount,
          journeyVersion: notice.journeyVersion,
        },
      }));
    },
    []
  );

  const goUp = useCallback(() => {
    const current = sessionRef.current;
    if (!current || navInFlightRef.current) return;
    const next = discoverGoUp(current);
    if (!next) return;
    setPoolEndVisible(false);
    setSession(next);
  }, []);

  const goDown = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || navInFlightRef.current) return;

    if (canDiscoverGoDownInHistory(current)) {
      const next = discoverGoDownInHistory(current);
      if (!next) return;
      setPoolEndVisible(false);
      setSession(next);
      return;
    }

    if (!needsDiscoverFetchForDown(current)) {
      setPoolEndVisible(true);
      return;
    }

    navInFlightRef.current = true;
    setNavBusy(true);
    try {
      const result = await fetchNextDiscoverCandidate({
        excludeSlugs: discoverExcludeSet(current),
        randomSession: current.randomSession,
        offset: current.nextOffset,
      });

      // Session may have changed while awaiting — only append if still at newest end.
      const live = sessionRef.current;
      if (!live || activeDiscoverSlug(live) !== activeDiscoverSlug(current)) {
        return;
      }
      if (canDiscoverGoDownInHistory(live)) {
        const hist = discoverGoDownInHistory(live);
        if (hist) setSession(hist);
        return;
      }

      if (!result.ok) {
        let nextSession = discoverWithNextOffset(live, result.nextOffset);
        if (result.randomSession) {
          nextSession = { ...nextSession, randomSession: result.randomSession };
        }
        if (result.exhausted) {
          nextSession = discoverMarkPoolExhausted(nextSession);
          setPoolEndVisible(true);
        }
        setSession(nextSession);
        return;
      }

      const loaded = await ensureArtifactLoaded(result.slug);
      if (!loaded) {
        // Candidate slug not replayable — advance offset and stay put.
        setSession(
          discoverWithNextOffset(
            { ...live, randomSession: result.randomSession || live.randomSession },
            result.nextOffset + 1
          )
        );
        return;
      }

      let nextSession = discoverWithNextOffset(live, result.nextOffset);
      if (result.randomSession) {
        nextSession = { ...nextSession, randomSession: result.randomSession };
      }
      const appended = discoverAppendAndActivate(nextSession, result.slug);
      if (!appended) return;
      setPoolEndVisible(false);
      setSession(appended);
    } finally {
      navInFlightRef.current = false;
      setNavBusy(false);
    }
  }, [ensureArtifactLoaded]);

  const goHorizontal = useCallback(
    async (direction: 'previous' | 'next') => {
      const current = sessionRef.current;
      if (!current || navInFlightRef.current) return;
      const target =
        direction === 'next' ? continuationNext : continuationPrevious;
      if (!target?.slug) return;
      const fromSlug = activeDiscoverSlug(current);
      navInFlightRef.current = true;
      setNavBusy(true);
      try {
        const loaded = await ensureArtifactLoaded(target.slug);
        const live = sessionRef.current;
        if (!live || activeDiscoverSlug(live) !== fromSlug) return;
        if (!loaded) return;
        const replaced = discoverReplaceActiveAndTruncate(live, target.slug);
        if (!replaced) return;
        setPoolEndVisible(false);
        setSession(replaced);
      } finally {
        navInFlightRef.current = false;
        setNavBusy(false);
      }
    },
    [continuationNext, continuationPrevious, ensureArtifactLoaded]
  );

  if (!bootstrapped || !session || !activeNode) {
    return (
      <div
        className="py-10 text-center text-xs text-[#a89880]"
        data-testid="mirror-yansi-chain-loading"
      >
        Deneyim hazırlanıyor…
      </div>
    );
  }

  const title = activeNode.artifact.publicTitle || 'Yansı';
  const summary = activeNode.artifact.publicSummary;
  const showUp = canDiscoverGoUp(session);
  const showDown =
    canDiscoverGoDownInHistory(session) || needsDiscoverFetchForDown(session);

  return (
    <div
      className={cn('relative flex min-h-0 w-full flex-1 flex-col', className)}
      data-testid="mirror-yansi-chain"
      data-active-slug={activeSlug}
      data-discovery-index={session.activeIndex}
      data-discovery-length={session.history.length}
    >
      <MirrorYansiSceneCrossfade sceneImageUrl={activeNode.artifact.sceneImageUrl} />

      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-0 pb-8"
        data-testid="mirror-yansi-chain-scroll"
      >
        <YansiExposureRoot
          slug={activeNode.artifact.slug}
          journeyVersion={activeNode.artifact.journeyVersion}
          context="chain"
        >
          <section
            data-yansi-slug={activeNode.artifact.slug}
            data-yansi-active="true"
            data-testid={`mirror-yansi-section-${activeNode.artifact.slug}`}
            className="flex min-h-[70dvh] flex-col scroll-mt-4"
          >
            <header className="mb-4 space-y-2 saina-content-crossfade">
              <h2
                className="text-xl font-semibold tracking-tight text-[#f5ead8] transition-opacity duration-500"
                data-testid="mirror-yansi-active-title"
                data-slug={activeNode.artifact.slug}
              >
                {title}
              </h2>
              {summary ? (
                <p className="text-sm leading-relaxed text-[#c9bba8]">{summary}</p>
              ) : null}
              <div className="yansi-identity-header">
                <AynaAuthorRow
                  displayName={activeNode.authorDisplayName}
                  authorUserId={activeNode.artifact.authorUserId}
                  publicAvatarUrl={activeNode.authorAvatarUrl}
                  publicAvatarRevision={activeNode.authorAvatarRevision}
                  honorific={activeNode.authorHonorific}
                  onOpenProfile={() =>
                    router.push(authorProfilePath(activeNode.artifact.authorUserId))
                  }
                />
                <YansiExperienceShareButton slug={activeNode.artifact.slug} />
              </div>
              {activeNode.artifact.parentSlug ? (
                <AynaParentLineageRow
                  parentAuthorDisplayName={activeNode.parentAuthorDisplayName}
                  parentPublicTitle={activeNode.parentPublicTitle}
                  onOpenParent={() =>
                    router.push(publicPathForSlug(activeNode.artifact.parentSlug!))
                  }
                />
              ) : null}
              <YansiPublicMetricsLine
                slug={activeNode.artifact.slug}
                journeyVersion={activeNode.artifact.journeyVersion}
                variant="section"
              />
            </header>

            <MirrorFrozenReplay
              key={`${activeNode.artifact.slug}:${activeNode.artifact.journeyVersion}`}
              artifact={activeNode.artifact}
              className="min-h-0 flex-1"
              continueLabel={YANSI_OWN_CONTINUATION_CTA}
              chainEmbedded
              onReplayProgress={handleReplayProgress}
            />

            <div
              className="mt-4 flex flex-col items-center gap-2"
              data-testid="mirror-discover-nav"
            >
              <div
                className="flex w-full max-w-md items-center justify-between gap-3"
                data-testid="mirror-continuation-nav"
              >
                {continuationPrevious ? (
                  <button
                    type="button"
                    className="px-2 py-1 text-left text-[11px] font-medium tracking-wide text-[#a89880] underline-offset-4 hover:text-[#c9bba8] hover:underline disabled:opacity-40"
                    onClick={() => void goHorizontal('previous')}
                    disabled={navBusy}
                    data-testid="mirror-continuation-prev"
                  >
                    {YANSI_CONTINUATION_PREVIOUS}
                  </button>
                ) : (
                  <span className="px-2 py-1 text-[11px] opacity-0" aria-hidden>
                    .
                  </span>
                )}
                {continuationNext ? (
                  <button
                    type="button"
                    className="px-2 py-1 text-right text-[11px] font-medium tracking-wide text-[#a89880] underline-offset-4 hover:text-[#c9bba8] hover:underline disabled:opacity-40"
                    onClick={() => void goHorizontal('next')}
                    disabled={navBusy}
                    data-testid="mirror-continuation-next"
                  >
                    {YANSI_CONTINUATION_NEXT}
                  </button>
                ) : (
                  <span className="px-2 py-1 text-[11px] opacity-0" aria-hidden>
                    .
                  </span>
                )}
              </div>

              {showUp ? (
                <button
                  type="button"
                  className="px-2 py-1 text-center text-[11px] font-medium tracking-wide text-[#a89880] underline-offset-4 hover:text-[#c9bba8] hover:underline disabled:opacity-40"
                  onClick={goUp}
                  disabled={navBusy}
                  data-testid="mirror-discover-up"
                >
                  {YANSI_PREVIOUS_MERAK}
                </button>
              ) : null}

              {showDown ? (
                <button
                  type="button"
                  className="px-2 py-1 text-center text-[11px] font-medium tracking-wide text-[#a89880] underline-offset-4 hover:text-[#c9bba8] hover:underline disabled:opacity-40"
                  onClick={() => void goDown()}
                  disabled={navBusy}
                  data-testid="mirror-skip-to-next"
                >
                  {YANSI_SKIP_TO_NEXT_MERAK}
                </button>
              ) : null}

              {poolEndVisible || session.poolExhausted ? (
                <p
                  className="text-center text-[11px] text-[#a89880]"
                  data-testid="mirror-discover-pool-end"
                >
                  {YANSI_DISCOVER_END_OF_POOL}
                </p>
              ) : null}
            </div>
          </section>
        </YansiExposureRoot>
      </div>
    </div>
  );
}
