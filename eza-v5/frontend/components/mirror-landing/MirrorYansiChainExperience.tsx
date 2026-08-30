'use client';

/**
 * Phase 5.1 / 5.1.1 / 5.1.2 — continuous vertical Yansı chain after progressive replay.
 * Scroll down → published child (completion not required). CTA → own continuation from ACTIVE slug.
 * Completing or entering A may preload B below — never auto-scroll or auto-activate B.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import MirrorAlternateChildrenSheet from '@/components/mirror-landing/MirrorAlternateChildrenSheet';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import YansiExperienceShareButton from '@/components/mirror-landing/YansiExperienceShareButton';
import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  loadChildContinuationPlan,
  type EligibleChildContinuation,
} from '@/lib/eza/mirror/journey/yansiChildContinuation';
import { resolvePublicAuthorIdentity } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { YANSI_OWN_CONTINUATION_CTA, YANSI_SKIP_TO_NEXT_MERAK } from '@/lib/eza/mirror/copy';
import {
  shouldRecordYansiSkip,
  trackYansiExperienceSkipped,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import { loadFrozenReplayProgress } from '@/lib/eza/mirror/journey/frozenReplaySession';
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

type ChainNode = {
  artifact: PublicFrozenJourneyArtifact;
  authorDisplayName: string;
  authorHonorific: string;
  authorAvatarUrl: string | null;
  authorAvatarRevision: number | null;
  parentAuthorDisplayName: string | null;
  parentPublicTitle: string | null;
  alternatives: EligibleChildContinuation[];
  childrenLoaded: boolean;
  /** Eligible frozen continuation count from /children (replay-ready set). */
  eligibleChildCount: number;
};

async function enrichNode(
  artifact: PublicFrozenJourneyArtifact,
  alternatives: EligibleChildContinuation[] = []
): Promise<ChainNode> {
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
    alternatives,
    childrenLoaded: false,
    eligibleChildCount: 0,
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

export default function MirrorYansiChainExperience({
  rootArtifact,
  className,
}: MirrorYansiChainExperienceProps) {
  const router = useRouter();
  const [nodes, setNodes] = useState<ChainNode[]>([]);
  const [activeSlug, setActiveSlug] = useState(rootArtifact.slug);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAlts, setSheetAlts] = useState<EligibleChildContinuation[]>([]);
  const [replayProgress, setReplayProgress] = useState<Record<string, ReplayNodeProgress>>(
    {}
  );
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadingChildrenRef = useRef<Set<string>>(new Set());
  const childrenResolvedRef = useRef<Set<string>>(new Set());
  const pendingScrollSlugRef = useRef<string | null>(null);
  const previousActiveSlugRef = useRef(rootArtifact.slug);
  const skipFiredRef = useRef<Set<string>>(new Set());
  const replayProgressRef = useRef(replayProgress);
  replayProgressRef.current = replayProgress;

  useEffect(() => {
    let cancelled = false;
    void enrichNode(rootArtifact).then((node) => {
      if (cancelled) return;
      setNodes((prev) => {
        if (prev.some((n) => n.artifact.slug === node.artifact.slug)) return prev;
        return [node, ...prev];
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rootArtifact]);

  const activeNode =
    nodes.find((n) => n.artifact.slug === activeSlug) ?? nodes[0] ?? null;

  useEffect(() => {
    if (!nodes.length) return;
    const root = scrollRootRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        const slug = top?.target.getAttribute('data-yansi-slug');
        if (slug) setActiveSlug(slug);
      },
      { root: root ?? null, threshold: [0.35, 0.55, 0.7] }
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [nodes]);

  useEffect(() => {
    const slug = pendingScrollSlugRef.current;
    if (!slug) return;
    const el = sectionRefs.current.get(slug);
    if (!el) return;
    pendingScrollSlugRef.current = null;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [nodes, activeSlug]);

  /** Preload below viewport — does NOT activate or scroll. */
  const prepareChildBelow = useCallback(async (child: EligibleChildContinuation) => {
    preloadSceneImage(child.artifact.sceneImageUrl);
    const node = await enrichNode(child.artifact, []);
    setNodes((prev) => {
      if (prev.some((n) => n.artifact.slug === child.artifact.slug)) return prev;
      return [...prev, node];
    });
  }, []);

  /** Explicit alternate-path choice — user-controlled activation. */
  const activateChosenChild = useCallback(async (child: EligibleChildContinuation) => {
    preloadSceneImage(child.artifact.sceneImageUrl);
    const node = await enrichNode(child.artifact, []);
    pendingScrollSlugRef.current = child.artifact.slug;
    setNodes((prev) => {
      if (prev.some((n) => n.artifact.slug === child.artifact.slug)) return prev;
      return [...prev, node];
    });
    setActiveSlug(child.artifact.slug);
  }, []);

  const ensureChildrenLoaded = useCallback(
    async (slug: string) => {
      if (!slug || loadingChildrenRef.current.has(slug) || childrenResolvedRef.current.has(slug)) {
        return;
      }
      loadingChildrenRef.current.add(slug);
      try {
        const plan = await loadChildContinuationPlan(slug);
        childrenResolvedRef.current.add(slug);
        setNodes((prev) =>
          prev.map((n) =>
            n.artifact.slug === slug
              ? {
                  ...n,
                  childrenLoaded: true,
                  alternatives: plan.alternatives,
                  eligibleChildCount: plan.eligibleCount,
                }
              : n
          )
        );
        if (plan.primary) {
          // Prepare B below A — never auto-scroll / never auto-activate.
          await prepareChildBelow(plan.primary);
        }
      } catch {
        /* Fail closed: A stays usable, no fake skip affordance. */
      } finally {
        loadingChildrenRef.current.delete(slug);
      }
    },
    [prepareChildBelow]
  );

  useEffect(() => {
    if (!activeSlug) return;
    if (!nodes.some((n) => n.artifact.slug === activeSlug)) return;
    void ensureChildrenLoaded(activeSlug);
  }, [activeSlug, nodes, ensureChildrenLoaded]);

  const handleReplayCompleted = useCallback(
    async (artifact: PublicFrozenJourneyArtifact) => {
      await ensureChildrenLoaded(artifact.slug);
    },
    [ensureChildrenLoaded]
  );

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

  useEffect(() => {
    const fromSlug = previousActiveSlugRef.current;
    if (fromSlug === activeSlug) return;
    const toSlug = activeSlug;
    const timer = window.setTimeout(() => {
      previousActiveSlugRef.current = toSlug;
      const fromNode = nodes.find((n) => n.artifact.slug === fromSlug);
      const live = replayProgressRef.current[fromSlug];
      const stored = fromNode
        ? loadFrozenReplayProgress(fromNode.artifact.slug, fromNode.artifact.journeyVersion)
        : null;
      const fromProgress = live ??
        (stored
          ? {
              completedStepCount: stored.completedStepCount,
              replayCompleted: stored.replayCompleted,
              selectedCount: fromNode?.artifact.selectedCount ?? fromNode?.artifact.steps.length ?? 0,
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
  }, [activeSlug, nodes]);

  const scrollTowardNextChild = (index: number) => {
    const next = nodes[index + 1];
    if (!next) return;
    const el = sectionRefs.current.get(next.artifact.slug);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    pendingScrollSlugRef.current = next.artifact.slug;
  };

  const nodeReplayComplete = (node: ChainNode) => {
    const live = replayProgress[node.artifact.slug];
    if (live) return live.replayCompleted;
    return Boolean(
      loadFrozenReplayProgress(node.artifact.slug, node.artifact.journeyVersion)
        ?.replayCompleted
    );
  };

  const openAlternatives = (node: ChainNode) => {
    setSheetAlts(node.alternatives);
    setSheetOpen(true);
  };

  if (!nodes.length || !activeNode) {
    return (
      <div className="py-10 text-center text-xs text-[#a89880]" data-testid="mirror-yansi-chain-loading">
        Deneyim hazırlanıyor…
      </div>
    );
  }

  return (
    <div
      className={cn('relative flex min-h-0 w-full flex-1 flex-col', className)}
      data-testid="mirror-yansi-chain"
      data-active-slug={activeSlug}
    >
      <MirrorYansiSceneCrossfade sceneImageUrl={activeNode.artifact.sceneImageUrl} />

      <div
        ref={scrollRootRef}
        className="relative z-[1] flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto overscroll-y-contain px-0 pb-8"
        data-testid="mirror-yansi-chain-scroll"
      >
        {nodes.map((node, index) => {
          const title = node.artifact.publicTitle || 'Yansı';
          const summary = node.artifact.publicSummary;
          const isActive = node.artifact.slug === activeSlug;
          return (
            <YansiExposureRoot
              key={`${node.artifact.slug}:v${node.artifact.journeyVersion}`}
              slug={node.artifact.slug}
              journeyVersion={node.artifact.journeyVersion}
              context="chain"
            >
            <section
              key={`${node.artifact.slug}:v${node.artifact.journeyVersion}`}
              ref={(el) => {
                if (el) sectionRefs.current.set(node.artifact.slug, el);
                else sectionRefs.current.delete(node.artifact.slug);
              }}
              data-yansi-slug={node.artifact.slug}
              data-yansi-active={isActive ? 'true' : 'false'}
              data-testid={`mirror-yansi-section-${node.artifact.slug}`}
              className="flex min-h-[70dvh] flex-col scroll-mt-4"
            >
              <header className="mb-4 space-y-2 saina-content-crossfade">
                <h2
                  className="text-xl font-semibold tracking-tight text-[#f5ead8] transition-opacity duration-500"
                  data-testid="mirror-yansi-active-title"
                  data-slug={node.artifact.slug}
                >
                  {title}
                </h2>
                {summary ? (
                  <p className="text-sm leading-relaxed text-[#c9bba8]">{summary}</p>
                ) : null}
                <div className="yansi-identity-header">
                  <AynaAuthorRow
                    displayName={node.authorDisplayName}
                    authorUserId={node.artifact.authorUserId}
                    publicAvatarUrl={node.authorAvatarUrl}
                    publicAvatarRevision={node.authorAvatarRevision}
                    honorific={node.authorHonorific}
                    onOpenProfile={() =>
                      router.push(authorProfilePath(node.artifact.authorUserId))
                    }
                  />
                  <YansiExperienceShareButton slug={node.artifact.slug} />
                </div>
                {node.artifact.parentSlug ? (
                  <AynaParentLineageRow
                    parentAuthorDisplayName={node.parentAuthorDisplayName}
                    parentPublicTitle={node.parentPublicTitle}
                    onOpenParent={() =>
                      router.push(`/m/${encodeURIComponent(node.artifact.parentSlug!)}`)
                    }
                  />
                ) : null}
                <YansiPublicMetricsLine
                  slug={node.artifact.slug}
                  journeyVersion={node.artifact.journeyVersion}
                  variant="section"
                />
              </header>

              <MirrorFrozenReplay
                artifact={node.artifact}
                className="min-h-0 flex-1"
                continueLabel={YANSI_OWN_CONTINUATION_CTA}
                chainEmbedded
                onReplayCompleted={handleReplayCompleted}
                onReplayProgress={handleReplayProgress}
              />

              {node.childrenLoaded &&
              node.eligibleChildCount > 0 &&
              nodes[index + 1] &&
              !nodeReplayComplete(node) ? (
                <button
                  type="button"
                  className="mx-auto mt-3 block px-2 py-1 text-center text-[11px] font-medium tracking-wide text-[#a89880] underline-offset-4 hover:text-[#c9bba8] hover:underline"
                  onClick={() => scrollTowardNextChild(index)}
                  data-testid="mirror-skip-to-next"
                >
                  {YANSI_SKIP_TO_NEXT_MERAK}
                </button>
              ) : null}

              {node.childrenLoaded && node.eligibleChildCount > 0 ? (
                <p
                  className="mt-3 text-center text-[11px] text-[#a89880]"
                  data-testid="mirror-continuation-cue"
                >
                  {node.eligibleChildCount === 1
                    ? '1 Yansı buradan devam etti'
                    : `${node.eligibleChildCount} Yansı buradan devam etti`}
                </p>
              ) : null}

              {node.childrenLoaded && node.alternatives.length > 0 ? (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-4 py-2 text-xs text-[#c9bba8] hover:bg-white/5"
                    onClick={() => openAlternatives(node)}
                    data-testid="mirror-other-paths"
                  >
                    Diğer {node.alternatives.length} yol
                  </button>
                </div>
              ) : null}
            </section>
            </YansiExposureRoot>
          );
        })}
      </div>

      <MirrorAlternateChildrenSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        alternatives={sheetAlts}
        onSelect={(child) => {
          setSheetOpen(false);
          void activateChosenChild(child);
        }}
      />
    </div>
  );
}
