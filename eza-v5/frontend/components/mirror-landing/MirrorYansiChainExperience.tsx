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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ChevronDown, ChevronUp, Menu, MoreHorizontal, Volume2 } from 'lucide-react';
import MirrorFrozenReplay from '@/components/mirror-landing/MirrorFrozenReplay';
import MirrorYansiSceneCrossfade from '@/components/mirror-landing/MirrorYansiSceneCrossfade';
import YansiDesktopReelSurface from '@/components/mirror-landing/YansiDesktopReelSurface';
import YansiKatkiDepth, {
  YansiVerifierPanel,
  YansiSocialPanelPresence,
  type KatkiLeaveGuard,
} from '@/components/mirror-landing/YansiKatkiDepth';
import AynaParentLineageRow from '@/components/mirror/ayna/AynaParentLineageRow';
import '@/styles/bilign-avatar-identity-frame.css';
import BilignAvatarIdentityFrame from '@/components/mirror/ayna/BilignAvatarIdentityFrame';
import ProfileUserAvatar from '@/components/mirror/ayna/ProfileUserAvatar';
import HonorificMarker from '@/components/mirror/ayna/HonorificMarker';
import YansiExperienceShareButton from '@/components/mirror-landing/YansiExperienceShareButton';
import YansiSaveButton from '@/components/mirror-landing/YansiSaveButton';
import YansiMobileAudioSheet from '@/components/mirror-landing/YansiMobileAudioSheet';
import YansiMobileMinimalPlayer from '@/components/mirror-landing/YansiMobileMinimalPlayer';
import { useYansiExperienceSession } from '@/components/mirror-landing/YansiExperienceSession';
import { fetchPublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  assertYansiAtomicIdentity,
  logYansiAtomicIdentity,
  readYansiAtomicIdentity,
} from '@/lib/eza/mirror/journey/yansiAtomicIdentity';
import { resolvePublicAuthorIdentity } from '@/lib/eza/mirror/journey/resolvePublicAuthorDisplay';
import { authorProfilePath } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  YANSI_CONTINUATION_NEXT,
  YANSI_CONTINUATION_PREVIOUS,
  YANSI_DISCOVER_END_OF_POOL,
  YANSI_DETAIL_CLOSE,
  YANSI_DETAIL_OPEN,
  YANSI_OWN_CONTINUATION_CTA,
  YANSI_PREVIOUS_MERAK,
  YANSI_SKIP_TO_NEXT_MERAK,
} from '@/lib/eza/mirror/copy';
import {
  formatYansiHeroMetaTime,
  YANSI_HERO_META_TYPE_YANSI,
} from '@/lib/eza/mirror/yansiHeroMeta';
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
import {
  createYansiSwipeGestureState,
  readYansiScrollMetrics,
  yansiSwipePointerCancel,
  yansiSwipePointerDown,
  yansiSwipePointerUp,
  yansiSwipeShouldIgnoreTarget,
} from '@/lib/eza/mirror/journey/yansiSwipeGesture';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { cn } from '@/lib/utils';
import YansiPublicMetricsLine from '@/components/mirror-landing/YansiPublicMetricsLine';
import YansiExposureRoot from '@/components/mirror-landing/YansiExposureRoot';
import YansiTrustActions from '@/components/mirror-landing/YansiTrustActions';
import YansiExperienceControls from '@/components/mirror-landing/YansiExperienceControls';
import {
  createYansiWheelGestureState,
  resolveYansiWheelTick,
} from '@/lib/eza/mirror/journey/yansiDesktopWheelGesture';
import {
  readYansiReelPrefersReducedMotion,
  yansiReelTravelDuration,
  type YansiReelTravelDirection,
} from '@/lib/eza/mirror/journey/yansiDesktopReelTransition';
import {
  buildYansiPublicHref,
  navigateBackFromYansiReel,
  pushYansiChatDepth,
  replaceYansiPublicUrl,
  returnToYansiReelDepth,
  type YansiPublicDepth,
} from '@/lib/eza/mirror-network/yansiPublicDepth';
import {
  closedKatkiDepth,
  closeKatki,
  escapeKatki,
  katkiOwnsWheel,
  openKatkiList,
  openKatkiTypeChoice,
  returnKatkiToTypeChoice,
  selectKatkiType,
  type KatkiDepthState,
} from '@/lib/eza/mirror-network/katkiDepth';
import {
  applyVerifyToggle,
  fetchPublicKatki,
  katkiCreateErrorMessage,
  katkiReelSignal,
  optimisticVerifyToggle,
  togglePublicVerify,
  visibleVerifiers,
  type KatkiReadStatus,
  type PublicKatkiRead,
} from '@/lib/eza/mirror-network/katkiPublic';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export type MirrorYansiChainExperienceProps = {
  rootArtifact: PublicFrozenJourneyArtifact;
  className?: string;
  /** Guest Save → open IdentityModal (parent owns modal). */
  onRequireAuth?: () => void;
  /**
   * Public depth: reel = immersive preview; chat = frozen replay over same scene.
   * Phase A+B: reel default; chat mounts existing MirrorFrozenReplay for Phase C readiness.
   */
  depth?: YansiPublicDepth;
  /** Parent-owned depth (keeps discovery session across Reel↔Chat without remount). */
  onDepthChange?: (depth: YansiPublicDepth) => void;
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

type ReelTravel = {
  direction: YansiReelTravelDirection;
  outgoing: ExperienceNode;
  incoming: ExperienceNode;
  nextSession: YansiDiscoverySession;
  traveling: boolean;
  reducedMotion: boolean;
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

function publicPathForSlug(
  slug: string,
  options?: { journeyVersion?: number | null; mode?: YansiPublicDepth }
): string {
  return buildYansiPublicHref(slug, options);
}

export default function MirrorYansiChainExperience({
  rootArtifact,
  className,
  onRequireAuth,
  depth = 'reel',
  onDepthChange,
}: MirrorYansiChainExperienceProps) {
  const router = useRouter();
  const { isAuthenticated, isAuthReady } = useAuth();
  const isDesktop = useSainaCompactShell();
  const experienceSession = useYansiExperienceSession();
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
  const [audioSheetOpen, setAudioSheetOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [katki, setKatki] = useState<KatkiDepthState>(closedKatkiDepth);
  const katkiLeaveGuardRef = useRef<KatkiLeaveGuard | null>(null);
  const registerKatkiLeaveGuard = useCallback((guard: KatkiLeaveGuard | null) => {
    katkiLeaveGuardRef.current = guard;
  }, []);
  const requestSocialLeave = useCallback((proceed: () => void) => {
    if (katkiLeaveGuardRef.current) katkiLeaveGuardRef.current(proceed);
    else proceed();
  }, []);
  const katkiRef = useRef(katki);
  katkiRef.current = katki;
  const [katkiRead, setKatkiRead] = useState<PublicKatkiRead | null>(null);
  const [katkiReadStatus, setKatkiReadStatus] = useState<KatkiReadStatus>('idle');
  const katkiRequestGen = useRef(0);
  const verifyInFlightRef = useRef(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifierOpen, setVerifierOpen] = useState(false);
  const [reelTravel, setReelTravel] = useState<ReelTravel | null>(null);
  const previousActiveSlugRef = useRef(entrySlug);
  const skipFiredRef = useRef<Set<string>>(new Set());
  const navInFlightRef = useRef(false);
  const neighborsRequestIdRef = useRef(0);
  const swipeRef = useRef(createYansiSwipeGestureState());
  const wheelRef = useRef(createYansiWheelGestureState());
  const chainRootRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const replayProgressRef = useRef(replayProgress);
  replayProgressRef.current = replayProgress;
  const nodesBySlugRef = useRef(nodesBySlug);
  nodesBySlugRef.current = nodesBySlug;
  const reelTravelRef = useRef<ReelTravel | null>(null);
  reelTravelRef.current = reelTravel;
  const reelTravelTimerRef = useRef<number | null>(null);
  const reelTravelStartTimerRef = useRef<number | null>(null);
  const reelTravelRafRef = useRef<number | null>(null);

  const activeSlug = session ? activeDiscoverSlug(session) : entrySlug;
  const activeNode = nodesBySlug[activeSlug] ?? null;
  const presentedJourneyVersion =
    activeNode?.artifact.journeyVersion ?? rootArtifact.journeyVersion;
  const resetAudioForActiveChange = experienceSession?.resetAudioForActiveChange;
  const audioActiveSlugRef = useRef(activeSlug);

  /**
   * Audio belongs to the exact active Yansı. Provider slug is the entry root and
   * does not change on Discover/continuation navigation — cancel + idle here.
   */
  useEffect(() => {
    if (audioActiveSlugRef.current === activeSlug) return;
    audioActiveSlugRef.current = activeSlug;
    resetAudioForActiveChange?.();
  }, [activeSlug, resetAudioForActiveChange]);

  useEffect(() => {
    setDetailOpen(false);
  }, [activeSlug, depth]);

  useEffect(() => {
    setKatki(closedKatkiDepth());
    setVerifierOpen(false);
  }, [activeSlug, presentedJourneyVersion]);

  useEffect(() => {
    if (depth === 'chat' || !isDesktop) {
      setKatki(closedKatkiDepth());
      setVerifierOpen(false);
    }
  }, [depth, isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      katkiRequestGen.current += 1;
      setKatkiRead(null);
      setKatkiReadStatus('idle');
      return;
    }
    const slugAt = activeSlug.trim().toLowerCase();
    const versionAt = presentedJourneyVersion;
    if (!slugAt || !Number.isInteger(versionAt) || versionAt < 1) {
      katkiRequestGen.current += 1;
      setKatkiRead(null);
      setKatkiReadStatus('idle');
      return;
    }
    const generation = ++katkiRequestGen.current;
    setKatkiRead(null);
    setKatkiReadStatus('loading');
    let cancelled = false;
    void fetchPublicKatki(slugAt, versionAt).then((result) => {
      if (cancelled || generation !== katkiRequestGen.current) return;
      if (
        !result.ok ||
        result.data.slug !== slugAt ||
        result.data.journeyVersion !== versionAt
      ) {
        setKatkiRead(null);
        setKatkiReadStatus('error');
        return;
      }
      setKatkiRead(result.data);
      setKatkiReadStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [activeSlug, isDesktop, presentedJourneyVersion]);

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
   * Keep browser URL aligned with the active product without stacking history
   * and without App Router remount (preserves discovery session).
   * Vertical/horizontal → REPLACE. Discover → Reel remains PUSH at entry.
   */
  useEffect(() => {
    if (!activeSlug || typeof window === 'undefined') return;
    const desired = publicPathForSlug(activeSlug, {
      journeyVersion: activeNode?.artifact.journeyVersion ?? rootArtifact.journeyVersion,
      mode: depth === 'chat' ? 'chat' : 'reel',
    });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === desired) return;
    replaceYansiPublicUrl(desired);
  }, [
    activeSlug,
    activeNode?.artifact.journeyVersion,
    rootArtifact.journeyVersion,
    depth,
  ]);

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
    if (artifact.slug.trim().toLowerCase() !== key) return null;
    preloadSceneImage(artifact.sceneImageUrl);
    const node = await enrichNode(artifact);
    setNodesBySlug((prev) => ({ ...prev, [key]: node }));
    return node;
  }, []);

  const clearReelTravelTimers = useCallback(() => {
    if (reelTravelTimerRef.current != null) {
      window.clearTimeout(reelTravelTimerRef.current);
      reelTravelTimerRef.current = null;
    }
    if (reelTravelStartTimerRef.current != null) {
      window.clearTimeout(reelTravelStartTimerRef.current);
      reelTravelStartTimerRef.current = null;
    }
    if (reelTravelRafRef.current != null) {
      window.cancelAnimationFrame(reelTravelRafRef.current);
      reelTravelRafRef.current = null;
    }
  }, []);

  const finishReelTravel = useCallback((travel: ReelTravel) => {
    clearReelTravelTimers();
    setSession(travel.nextSession);
    setReelTravel(null);
    reelTravelRef.current = null;
    navInFlightRef.current = false;
    setNavBusy(false);
  }, [clearReelTravelTimers]);

  const beginReelTravel = useCallback(
    (input: Omit<ReelTravel, 'traveling' | 'reducedMotion'>) => {
      setKatki(closedKatkiDepth());
      setVerifierOpen(false);
      katkiRequestGen.current += 1;
      setKatkiRead(null);
      setKatkiReadStatus('idle');
      if (!isDesktop || depth !== 'reel') {
        setSession(input.nextSession);
        return false;
      }
      setDetailOpen(false);
      navInFlightRef.current = true;
      setNavBusy(true);
      const reducedMotion = readYansiReelPrefersReducedMotion();
      const next: ReelTravel = { ...input, traveling: false, reducedMotion };
      reelTravelRef.current = next;
      setReelTravel(next);
      clearReelTravelTimers();
      const startMotion = () => {
        setReelTravel((cur) => (cur && !cur.traveling ? { ...cur, traveling: true } : cur));
      };
      reelTravelRafRef.current = window.requestAnimationFrame(() => {
        reelTravelRafRef.current = window.requestAnimationFrame(startMotion);
      });
      // rAF can stall in background/automation tabs; timeout still kicks the slide.
      reelTravelStartTimerRef.current = window.setTimeout(startMotion, 24);
      reelTravelTimerRef.current = window.setTimeout(() => {
        finishReelTravel(next);
      }, yansiReelTravelDuration(reducedMotion));
      return true;
    },
    [clearReelTravelTimers, depth, finishReelTravel, isDesktop]
  );

  useEffect(() => () => clearReelTravelTimers(), [clearReelTravelTimers]);

  useEffect(() => {
    if (depth !== 'chat' || !reelTravelRef.current) return;
    finishReelTravel(reelTravelRef.current);
  }, [depth, finishReelTravel]);

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
    if (!current || navInFlightRef.current || reelTravelRef.current) return;
    const next = discoverGoUp(current);
    if (!next) return;
    const outgoing = nodesBySlugRef.current[activeDiscoverSlug(current)];
    const incoming = nodesBySlugRef.current[activeDiscoverSlug(next)];
    setPoolEndVisible(false);
    if (outgoing && incoming && beginReelTravel({ direction: 'up', outgoing, incoming, nextSession: next })) {
      return;
    }
    setSession(next);
  }, [beginReelTravel]);

  const goDown = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || navInFlightRef.current || reelTravelRef.current) return;

    if (canDiscoverGoDownInHistory(current)) {
      const next = discoverGoDownInHistory(current);
      if (!next) return;
      const outgoing = nodesBySlugRef.current[activeDiscoverSlug(current)];
      const incoming =
        nodesBySlugRef.current[activeDiscoverSlug(next)] ||
        (await ensureArtifactLoaded(activeDiscoverSlug(next)));
      setPoolEndVisible(false);
      if (
        outgoing &&
        incoming &&
        beginReelTravel({ direction: 'down', outgoing, incoming, nextSession: next })
      ) {
        return;
      }
      setSession(next);
      return;
    }

    if (!needsDiscoverFetchForDown(current)) {
      setPoolEndVisible(true);
      return;
    }

    navInFlightRef.current = true;
    setNavBusy(true);
    let handedToTravel = false;
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
        if (!hist) return;
        const outgoing = nodesBySlugRef.current[activeDiscoverSlug(live)];
        const incoming =
          nodesBySlugRef.current[activeDiscoverSlug(hist)] ||
          (await ensureArtifactLoaded(activeDiscoverSlug(hist)));
        if (
          outgoing &&
          incoming &&
          beginReelTravel({ direction: 'down', outgoing, incoming, nextSession: hist })
        ) {
          handedToTravel = true;
          return;
        }
        setSession(hist);
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
      const outgoing = nodesBySlugRef.current[activeDiscoverSlug(live)];
      if (
        outgoing &&
        beginReelTravel({
          direction: 'down',
          outgoing,
          incoming: loaded,
          nextSession: appended,
        })
      ) {
        handedToTravel = true;
        return;
      }
      setSession(appended);
    } finally {
      if (!handedToTravel) {
        navInFlightRef.current = false;
        setNavBusy(false);
      }
    }
  }, [beginReelTravel, ensureArtifactLoaded]);

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

  const onSwipePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Chat depth owns scroll/read gestures — never arm Reel navigation.
    if (depth === 'chat' || isDesktop || navInFlightRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (yansiSwipeShouldIgnoreTarget(event.target)) return;
    swipeRef.current = yansiSwipePointerDown(
      swipeRef.current,
      event.pointerId,
      event.clientX,
      event.clientY
    );
  }, [depth, isDesktop]);

  const onSwipePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (depth === 'chat' || isDesktop) {
        swipeRef.current = yansiSwipePointerCancel(swipeRef.current, event.pointerId);
        return;
      }
      // Content scroll stays native — never cancel the pointer event.
      const scroll = readYansiScrollMetrics(scrollRootRef.current);
      const result = yansiSwipePointerUp(
        swipeRef.current,
        event.pointerId,
        event.clientX,
        event.clientY,
        scroll
      );
      swipeRef.current = result.state;
      if (!result.direction || navInFlightRef.current) return;
      if (result.direction === 'up') void goDown();
      else if (result.direction === 'down') goUp();
      else if (result.direction === 'left') void goHorizontal('next');
      else if (result.direction === 'right') void goHorizontal('previous');
    },
    [depth, goDown, goHorizontal, goUp, isDesktop]
  );

  const onSwipePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    swipeRef.current = yansiSwipePointerCancel(swipeRef.current, event.pointerId);
  }, []);

  const openChatDepth = useCallback(() => {
    if (!activeSlug || depth === 'chat') return;
    setKatki(closedKatkiDepth());
    setVerifierOpen(false);
    const version =
      activeNode?.artifact.journeyVersion ?? rootArtifact.journeyVersion;
    const href = publicPathForSlug(activeSlug, {
      journeyVersion: version,
      mode: 'chat',
    });
    pushYansiChatDepth(href);
    onDepthChange?.('chat');
  }, [
    activeSlug,
    activeNode?.artifact.journeyVersion,
    rootArtifact.journeyVersion,
    onDepthChange,
    depth,
  ]);

  const exitChatDepth = useCallback(() => {
    if (depth !== 'chat' || !activeSlug) return;
    const version =
      activeNode?.artifact.journeyVersion ?? rootArtifact.journeyVersion;
    const reelHref = publicPathForSlug(activeSlug, {
      journeyVersion: version,
      mode: 'reel',
    });
    returnToYansiReelDepth({ reelHref, onDepthChange });
  }, [
    depth,
    activeSlug,
    activeNode?.artifact.journeyVersion,
    rootArtifact.journeyVersion,
    onDepthChange,
  ]);

  // Chat → Reel: restore focus to title without opening keyboard / scroll jump.
  const prevDepthRef = useRef(depth);
  useEffect(() => {
    const prev = prevDepthRef.current;
    prevDepthRef.current = depth;
    if (prev !== 'chat' || depth !== 'reel') return;
    const titleEl = document.querySelector(
      '[data-testid="mirror-yansi-active-title"][data-yansi-depth-trigger="chat"]'
    ) as HTMLElement | null;
    if (titleEl && typeof titleEl.focus === 'function') {
      titleEl.focus({ preventScroll: true });
    }
  }, [depth]);

  // Deep-link chat settles without entry choreography; title-activated chat rises.
  const [chatReveal, setChatReveal] = useState<'idle' | 'entering' | 'settled'>(() =>
    depth === 'chat' ? 'settled' : 'idle'
  );
  const hadMountedRef = useRef(false);
  useEffect(() => {
    if (depth === 'chat') {
      if (!hadMountedRef.current) {
        setChatReveal('settled');
      } else {
        setChatReveal('entering');
        const t = window.setTimeout(() => setChatReveal('settled'), 360);
        hadMountedRef.current = true;
        return () => window.clearTimeout(t);
      }
    } else {
      setChatReveal('idle');
    }
    hadMountedRef.current = true;
  }, [depth]);

  const katkiSnapshot =
    katkiRead &&
    katkiRead.slug === activeSlug &&
    katkiRead.journeyVersion === presentedJourneyVersion
      ? katkiRead
      : null;

  const openKatkiListFromReel = useCallback(() => {
    if (!isDesktop || depth !== 'reel' || navInFlightRef.current || !activeSlug) return;
    if (!katkiSnapshot) return;
    requestSocialLeave(() => {
      setVerifierOpen(false);
      setKatki((current) => current.stage !== 'closed'
        ? closeKatki() : openKatkiList(activeSlug, presentedJourneyVersion));
    });
  }, [activeSlug, depth, isDesktop, katkiSnapshot, presentedJourneyVersion, requestSocialLeave]);

  const openVerifiersFromReel = useCallback(() => {
    if (!isDesktop || depth !== 'reel' || navInFlightRef.current || !activeSlug) return;
    if (!katkiSnapshot || katkiSnapshot.countsByType.verify < 1) return;
    requestSocialLeave(() => {
      setKatki(closedKatkiDepth());
      setVerifierOpen((current) => !current);
    });
  }, [activeSlug, depth, isDesktop, katkiSnapshot, requestSocialLeave]);

  const submitDirectVerify = useCallback(async () => {
    if (!isDesktop || depth !== 'reel' || navInFlightRef.current || reelTravel) return;
    if (!activeSlug || !Number.isInteger(presentedJourneyVersion) || presentedJourneyVersion < 1) {
      return;
    }
    if (!katkiSnapshot) return;
    if (verifyInFlightRef.current) return;
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    const slugAt = activeSlug;
    const versionAt = presentedJourneyVersion;
    const generation = katkiRequestGen.current;
    verifyInFlightRef.current = true;
    setVerifyPending(true);
    setKatkiRead((current) => {
      if (!current || current.slug !== slugAt || current.journeyVersion !== versionAt) return current;
      return optimisticVerifyToggle(current);
    });
    const stillCurrent = () => generation === katkiRequestGen.current;
    const result = await togglePublicVerify(slugAt, versionAt);
    if (!stillCurrent()) {
      verifyInFlightRef.current = false;
      setVerifyPending(false);
      return;
    }
    if (!result.ok) {
      const reconciled = await fetchPublicKatki(slugAt, versionAt);
      if (
        stillCurrent() &&
        reconciled.ok &&
        reconciled.data.slug === slugAt &&
        reconciled.data.journeyVersion === versionAt
      ) {
        setKatkiRead(reconciled.data);
        setKatkiReadStatus('ready');
      }
      if (katkiCreateErrorMessage(result.code) === 'auth') {
        onRequireAuth?.();
      }
      verifyInFlightRef.current = false;
      setVerifyPending(false);
      return;
    }
    setKatkiRead((current) => {
      if (!current || current.slug !== slugAt || current.journeyVersion !== versionAt) return current;
      return applyVerifyToggle(current, result.data);
    });
    const reconciled = await fetchPublicKatki(slugAt, versionAt);
    if (
      stillCurrent() &&
      reconciled.ok &&
      reconciled.data.slug === slugAt &&
      reconciled.data.journeyVersion === versionAt
    ) {
      setKatkiRead(reconciled.data);
      setKatkiReadStatus('ready');
    }
    verifyInFlightRef.current = false;
    setVerifyPending(false);
  }, [
    activeSlug,
    depth,
    isAuthenticated,
    isAuthReady,
    isDesktop,
    katkiSnapshot,
    onRequireAuth,
    presentedJourneyVersion,
    reelTravel,
  ]);

  const onDesktopKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && (katkiRef.current.stage !== 'closed' || verifierOpen)) {
        event.preventDefault();
        requestSocialLeave(() => {
          setKatki(closeKatki());
          setVerifierOpen(false);
        });
        return;
      }
      if (navInFlightRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Escape: Chat → Reel (does not invent a second history pop when Back is used).
      if (event.key === 'Escape' && depth === 'chat') {
        event.preventDefault();
        exitChatDepth();
        return;
      }

      // Reel shortcuts suspended while Chat or Katkılar owns reading/focus.
      if (depth === 'chat' || !isDesktop || katkiRef.current.stage !== 'closed' || verifierOpen) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        void goDown();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        goUp();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void goHorizontal('previous');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        void goHorizontal('next');
      }
    },
    [depth, exitChatDepth, goDown, goHorizontal, goUp, isDesktop, verifierOpen, requestSocialLeave]
  );

  const onDesktopReelWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!isDesktop || depth !== 'reel') return;
      if (verifierOpen) {
        event.preventDefault();
        return;
      }
      if (katkiOwnsWheel(katkiRef.current.stage)) {
        const target = event.target as Node | null;
        const depthEl = chainRootRef.current?.querySelector(
          '[data-testid="yansi-katki-depth"]'
        );
        if (target && depthEl?.contains(target)) return;
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (navInFlightRef.current || reelTravelRef.current) return;
      const resolved = resolveYansiWheelTick(
        wheelRef.current,
        event.deltaY,
        performance.now(),
        { enabled: true }
      );
      wheelRef.current = resolved.state;
      if (resolved.direction === 'down') void goDown();
      if (resolved.direction === 'up') goUp();
    },
    [depth, goDown, goUp, isDesktop, verifierOpen]
  );

  useEffect(() => {
    const root = chainRootRef.current;
    if (!root || !isDesktop) return;
    const onWheel = (event: WheelEvent) => {
      if (depth !== 'reel') return;
      const target = event.target;
      const depthEl = root.querySelector('[data-testid="yansi-katki-depth"], [data-testid="yansi-verifier-panel"]');
      if (target instanceof Node && depthEl?.contains(target)) return;
      event.preventDefault();
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [depth, isDesktop]);

  useEffect(() => {
    if (depth === 'chat') {
      wheelRef.current = createYansiWheelGestureState();
    }
  }, [depth]);

  useEffect(() => {
    if (!session || !isDesktop || depth !== 'reel') return;
    const prev = session.history[session.activeIndex - 1];
    const next = session.history[session.activeIndex + 1];
    const currentNode = nodesBySlug[activeDiscoverSlug(session)];
    if (currentNode) preloadSceneImage(currentNode.artifact.sceneImageUrl);
    if (prev) {
      void ensureArtifactLoaded(prev).then((node) => {
        if (node) preloadSceneImage(node.artifact.sceneImageUrl);
      });
    }
    if (next) {
      void ensureArtifactLoaded(next).then((node) => {
        if (node) preloadSceneImage(node.artifact.sceneImageUrl);
      });
    }
  }, [depth, ensureArtifactLoaded, isDesktop, nodesBySlug, session]);

  useEffect(() => {
    if (!activeNode) return;
    logYansiAtomicIdentity(readYansiAtomicIdentity(activeNode.artifact));
  }, [activeNode]);

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
  const activeIdentity = assertYansiAtomicIdentity(activeNode.artifact, {
    expectedSlug: activeSlug,
    renderedTitle: activeNode.artifact.publicTitle,
    renderedSceneUrl: activeNode.artifact.sceneImageUrl,
  });
  const showUp = canDiscoverGoUp(session);
  const showDown =
    canDiscoverGoDownInHistory(session) || needsDiscoverFetchForDown(session);
  const publicMetaTime = activeNode.artifact.publishedAt
    ? formatYansiHeroMetaTime(activeNode.artifact.publishedAt)
    : '';
  const publicMetaType = YANSI_HERO_META_TYPE_YANSI;
  const showChatReplay = depth === 'chat';
  const desktopReelTravel = isDesktop && !showChatReplay;
  const reelNavLocked = depth === 'chat' || Boolean(reelTravel);
  const titlePosition = showChatReplay ? 'elevated' : 'lower';
  const reelActions = (
    <>
      <YansiSaveButton
        slug={activeNode.artifact.slug}
        authorUserId={activeNode.artifact.authorUserId}
        compact
        onRequireAuth={onRequireAuth}
      />
      <YansiExperienceShareButton slug={activeNode.artifact.slug} />
    </>
  );

  const continuationSegments = [
    continuationPrevious
      ? {
          key: `previous:${continuationPrevious.slug}`,
          slug: continuationPrevious.slug,
          direction: 'previous' as const,
          label: YANSI_CONTINUATION_PREVIOUS,
          current: false,
        }
      : null,
    {
      key: `current:${activeSlug}`,
      slug: activeSlug,
      direction: null,
      label: title,
      current: true,
    },
    continuationNext
      ? {
          key: `next:${continuationNext.slug}`,
          slug: continuationNext.slug,
          direction: 'next' as const,
          label: YANSI_CONTINUATION_NEXT,
          current: false,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    slug: string;
    direction: 'previous' | 'next' | null;
    label: string;
    current: boolean;
  }>;

  const continuationPreviousScene =
    (continuationPrevious?.slug &&
      nodesBySlug[continuationPrevious.slug]?.artifact.sceneImageUrl) ||
    null;
  const continuationNextScene =
    (continuationNext?.slug && nodesBySlug[continuationNext.slug]?.artifact.sceneImageUrl) ||
    null;

  const renderContinuationContext = (
    direction: 'previous' | 'next',
    neighbor: PublicContinuationNeighbor | null,
    sceneImageUrl: string | null
  ) => {
    if (!neighbor) return null;
    const label =
      direction === 'previous' ? YANSI_CONTINUATION_PREVIOUS : YANSI_CONTINUATION_NEXT;
    return (
      <button
        type="button"
        className="yansi-reel-continuation-context"
        data-testid={
          direction === 'previous'
            ? 'yansi-reel-continuation-context-previous'
            : 'yansi-reel-continuation-context-next'
        }
        data-direction={direction}
        disabled={navBusy}
        onClick={() => void goHorizontal(direction)}
      >
        {direction === 'previous' ? <span>{label}</span> : null}
        <span
          className="yansi-reel-continuation-context__thumb"
          data-has-image={sceneImageUrl ? 'true' : 'false'}
          aria-hidden
        >
          {sceneImageUrl ? <img src={sceneImageUrl} alt="" /> : null}
        </span>
        {direction === 'next' ? <span>{label}</span> : null}
      </button>
    );
  };

  const renderDesktopReelChrome = () => {
    if (!isDesktop || showChatReplay) return null;
    return (
      <>
        <nav
          className="yansi-reel-continuation-strip"
          data-testid="yansi-reel-continuation-strip"
          aria-label="Yansı devam zinciri"
        >
          {renderContinuationContext(
            'previous',
            continuationPrevious,
            continuationPreviousScene
          )}
          <div
            className="yansi-reel-continuation-strip__track"
            data-testid="yansi-reel-continuation-track"
            data-segment-count={continuationSegments.length}
          >
            {continuationSegments.map((segment) =>
              segment.current || !segment.direction ? (
                <span
                  key={segment.key}
                  className="yansi-reel-continuation-strip__segment"
                  data-testid="yansi-reel-continuation-segment-current"
                  data-current="true"
                  aria-current="true"
                  aria-label={`Şu anki Yansı: ${segment.label}`}
                />
              ) : (
                <button
                  key={segment.key}
                  type="button"
                  className="yansi-reel-continuation-strip__segment"
                  data-testid={
                    segment.direction === 'previous'
                      ? 'mirror-continuation-prev'
                      : 'mirror-continuation-next'
                  }
                  data-yansi-reel-segment={segment.direction}
                  data-current="false"
                  data-direction={segment.direction}
                  aria-label={
                    segment.direction === 'previous'
                      ? `${YANSI_CONTINUATION_PREVIOUS}: ${segment.slug}`
                      : `${YANSI_CONTINUATION_NEXT}: ${segment.slug}`
                  }
                  title={
                    segment.direction === 'previous'
                      ? YANSI_CONTINUATION_PREVIOUS
                      : YANSI_CONTINUATION_NEXT
                  }
                  disabled={navBusy}
                  onClick={() => {
                    if (segment.direction) void goHorizontal(segment.direction);
                  }}
                >
                  <span className="sr-only">
                    {segment.direction === 'previous'
                      ? YANSI_CONTINUATION_PREVIOUS
                      : YANSI_CONTINUATION_NEXT}
                  </span>
                </button>
              )
            )}
          </div>
          {renderContinuationContext('next', continuationNext, continuationNextScene)}
        </nav>

        <div className="yansi-reel-right-controls" data-testid="yansi-reel-right-controls">
          {showUp ? (
            <div className="yansi-reel-right-controls__nav">
              <button
                type="button"
                className="yansi-reel-feed-controls__button"
                data-testid="mirror-discover-up"
                data-yansi-reel-feed-control="up"
                aria-label={YANSI_PREVIOUS_MERAK}
                title={YANSI_PREVIOUS_MERAK}
                disabled={navBusy}
                onClick={goUp}
              >
                <ChevronUp size={23} strokeWidth={1.55} aria-hidden />
                <span className="sr-only">{YANSI_PREVIOUS_MERAK}</span>
              </button>
              <span className="yansi-reel-right-controls__label">Önceki Merak</span>
            </div>
          ) : null}
          <div
            className="yansi-reel-action-cluster"
            data-testid="yansi-reel-action-cluster"
            aria-label="Yansı eylemleri"
          >
            <div className="yansi-reel-action-cluster__item">
              <YansiExperienceShareButton slug={activeNode.artifact.slug} />
              <span>Paylaş</span>
            </div>
            <span className="yansi-reel-action-cluster__divider" aria-hidden />
            <div className="yansi-reel-action-cluster__item">
              <YansiSaveButton
                slug={activeNode.artifact.slug}
                authorUserId={activeNode.artifact.authorUserId}
                compact
                onRequireAuth={onRequireAuth}
              />
              <span>Merakıma Kaydet</span>
            </div>
          </div>
          {showDown ? (
            <div className="yansi-reel-right-controls__nav">
              <button
                type="button"
                className="yansi-reel-feed-controls__button"
                data-testid="mirror-skip-to-next"
                data-yansi-reel-feed-control="down"
                aria-label={YANSI_SKIP_TO_NEXT_MERAK}
                title={YANSI_SKIP_TO_NEXT_MERAK}
                disabled={navBusy}
                onClick={() => void goDown()}
              >
                <ChevronDown size={23} strokeWidth={1.55} aria-hidden />
                <span className="sr-only">{YANSI_SKIP_TO_NEXT_MERAK}</span>
              </button>
              <span className="yansi-reel-right-controls__label">Sonraki Merak</span>
            </div>
          ) : null}
        </div>
      </>
    );
  };

  const renderTitleBlock = () => (
            <header
              className={cn(
                'mb-4 space-y-2 saina-content-crossfade',
                !isDesktop && 'yansi-mobile-title-block px-4 pt-1',
                isDesktop && 'yansi-desktop-visual-stack',
                showChatReplay && 'yansi-chat-title-quiet'
              )}
              data-yansi-title-position={titlePosition}
              data-yansi-detail-open={
                isDesktop && !showChatReplay && detailOpen ? 'true' : 'false'
              }
              data-testid="yansi-title-block"
              data-yansi-copy-overlay={isDesktop ? 'true' : undefined}
              data-yansi-active-identity={activeSlug}
            >
              {isDesktop && showChatReplay ? (
                <div
                  data-testid="yansi-desktop-identity"
                  data-yansi-active-identity={activeSlug}
                  data-yansi-author-id={activeNode.artifact.authorUserId}
                  data-yansi-avatar-authority="canonical-profile"
                  data-bilign-identity-role="primary"
                >
                  <button
                    type="button"
                    className="bilign-yansi-identity"
                    data-bilign-identity-role="primary"
                    data-testid="yansi-desktop-public-author"
                    onClick={() =>
                      router.push(authorProfilePath(activeNode.artifact.authorUserId))
                    }
                  >
                    <div className="bilign-yansi-identity__mark">
                      <div className="bilign-yansi-identity__avatar">
                        <BilignAvatarIdentityFrame variant="hero">
                          <ProfileUserAvatar
                            displayName={activeNode.authorDisplayName}
                            userId={activeNode.artifact.authorUserId}
                            avatarUrl={activeNode.authorAvatarUrl}
                            cacheBust={activeNode.authorAvatarRevision ?? undefined}
                            size="hero"
                            className="bilign-yansi-identity__face"
                          />
                        </BilignAvatarIdentityFrame>
                      </div>
                    </div>
                    <span className="bilign-yansi-identity__copy">
                      <span className="bilign-yansi-identity__name-row">
                        <span className="bilign-yansi-identity__name">
                          {activeNode.authorDisplayName}
                        </span>
                        {activeNode.authorHonorific ? (
                          <HonorificMarker
                            honorific={activeNode.authorHonorific}
                            testId="yansi-desktop-public-honorific"
                          />
                        ) : null}
                      </span>
                      {publicMetaTime || publicMetaType ? (
                        <p className="bilign-yansi-identity__meta" data-testid="yansi-desktop-public-meta">
                          {publicMetaTime ? (
                            <span data-testid="yansi-desktop-public-meta-time">{publicMetaTime}</span>
                          ) : null}
                          {publicMetaTime && publicMetaType ? (
                            <span className="bilign-yansi-identity__meta-sep" aria-hidden="true">
                              {' '}
                              ·{' '}
                            </span>
                          ) : null}
                          {publicMetaType ? (
                            <span data-testid="yansi-desktop-public-meta-type">{publicMetaType}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </span>
                  </button>
                </div>
              ) : null}
              {showChatReplay && !isDesktop ? (
                <h2
                  className="yansi-chat-title-heading font-semibold tracking-tight text-[#f5ead8]/90 text-[1.15rem] leading-snug"
                  data-testid="mirror-yansi-active-title"
                  data-slug={activeNode.artifact.slug}
                  data-yansi-active-identity={activeSlug}
                  data-yansi-depth-role="chat-heading"
                  data-yansi-title-authority="canonical"
                >
                  {title}
                </h2>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'yansi-reel-title-trigger w-full text-left font-semibold tracking-tight text-[#f5ead8]',
                    isDesktop && showChatReplay && 'yansi-desktop-chat-title yansi-chat-title-heading',
                    isDesktop && !showChatReplay && 'yansi-desktop-editorial-title',
                    !isDesktop && 'text-[1.35rem] leading-snug'
                  )}
                  data-testid="mirror-yansi-active-title"
                  data-slug={activeNode.artifact.slug}
                  data-yansi-active-identity={activeSlug}
                  data-yansi-depth-role={showChatReplay ? 'chat-heading' : undefined}
                  data-yansi-depth-trigger={showChatReplay ? undefined : 'chat'}
                  data-yansi-title-authority="canonical"
                  aria-label={showChatReplay ? title : `${title} — sohbete gir`}
                  onClick={showChatReplay ? undefined : openChatDepth}
                >
                  {title}
                </button>
              )}
              {activeNode.artifact.parentSlug && isDesktop && !showChatReplay ? (
                <AynaParentLineageRow
                  parentAuthorDisplayName={activeNode.parentAuthorDisplayName}
                  parentPublicTitle={activeNode.parentPublicTitle}
                  onOpenParent={() =>
                    router.push(
                      publicPathForSlug(activeNode.artifact.parentSlug!, {
                        mode: 'reel',
                      })
                    )
                  }
                />
              ) : null}
              {isDesktop ? (
                <div
                  className="yansi-desktop-detail-cluster"
                  data-testid="yansi-desktop-detail-cluster"
                >
                  <div
                    className="yansi-desktop-proof-row"
                    data-testid="yansi-desktop-proof-row"
                  >
                    <YansiPublicMetricsLine
                      slug={activeNode.artifact.slug}
                      journeyVersion={activeNode.artifact.journeyVersion}
                      variant="section"
                    />
                    {!showChatReplay && (activeNode.artifact.publicSummary || '').trim() ? (
                      <button
                        type="button"
                        className="yansi-desktop-detail-toggle"
                        data-testid="yansi-desktop-detail-toggle"
                        aria-expanded={detailOpen}
                        aria-controls="yansi-desktop-canonical-summary"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDetailOpen((open) => !open);
                        }}
                      >
                        {detailOpen ? YANSI_DETAIL_CLOSE : YANSI_DETAIL_OPEN}
                      </button>
                    ) : null}
                  </div>
                  {!showChatReplay && (activeNode.artifact.publicSummary || '').trim() ? (
                    <div
                      className="yansi-desktop-summary-slot"
                      data-testid="yansi-desktop-summary-slot"
                      data-open={detailOpen ? 'true' : 'false'}
                      aria-hidden={detailOpen ? undefined : true}
                    >
                      <div className="yansi-desktop-summary-slot__inner">
                        <p
                          id="yansi-desktop-canonical-summary"
                          className="yansi-desktop-canonical-summary"
                          data-testid="yansi-desktop-canonical-summary"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {(activeNode.artifact.publicSummary || '').trim()}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </header>
  );

  return (
    <div
      ref={chainRootRef}
      className={cn(
        'relative flex min-h-0 w-full flex-1 flex-col',
        !isDesktop && 'yansi-mobile-fullscreen',
        isDesktop && 'yansi-desktop-cinematic-stage',
        showChatReplay && 'yansi-chat-depth-active',
        className
      )}
      data-testid="mirror-yansi-chain"
      data-active-slug={activeSlug}
      data-discovery-index={session.activeIndex}
      data-discovery-length={session.history.length}
      data-mobile-yansi={!isDesktop ? 'true' : 'false'}
      data-yansi-public-depth={depth}
      data-yansi-katki-stage={isDesktop ? katki.stage : 'closed'}
      data-yansi-identity-slug={activeIdentity.slug}
      data-yansi-identity-generation={activeIdentity.generationId || undefined}
      data-yansi-identity-asset={activeIdentity.imageAssetId || undefined}
      data-yansi-identity-conversation={activeIdentity.sourceConversationId || undefined}
      data-yansi-reel-nav={reelNavLocked ? 'locked' : 'open'}
      data-yansi-reel-transition={reelTravel ? reelTravel.direction : 'idle'}
      data-yansi-incoming-slug={
        reelTravel ? reelTravel.incoming.artifact.slug.trim().toLowerCase() : undefined
      }
      data-yansi-reel-presentation={isDesktop ? 'desktop-immersive' : 'mobile-fullscreen'}
      tabIndex={isDesktop ? 0 : undefined}
      onKeyDown={onDesktopKeyDown}
      onWheel={onDesktopReelWheel}
      onPointerDown={onSwipePointerDown}
      onPointerUp={onSwipePointerUp}
      onPointerCancel={onSwipePointerCancel}
    >
      {desktopReelTravel ? (
        <div
          className="yansi-desktop-reel-viewport"
          data-testid="yansi-desktop-reel-viewport"
        >
          <YansiDesktopReelSurface
            key={(reelTravel ? reelTravel.outgoing : activeNode).artifact.slug}
            node={reelTravel ? reelTravel.outgoing : activeNode}
            role={reelTravel ? 'outgoing' : 'current'}
            direction={reelTravel?.direction ?? null}
            traveling={Boolean(reelTravel?.traveling)}
            reducedMotion={Boolean(reelTravel?.reducedMotion)}
            detailOpen={reelTravel ? false : detailOpen}
            onDetailToggle={
              reelTravel ? undefined : () => setDetailOpen((open) => !open)
            }
            onOpenChat={reelTravel ? undefined : openChatDepth}
            katkiSignal={
              reelTravel
                ? 'hidden'
                : katkiReelSignal(
                    katkiReadStatus,
                    katkiRead &&
                      katkiRead.slug === activeSlug &&
                      katkiRead.journeyVersion === presentedJourneyVersion
                      ? katkiRead.contentVisibleCount
                      : null
                  )
            }
            katkiCount={katkiSnapshot?.contentVisibleCount ?? 0}
            verifyCount={katkiSnapshot?.countsByType.verify ?? 0}
            verifiers={katkiSnapshot ? visibleVerifiers(katkiSnapshot.contributions) : []}
            viewerHasActiveVerify={Boolean(katkiSnapshot?.viewerHasActiveVerify)}
            verifyPending={verifyPending}
            onVerify={reelTravel ? undefined : () => void submitDirectVerify()}
            onOpenKatkiList={reelTravel ? undefined : openKatkiListFromReel}
            onOpenVerifiers={reelTravel ? undefined : openVerifiersFromReel}
          />
          {reelTravel ? (
            <YansiDesktopReelSurface
              key={reelTravel.incoming.artifact.slug}
              node={reelTravel.incoming}
              role="incoming"
              direction={reelTravel.direction}
              traveling={reelTravel.traveling}
              reducedMotion={reelTravel.reducedMotion}
            />
          ) : null}
        </div>
      ) : (
        <MirrorYansiSceneCrossfade
          sceneImageUrl={activeNode.artifact.sceneImageUrl}
          presentation={isDesktop ? 'desktop-immersive' : 'mobile-fullscreen'}
          activeIdentity={activeSlug}
        />
      )}
      {/* Readability veil — scene stays mounted; no brightness filter / no new asset. */}
      <div
        className={cn(
          'yansi-chat-scene-veil pointer-events-none absolute inset-0 z-[1]',
          showChatReplay ? 'yansi-chat-scene-veil--active' : 'yansi-chat-scene-veil--idle'
        )}
        data-testid="yansi-chat-scene-veil"
        aria-hidden
      />

      {renderDesktopReelChrome()}

      <YansiSocialPanelPresence>
        {isDesktop && katki.stage !== 'closed' ? (
          <YansiKatkiDepth
            key="contributions"
            slug={katki.slug}
            journeyVersion={katki.journeyVersion}
            read={katkiRead}
            readStatus={katkiReadStatus}
            readGeneration={katkiRequestGen.current}
            onReadChange={(next, generation) => {
              if (generation !== katkiRequestGen.current) return;
              if (next.slug !== activeSlug || next.journeyVersion !== presentedJourneyVersion) return;
              setKatkiRead(next);
              setKatkiReadStatus('ready');
            }}
            stage={katki.stage}
            selectedType={katki.selectedType}
            body={katki.body}
            sourceNote={katki.sourceNote}
            chooseFrom={katki.chooseFrom}
            onClose={() => setKatki(closeKatki())}
            onBack={() => setKatki((current) => escapeKatki(current))}
            onStartCreate={() => setKatki((current) => openKatkiTypeChoice(current))}
            onChooseType={(type) => setKatki((current) => selectKatkiType(current, type))}
            onChangeType={() => setKatki((current) => returnKatkiToTypeChoice(current))}
            onBodyChange={(value) => setKatki((current) => ({ ...current, body: value }))}
            onSourceChange={(value) =>
              setKatki((current) => ({ ...current, sourceNote: value }))
            }
            onSubmitted={() => setKatki(closeKatki())}
            onBeforeLeave={registerKatkiLeaveGuard}
            yansiIdentity={{ publicTitle: activeNode.artifact.publicTitle, sceneImageUrl: activeNode.artifact.sceneImageUrl }}
            onRequireAuth={onRequireAuth}
          />
        ) : null}

        {isDesktop && verifierOpen && katkiSnapshot ? (
          <YansiVerifierPanel
            key="verifiers"
            yansiIdentity={{ publicTitle: activeNode.artifact.publicTitle, sceneImageUrl: activeNode.artifact.sceneImageUrl }}
            count={katkiSnapshot.countsByType.verify}
            people={visibleVerifiers(katkiSnapshot.contributions)}
            onClose={() => setVerifierOpen(false)}
          />
        ) : null}

      </YansiSocialPanelPresence>

      {isDesktop && showChatReplay ? renderTitleBlock() : null}

      {!isDesktop ? (
        <header
          className="yansi-mobile-public-header"
          data-testid="yansi-mobile-public-header"
        >
          <div className="yansi-mobile-public-header__row">
            <button
              type="button"
              className="yansi-mobile-public-header__icon"
              aria-label="Keşfet'e dön"
              data-testid="yansi-mobile-public-menu"
              onClick={() => navigateBackFromYansiReel(router)}
            >
              <Menu size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="yansi-mobile-public-header__author"
              data-testid="yansi-mobile-public-author"
              onClick={() =>
                router.push(authorProfilePath(activeNode.artifact.authorUserId))
              }
            >
              <ProfileUserAvatar
                displayName={activeNode.authorDisplayName}
                userId={activeNode.artifact.authorUserId}
                avatarUrl={activeNode.authorAvatarUrl}
                cacheBust={activeNode.authorAvatarRevision ?? undefined}
                size="sm"
                className="yansi-mobile-public-header__avatar"
              />
              <span className="yansi-mobile-public-header__name">
                {activeNode.authorDisplayName}
              </span>
              {activeNode.authorHonorific ? (
                <HonorificMarker
                  honorific={activeNode.authorHonorific}
                  testId="yansi-mobile-public-honorific"
                />
              ) : null}
            </button>
            <div className="yansi-mobile-public-header__overflow">
              <button
                type="button"
                className="yansi-mobile-public-header__icon"
                aria-label="Daha fazla"
                data-testid="yansi-mobile-public-overflow"
                aria-expanded={overflowOpen}
                onClick={() => setOverflowOpen((v) => !v)}
              >
                <MoreHorizontal size={18} aria-hidden />
              </button>
              {overflowOpen ? (
                <div
                  className="yansi-mobile-public-header__menu"
                  data-testid="yansi-mobile-public-overflow-menu"
                >
                  <YansiSaveButton
                    slug={activeNode.artifact.slug}
                    authorUserId={activeNode.artifact.authorUserId}
                    onRequireAuth={onRequireAuth}
                  />
                  <YansiExperienceShareButton slug={activeNode.artifact.slug} />
                  <YansiTrustActions
                    slug={activeNode.artifact.slug}
                    authorUserId={activeNode.artifact.authorUserId}
                    className="pt-1"
                  />
                </div>
              ) : null}
            </div>
          </div>
          {publicMetaTime || publicMetaType ? (
              <p
                className="yansi-mobile-public-header__meta"
                data-testid="yansi-mobile-public-meta"
              >
                {publicMetaTime ? (
                  <span data-testid="yansi-mobile-public-meta-time">{publicMetaTime}</span>
                ) : null}
                {publicMetaTime && publicMetaType ? (
                  <span className="yansi-mobile-public-header__meta-sep" aria-hidden="true">
                    {' '}
                    ·{' '}
                  </span>
                ) : null}
                {publicMetaType ? (
                  <span data-testid="yansi-mobile-public-meta-type">{publicMetaType}</span>
                ) : null}
              </p>
            ) : null}
        </header>
      ) : null}

      <div
        ref={scrollRootRef}
        className={cn(
          'relative z-[2] flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-0 pb-8 yansi-mobile-scroll-root',
          showChatReplay && 'yansi-chat-scroll-root'
        )}
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
            className={cn(
              'flex flex-col scroll-mt-4',
              isDesktop ? 'h-full min-h-0' : 'min-h-[100dvh]',
              showChatReplay && 'yansi-chat-section'
            )}
          >
            {!isDesktop ? renderTitleBlock() : null}

            {showChatReplay ? (
              <div
                className={cn(
                  'yansi-chat-replay-layer min-h-0 flex-1',
                  isDesktop && 'yansi-desktop-conversation-lane'
                )}
                data-testid="yansi-chat-replay-layer"
                data-yansi-conversation-lane={isDesktop ? 'true' : undefined}
                data-yansi-chat-scroll="true"
                data-yansi-chat-reveal={chatReveal === 'idle' ? 'settled' : chatReveal}
              >
                <MirrorFrozenReplay
                  key={`${activeNode.artifact.slug}:${activeNode.artifact.journeyVersion}`}
                  artifact={activeNode.artifact}
                  className="min-h-0 flex-1 px-3"
                  continueLabel={YANSI_OWN_CONTINUATION_CTA}
                  chainEmbedded
                  onReplayProgress={handleReplayProgress}
                  onExploreAnotherCuriosity={exitChatDepth}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'yansi-reel-preview-spacer flex-1',
                  isDesktop ? 'hidden min-h-0' : 'min-h-[40dvh]'
                )}
                data-testid="yansi-reel-preview-body"
                aria-hidden
              />
            )}

            {/* REEL: no contextual Ayna/Audio slot. CHAT: Audio occupies Ayna-equivalent slot. */}
            {showChatReplay && !isDesktop && experienceSession?.speechSupported ? (
              <div
                className="yansi-public-audio-ayna-slot"
                data-testid="yansi-public-audio-ayna-slot"
                data-yansi-contextual-slot="audio"
              >
                <YansiMobileMinimalPlayer onOpenSheet={() => setAudioSheetOpen(true)} />
                <button
                  type="button"
                  className="yansi-public-audio-ayna-slot__btn"
                  data-testid="yansi-public-audio-slot-trigger"
                  data-active={experienceSession.audioOn ? 'true' : 'false'}
                  data-yansi-no-swipe="true"
                  aria-label="Sesli okuma"
                  aria-pressed={experienceSession.audioOn}
                  onClick={() => setAudioSheetOpen(true)}
                >
                  <Volume2 size={18} strokeWidth={1.6} aria-hidden />
                </button>
              </div>
            ) : null}

            {!showChatReplay && !isDesktop ? (
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
            ) : null}
          </section>
        </YansiExposureRoot>
      </div>

      {isDesktop && showChatReplay ? (
        <YansiExperienceControls
          showPlaybackControls
          activeIdentity={activeSlug}
          actions={reelActions}
        />
      ) : null}

      {!isDesktop ? (
        <YansiMobileAudioSheet open={audioSheetOpen} onClose={() => setAudioSheetOpen(false)} />
      ) : null}
    </div>
  );
}
