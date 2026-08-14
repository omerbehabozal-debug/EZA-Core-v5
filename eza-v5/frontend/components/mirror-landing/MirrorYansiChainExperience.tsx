'use client';

/**
 * Phase 5.1 / 5.1.1 — continuous vertical Yansı chain after progressive replay.
 * Scroll down → published child; CTA → own continuation from ACTIVE slug.
 * Completing A may preload B below — never auto-scroll or auto-activate B.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import MirrorAlternateChildrenSheet from '@/components/mirror-landing/MirrorAlternateChildrenSheet';
import AynaAuthorRow from '@/components/mirror/ayna/AynaAuthorRow';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  loadChildContinuationPlan,
  type EligibleChildContinuation,
} from '@/lib/eza/mirror/journey/yansiChildContinuation';
import { resolvePublicAuthorDisplayName } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { cn } from '@/lib/utils';

export type MirrorYansiChainExperienceProps = {
  rootArtifact: PublicFrozenJourneyArtifact;
  className?: string;
};

type ChainNode = {
  artifact: PublicFrozenJourneyArtifact;
  authorDisplayName: string;
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
  const authorDisplayName = await resolvePublicAuthorDisplayName(artifact.authorUserId);
  let parentAuthorDisplayName: string | null = null;
  let parentPublicTitle: string | null = null;
  if (artifact.parentSlug) {
    const parent = await fetchPublicFrozenJourneyArtifact({ slug: artifact.parentSlug });
    if (parent) {
      parentPublicTitle = parent.publicTitle || null;
      parentAuthorDisplayName = await resolvePublicAuthorDisplayName(parent.authorUserId);
    }
  }
  return {
    artifact,
    authorDisplayName,
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
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const loadingChildrenRef = useRef<Set<string>>(new Set());
  const childrenResolvedRef = useRef<Set<string>>(new Set());
  const pendingScrollSlugRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void enrichNode(rootArtifact).then((node) => {
      if (!cancelled) setNodes([node]);
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

  const handleReplayCompleted = useCallback(
    async (artifact: PublicFrozenJourneyArtifact) => {
      const slug = artifact.slug;
      if (loadingChildrenRef.current.has(slug) || childrenResolvedRef.current.has(slug)) {
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
      } finally {
        loadingChildrenRef.current.delete(slug);
      }
    },
    [prepareChildBelow]
  );

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
        className="relative z-[1] flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto px-0 pb-8"
        data-testid="mirror-yansi-chain-scroll"
      >
        {nodes.map((node, index) => {
          const title = node.artifact.publicTitle || 'Yansı';
          const summary = node.artifact.publicSummary;
          const isActive = node.artifact.slug === activeSlug;
          return (
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
                <AynaAuthorRow
                  displayName={node.authorDisplayName}
                  onOpenProfile={() =>
                    router.push(authorProfilePath(node.artifact.authorUserId))
                  }
                />
                {node.artifact.parentSlug ? (
                  <AynaParentLineageRow
                    parentAuthorDisplayName={node.parentAuthorDisplayName}
                    parentPublicTitle={node.parentPublicTitle}
                    onOpenParent={() =>
                      router.push(`/m/${encodeURIComponent(node.artifact.parentSlug!)}`)
                    }
                  />
                ) : null}
              </header>

              <MirrorFrozenReplay
                artifact={node.artifact}
                className="min-h-0 flex-1"
                continueLabel="Kendi merakımla devam et"
                trackStartOnFirstQuestion={index > 0}
                onReplayCompleted={handleReplayCompleted}
              />

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
