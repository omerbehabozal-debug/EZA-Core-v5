'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  MIRROR_REVEAL_DURATION_MS,
  PLUS_MIRROR_QUOTA_EXCEEDED_BODY,
  PLUS_MIRROR_QUOTA_EXCEEDED_TITLE,
} from '@/lib/eza/mirror/copy';
import {
  clearStaleDailyMirrorSnapshot,
  entriesForDisplayedMirror,
  hasNewDataSinceSnapshot,
  readTodaysSnapshot,
  resolveMirrorRefreshCta,
  saveDailyMirrorSnapshot,
  type MirrorRefreshCta,
} from '@/lib/eza/mirror/dailyMirrorSnapshot';
import {
  entriesForDisplayedConversationMirror,
  hasNewDataSinceConversationSnapshot,
  readConversationSnapshot,
  resolveConversationMirrorRefreshCta,
  saveConversationMirrorSnapshot,
} from '@/lib/eza/mirror/conversationMirrorSnapshot';
import {
  MIRROR_MIN_SAMPLES,
  type DailyMirrorCardModel,
  type MirrorSceneImageStatus,
  type MirrorStateMeta,
} from '@/lib/eza/mirror/types';
import { buildConversationMirrorState } from '@/lib/eza/mirror/buildConversationMirrorState';
import { mergeDailyCardSceneVisual, type DailyCardSceneVisualExtras } from '@/lib/eza/mirror/mirrorSceneImage';
import { withDevVehicleCueHints } from '@/lib/eza/mirror/mirrorIntentContext';
import { generateMirrorScene, MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
import {
  resolveMirrorSceneDisplayUrl,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/resolveMirrorSceneDisplayUrl';
import {
  resolveMirrorRenderMode,
  setDevRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';
import {
  isMockSceneImageUrl,
  probeHybridTypographyInImage,
} from '@/lib/eza/mirror/hybridPosterDebug';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import DailyMirrorSharePoster from '@/components/mirror/DailyMirrorSharePoster';
import DailyMirrorRefreshActions from '@/components/mirror/DailyMirrorRefreshActions';
import DailyLimitUpgrade from '@/components/mirror/DailyLimitUpgrade';
import DailyMirrorCreatePrompt from '@/components/mirror/DailyMirrorCreatePrompt';
import DailyMirrorReveal from '@/components/mirror/DailyMirrorReveal';
import DailyMirrorCardEntrance from '@/components/mirror/DailyMirrorCardEntrance';
import MirrorLoadingExperience from '@/components/mirror/MirrorLoadingExperience';
import DailyMirrorReadyFooter from '@/components/mirror/DailyMirrorReadyFooter';
import MirrorPosterLightbox from '@/components/mirror/MirrorPosterLightbox';
import MirrorShareExperience from '@/components/mirror/MirrorShareExperience';
import UpgradeModal from '@/components/plan/UpgradeModal';
import IdentityModal from '@/components/plan/IdentityModal';
import type { MirrorPanelCopy } from '@/lib/eza/mirror/resolveMirrorPanelCopy';
import {
  advanceStyleLensSession,
  clearStyleLensSession,
  createDefaultStyleLensSession,
  getStyleLensDisplayLabel,
  resetStyleLensSessionForCard,
  resolveLensForGeneration,
  resolveStyleLensSessionForCard,
  type MirrorStyleLensSession,
} from '@/lib/eza/mirror/mirrorSceneStyleLens';
import { applyStyleLensToVisual } from '@/lib/eza/mirror/styleLensPrompt';
import {
  clearMirrorSceneCacheForScope,
  readMirrorSceneCacheForScope,
  saveMirrorSceneCacheForScope,
} from '@/lib/eza/mirror/mirrorSceneCache';
import { purgeLegacyMirrorSceneCaches } from '@/lib/eza/mirror/conversationMirrorV3/mirrorSceneCacheMigration';
import { isV3MirrorCard } from '@/lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { canCreateVisualFromEntitlements } from '@/lib/eza/plan/sainaVisualQuota';
import {
  resolveVisualLimitMessage,
} from '@/lib/eza/plan/sainaQuotaMessages';
import { useAuth } from '@/context/AuthContext';
import { useMirrorCardExport } from '@/hooks/useMirrorCardExport';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_BIRTH_GENERATE_EVENT,
  trackMirrorCreated,
} from '@/lib/eza/mirror-birth/mirrorBirthAnalytics';
import { resolveMirrorPublishLineage } from '@/lib/eza/mirror-share/resolveMirrorPublishLineage';
import { markMirrorBirthMirrorCreated } from '@/lib/eza/mirror-birth/mirrorBirthSession';
import {
  readMirrorShareLink,
  saveMirrorShareLink,
} from '@/lib/eza/mirror-share/mirrorShareLinkCache';
import {
  applyShareUrlToCard,
  mergeCachedShareLinkIntoCard,
  publishMirrorToNetwork,
} from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { shouldSkipShareLinkPrepare } from '@/lib/eza/mirror-share/shareLinkPrepareIntent';
import type { MirrorShareLinkStatus } from '@/components/mirror/MirrorShareExperience';
import { markDiscoverMirrorCompletedForConversation } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import { setConversationSceneIdentity } from '@/lib/standaloneChatArchive';
import {
  trackMirrorShareOpened,
  trackMirrorShared,
} from '@/lib/eza/mirror-share/mirrorShareAnalytics';

type DailyMirrorStatus =
  | 'idle'
  | 'revealing'
  | 'ready'
  | 'insufficient'
  | 'daily_limit'
  | 'plus_limit'
  | 'error';

interface StandaloneObservationExperienceProps {
  entries: SavedBehavioralEntry[];
  /** Embedded in SAINA conversation mirror column. */
  embedded?: boolean;
  createButtonLabel?: string;
  mirrorPanelCopy?: MirrorPanelCopy;
  /** Active chat thread — Conversation Mirror scope (not daily aggregate). */
  conversationId?: string;
}

/** Ayna → Günlük Ayna görünümü (üst nav ve ortak kabuk artık mirror layout'ta). */
export default function StandaloneObservationExperience({
  entries,
  embedded = false,
  createButtonLabel,
  mirrorPanelCopy,
  conversationId,
}: StandaloneObservationExperienceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState<MirrorShareLinkStatus>('idle');
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [posterLightboxOpen, setPosterLightboxOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyMirrorStatus>('idle');
  const [generatedDailyCard, setGeneratedDailyCard] = useState<DailyMirrorCardModel | null>(
    null
  );
  const [generatedDailyMeta, setGeneratedDailyMeta] = useState<MirrorStateMeta | null>(null);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const [sceneImageStatus, setSceneImageStatus] = useState<MirrorSceneImageStatus>('idle');
  const [hybridTextFallback, setHybridTextFallback] = useState(false);
  const [sceneExtras, setSceneExtras] = useState<DailyCardSceneVisualExtras>({});
  const [mirrorRevision, setMirrorRevision] = useState(0);
  const [styleLensSession, setStyleLensSession] = useState<MirrorStyleLensSession>(() =>
    createDefaultStyleLensSession({ date: '', visual: undefined })
  );
  const sceneAutoKeyRef = useRef<string | null>(null);
  const sceneGenerationInFlightRef = useRef(false);
  const lastRawSceneUrlRef = useRef<string | null>(null);
  const hydratedFromSnapshotRef = useRef(false);
  const sceneDisplayBlobUrlRef = useRef<string | null>(null);
  const shareLinkInFlightRef = useRef(false);
  const mirrorExport = useMirrorCardExport();
  const { isAuthenticated, isAuthReady } = useAuth();
  const { isPlus, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements, refreshEntitlements } = useAccountEntitlements();

  const canCreateVisual = useMemo(
    () => canCreateVisualFromEntitlements(accountEntitlements),
    [accountEntitlements]
  );

  const hasProductionQuota = canCreateVisual;

  useEffect(() => {
    clearStaleDailyMirrorSnapshot();
  }, []);

  useEffect(() => {
    return () => {
      revokePosterObjectUrl(sceneDisplayBlobUrlRef.current);
      sceneDisplayBlobUrlRef.current = null;
    };
  }, []);

  const resolveSceneDisplayUrl = useCallback(
    async (rawUrl: string, card: DailyMirrorCardModel | null): Promise<string> => {
      const displayUrl = await resolveMirrorSceneDisplayUrl(rawUrl, card, {
        previousDisplayUrl: sceneDisplayBlobUrlRef.current,
      });
      if (displayUrl.startsWith('blob:')) {
        sceneDisplayBlobUrlRef.current = displayUrl;
      } else {
        revokePosterObjectUrl(sceneDisplayBlobUrlRef.current);
        sceneDisplayBlobUrlRef.current = null;
      }
      return displayUrl;
    },
    []
  );

  const hydrateSceneFromCache = useCallback(
    async (card: DailyMirrorCardModel, rawUrl: string, provider?: string) => {
      const displayUrl = await resolveSceneDisplayUrl(rawUrl, card);
      setSceneImageUrl(displayUrl);
      setSceneImageStatus('ready');
      setSceneExtras(provider ? { imageProvider: provider } : {});
      sceneAutoKeyRef.current = null;
      if (conversationId && isPersistableConversationSceneUrl(rawUrl)) {
        setConversationSceneIdentity(conversationId, {
          url: rawUrl,
          source: 'mirror_local',
        });
        markDiscoverMirrorCompletedForConversation(conversationId);
      }
    },
    [conversationId, resolveSceneDisplayUrl]
  );

  useEffect(() => {
    if (conversationId) {
      purgeLegacyMirrorSceneCaches();
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshPlan();
  }, [isAuthenticated, refreshPlan]);

  const panelCreateLabel =
    createButtonLabel ?? mirrorPanelCopy?.createButton;
  const panelOnboardingTitle = embedded ? mirrorPanelCopy?.emptyTitle : undefined;
  const panelOnboardingBody = embedded ? mirrorPanelCopy?.emptyBody : undefined;
  const panelGeneratingHeadline = embedded ? mirrorPanelCopy?.generating : undefined;
  const panelReadyHeadline = embedded ? mirrorPanelCopy?.ready : undefined;
  const isConversationScope = Boolean(conversationId);
  const mirrorBuildOptions = useMemo(
    () => (conversationId ? { conversationId } : undefined),
    [conversationId]
  );

  const conversationSnapshot = useMemo(
    () => (conversationId ? readConversationSnapshot(conversationId) : null),
    [conversationId, entries]
  );
  const todaysSnapshot = useMemo(
    () => (isConversationScope ? null : readTodaysSnapshot()),
    [entries, isConversationScope]
  );

  const refreshCta: MirrorRefreshCta = useMemo(() => {
    if (conversationId) {
      return resolveConversationMirrorRefreshCta(conversationId, entries);
    }
    return resolveMirrorRefreshCta(entries);
  }, [conversationId, entries, conversationSnapshot?.generatedAt, todaysSnapshot?.generatedAt]);

  const displayEntries = useMemo(() => {
    if (dailyStatus !== 'ready' && dailyStatus !== 'revealing') return entries;
    if (conversationId) {
      return entriesForDisplayedConversationMirror(entries, conversationSnapshot);
    }
    return entriesForDisplayedMirror(entries, todaysSnapshot);
  }, [entries, conversationSnapshot, todaysSnapshot, dailyStatus, conversationId]);

  const ms = standaloneSkin.mirrorSurface;

  useEffect(() => {
    hydratedFromSnapshotRef.current = false;
    sceneAutoKeyRef.current = null;
    setMirrorRevision(0);
    clearStyleLensSession();
    clearMirrorSceneCacheForScope(conversationId);
    setStyleLensSession(createDefaultStyleLensSession({ date: '', visual: undefined }));
    setGeneratedDailyCard(null);
    setGeneratedDailyMeta(null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('idle');
  }, [conversationId]);

  useEffect(() => {
    if (entries.length === 0) {
      hydratedFromSnapshotRef.current = false;
      sceneAutoKeyRef.current = null;
      setMirrorRevision(0);
      clearStyleLensSession();
      clearMirrorSceneCacheForScope(conversationId);
      setStyleLensSession(createDefaultStyleLensSession({ date: '', visual: undefined }));
      setGeneratedDailyCard(null);
      setGeneratedDailyMeta(null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setHybridTextFallback(false);
      setSceneExtras({});
      setDailyStatus('idle');
    }
  }, [entries.length, conversationId]);

  const resetGeneratedCardState = useCallback(() => {
    sceneAutoKeyRef.current = null;
    setMirrorRevision(0);
    clearStyleLensSession();
    clearMirrorSceneCacheForScope(conversationId);
    setStyleLensSession(createDefaultStyleLensSession({ date: '', visual: undefined }));
    setGeneratedDailyCard(null);
    setGeneratedDailyMeta(null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setShareLinkStatus('idle');
    setShareLinkError(null);
  }, [conversationId]);

  const prepareMirrorShareLink = useCallback(
    async (
      card: DailyMirrorCardModel,
      sceneUrl?: string | null,
      options?: { refreshScene?: boolean }
    ) => {
      if (!isAuthReady || !isAuthenticated) return;
      if (!card.mirrorV3Payload) return;
      if (shouldSkipShareLinkPrepare({ inFlight: shareLinkInFlightRef.current, refreshScene: options?.refreshScene })) {
        return;
      }

      if (card.mirrorShare?.shareUrl && !options?.refreshScene) {
        setShareLinkStatus('ready');
        setShareLinkError(null);
        return;
      }

      shareLinkInFlightRef.current = true;
      setShareLinkStatus('preparing');
      setShareLinkError(null);

      const rawScene =
        sceneUrl ??
        lastRawSceneUrlRef.current ??
        readMirrorSceneCacheForScope(conversationId, card)?.sceneImageUrl ??
        null;

      try {
        const result = await publishMirrorToNetwork({
          card,
          conversationId,
          sceneImageUrl: rawScene,
        });

        if (result.ok) {
          if (conversationId) {
            saveMirrorShareLink(conversationId, result.slug, result.shareUrl);
            const publishedScene =
              result.publicPayload.sceneImageUrl?.trim() ||
              rawScene?.trim() ||
              null;
            if (publishedScene && isPersistableConversationSceneUrl(publishedScene)) {
              setConversationSceneIdentity(conversationId, {
                url: publishedScene,
                source: 'mirror_network',
                slug: result.slug,
              });
            }
          }
          setGeneratedDailyCard((prev) =>
            prev ? applyShareUrlToCard(prev, result.shareUrl, result.slug) : prev
          );
          setShareLinkStatus('ready');
          setShareLinkError(null);
          return;
        }

        if (card.mirrorShare?.shareUrl && options?.refreshScene) {
          setShareLinkStatus('ready');
          return;
        }

        setShareLinkStatus('failed');
        setShareLinkError(result.message);
      } finally {
        shareLinkInFlightRef.current = false;
      }
    },
    [conversationId, isAuthReady, isAuthenticated]
  );

  const handleRetryShareLink = useCallback(() => {
    if (!generatedDailyCard) return;
    void prepareMirrorShareLink(generatedDailyCard);
  }, [generatedDailyCard, prepareMirrorShareLink]);

  const commitMirrorReady = useCallback(
    (sourceEntries: SavedBehavioralEntry[]) => {
      const state = buildConversationMirrorState(sourceEntries, mirrorBuildOptions);
      if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
        resetGeneratedCardState();
        setDailyStatus('insufficient');
        return false;
      }
      const cachedLink = conversationId ? readMirrorShareLink(conversationId) : null;
      const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
      setGeneratedDailyCard(card);
      setGeneratedDailyMeta(state.meta);
      setStyleLensSession(resetStyleLensSessionForCard(card));
      clearMirrorSceneCacheForScope(conversationId);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setHybridTextFallback(false);
      setSceneExtras({});
      setDailyStatus('ready');
      if (card.mirrorShare?.shareUrl) {
        setShareLinkStatus('ready');
        setShareLinkError(null);
      } else {
        setShareLinkStatus('idle');
        void prepareMirrorShareLink(card);
      }
      if (conversationId) {
        saveConversationMirrorSnapshot(
          conversationId,
          sourceEntries,
          card.date
        );
        markMirrorBirthMirrorCreated(conversationId);
        const lineage = resolveMirrorPublishLineage({
          conversationId,
          curiosityLineage: card.mirrorV3Payload?.curiosityBundle?.seed?.lineage,
          currentMirrorId: card.mirrorShare?.networkSlug ?? null,
        });
        trackMirrorCreated(conversationId, card.mirrorShare?.networkSlug ?? null, {
          parentMirrorId: lineage.parentMirrorId,
          rootMirrorId: lineage.rootMirrorId,
        });
      } else {
        saveDailyMirrorSnapshot(sourceEntries, card.date);
      }
      return true;
    },
    [
      conversationId,
      isPlus,
      mirrorBuildOptions,
      prepareMirrorShareLink,
      resetGeneratedCardState,
    ]
  );

  const runMirrorWithReveal = useCallback(
    (sourceEntries: SavedBehavioralEntry[], options?: { isUpdate?: boolean }) => {
      setDailyStatus('revealing');
      window.setTimeout(() => {
        try {
          if (options?.isUpdate) {
            sceneAutoKeyRef.current = null;
            setMirrorRevision((r) => r + 1);
          }
          const ok = commitMirrorReady(sourceEntries);
          if (!ok) {
            setDailyStatus('insufficient');
            return;
          }
        } catch {
          resetGeneratedCardState();
          setDailyStatus('error');
        }
      }, MIRROR_REVEAL_DURATION_MS);
    },
    [commitMirrorReady, resetGeneratedCardState]
  );

  const showExistingMirrorCard = useCallback(() => {
    const mirrorEntries = conversationId
      ? entriesForDisplayedConversationMirror(entries, conversationSnapshot)
      : entriesForDisplayedMirror(entries, todaysSnapshot);
    const state = buildConversationMirrorState(mirrorEntries, mirrorBuildOptions);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
      return false;
    }

    hydratedFromSnapshotRef.current = true;
    const cachedLink = conversationId ? readMirrorShareLink(conversationId) : null;
    const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
    setGeneratedDailyCard(card);
    setGeneratedDailyMeta(state.meta);
    setStyleLensSession(resolveStyleLensSessionForCard(card));
    setHybridTextFallback(false);
    if (card.mirrorShare?.shareUrl) {
      setShareLinkStatus('ready');
    } else {
      void prepareMirrorShareLink(card);
    }

    const sceneCache = readMirrorSceneCacheForScope(conversationId, card);
    if (sceneCache) {
      void hydrateSceneFromCache(card, sceneCache.sceneImageUrl, sceneCache.provider);
    } else {
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setSceneExtras({});
      sceneAutoKeyRef.current = null;
    }
    setDailyStatus('ready');
    return true;
  }, [
    conversationId,
    conversationSnapshot,
    entries,
    hydrateSceneFromCache,
    mirrorBuildOptions,
    prepareMirrorShareLink,
    todaysSnapshot,
  ]);

  /** Sayfa yenileme — bugünkü snapshot ile kartı sessizce göster; aynı veride sahne üretme. */
  useEffect(() => {
    if (hydratedFromSnapshotRef.current || generatedDailyCard) return;
    if (dailyStatus !== 'idle') return;
    if (refreshCta === 'open_first' || entries.length < MIRROR_MIN_SAMPLES) return;

    const mirrorEntries = conversationId
      ? entriesForDisplayedConversationMirror(entries, conversationSnapshot)
      : entriesForDisplayedMirror(entries, todaysSnapshot);
    const state = buildConversationMirrorState(mirrorEntries, mirrorBuildOptions);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;

    hydratedFromSnapshotRef.current = true;
    const cachedLink = conversationId ? readMirrorShareLink(conversationId) : null;
    const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
    setGeneratedDailyCard(card);
    setGeneratedDailyMeta(state.meta);
    setStyleLensSession(resolveStyleLensSessionForCard(card));
    setHybridTextFallback(false);
    if (card.mirrorShare?.shareUrl) {
      setShareLinkStatus('ready');
    } else {
      void prepareMirrorShareLink(card);
    }

    const sceneCache = readMirrorSceneCacheForScope(conversationId, card);
    if (sceneCache) {
      void hydrateSceneFromCache(card, sceneCache.sceneImageUrl, sceneCache.provider);
    } else {
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setSceneExtras({});
      sceneAutoKeyRef.current = null;
    }
    setDailyStatus('ready');
  }, [
    dailyStatus,
    entries,
    generatedDailyCard,
    refreshCta,
    conversationId,
    conversationSnapshot,
    todaysSnapshot,
    hydrateSceneFromCache,
    mirrorBuildOptions,
    prepareMirrorShareLink,
  ]);

  const cardForRender = useMemo(
    () =>
      generatedDailyCard
        ? mergeDailyCardSceneVisual(
            generatedDailyCard,
            sceneImageUrl,
            sceneImageStatus,
            sceneExtras
          )
        : null,
    [generatedDailyCard, sceneImageUrl, sceneImageStatus, sceneExtras]
  );

  const runHybridOcrProbe = useCallback(
    async (url: string) => {
      if (generatedDailyCard && isV3MirrorCard(generatedDailyCard)) return;

      const mode =
        generatedDailyCard?.visual?.renderMode ?? resolveMirrorRenderMode();
      if (mode !== 'hybrid_middle') return;

      if (isMockSceneImageUrl(url)) {
        setHybridTextFallback(true);
        setSceneExtras((prev) => ({
          ...prev,
          hybridOcrProbe: 'fail: mock_provider_image',
          hybridFallbackReason: 'mock_provider_image',
        }));
        return;
      }

      const probe = await probeHybridTypographyInImage(
        url,
        generatedDailyCard?.visual?.hybridTextPayload
      );
      const probeLabel = probe.ok ? `pass: ${probe.reason}` : `fail: ${probe.reason}`;
      setSceneExtras((prev) => ({ ...prev, hybridOcrProbe: probeLabel }));
      if (!probe.ok) {
        setHybridTextFallback(true);
        setSceneExtras((prev) => ({
          ...prev,
          hybridFallbackReason: probe.reason,
        }));
      }
    },
    [generatedDailyCard?.visual?.hybridTextPayload, generatedDailyCard?.visual?.renderMode]
  );

  const handleSceneImageLoad = useCallback(() => {
    if (sceneImageUrl) {
      setSceneImageStatus('ready');
      void runHybridOcrProbe(sceneImageUrl);
    }
  }, [sceneImageUrl, runHybridOcrProbe]);

  const handleSceneImageError = useCallback(() => {
    const raw = lastRawSceneUrlRef.current;
    if (raw && (!sceneImageUrl || sceneImageUrl.startsWith('blob:'))) {
      setSceneImageUrl(raw);
      setSceneImageStatus('ready');
      return;
    }
    setSceneImageStatus('error');
    setSceneImageUrl(null);
    clearMirrorSceneCacheForScope(conversationId);
    if (generatedDailyCard && isV3MirrorCard(generatedDailyCard)) return;
    const mode =
      generatedDailyCard?.visual?.renderMode ?? resolveMirrorRenderMode();
    if (mode === 'hybrid_middle') {
      setHybridTextFallback(true);
      setSceneExtras((prev) => ({
        ...prev,
        hybridFallbackReason: 'scene_image_load_error',
      }));
    }
  }, [conversationId, generatedDailyCard, sceneImageUrl]);

  const openUpgrade = useCallback((variant: 'upgrade' | 'auth' = 'upgrade') => {
    if (variant === 'auth') {
      setIdentityOpen(true);
      return;
    }
    setUpgradeOpen(true);
  }, []);

  const buildSceneAutoKey = useCallback(
    (card: DailyMirrorCardModel) =>
      `${card.date}:${card.visual?.intentFingerprint ?? ''}:${mirrorRevision}`,
    [mirrorRevision]
  );

  const handleGenerateMirrorScene = useCallback(
    async (sessionOverride?: MirrorStyleLensSession) => {
      if (sceneGenerationInFlightRef.current) return;
      if (sceneImageStatus === 'generating') return;
      if (!isAuthReady || !isAuthenticated) return;
      if (!generatedDailyCard?.visual) return;
      const visual = generatedDailyCard.visual;
      const autoKey = buildSceneAutoKey(generatedDailyCard);
      if (sceneAutoKeyRef.current === `${autoKey}:complete`) return;
      const session = sessionOverride ?? styleLensSession;
      const { lensId, variationIndex } = resolveLensForGeneration(isPlus, session);
      const visualForApi = applyStyleLensToVisual(visual, lensId, variationIndex);
      sceneGenerationInFlightRef.current = true;
      sceneAutoKeyRef.current = autoKey;
      setSceneImageStatus('generating');
      setSceneImageUrl(null);
      setHybridTextFallback(false);
      setSceneExtras({});
      try {
        const result = await generateMirrorScene(visualForApi, generatedDailyCard.date);
        lastRawSceneUrlRef.current = result.sceneImageUrl;
        const displayUrl = await resolveSceneDisplayUrl(
          result.sceneImageUrl,
          generatedDailyCard
        );
        setSceneImageUrl(displayUrl);
        setSceneImageStatus('ready');
        setSceneExtras({ imageProvider: result.provider });
        saveMirrorSceneCacheForScope(
          conversationId,
          generatedDailyCard,
          result.sceneImageUrl,
          result.provider
        );
        sceneAutoKeyRef.current = `${autoKey}:complete`;
        if (conversationId && isPersistableConversationSceneUrl(result.sceneImageUrl)) {
          setConversationSceneIdentity(conversationId, {
            url: result.sceneImageUrl,
            source: 'mirror_local',
          });
          markDiscoverMirrorCompletedForConversation(conversationId);
        }
        void prepareMirrorShareLink(generatedDailyCard, result.sceneImageUrl, {
          refreshScene: true,
        });
        void refreshEntitlements();
        if (
          !isV3MirrorCard(generatedDailyCard) &&
          (visual.renderMode ?? resolveMirrorRenderMode()) === 'hybrid_middle' &&
          isMockSceneImageUrl(result.sceneImageUrl)
        ) {
          setHybridTextFallback(true);
          setSceneExtras({
            imageProvider: result.provider,
            hybridOcrProbe: 'fail: mock_provider_image',
            hybridFallbackReason: 'mock_provider_image',
          });
        }
      } catch (err) {
        setSceneImageUrl(null);
        setSceneImageStatus('error');
        if (err instanceof MirrorSceneError) {
          if (err.code === 'auth_required') {
            sceneAutoKeyRef.current = null;
            setIdentityOpen(true);
          } else if (
            err.code === 'upgrade_required' ||
            err.code === 'visual_not_available_on_tier' ||
            err.code === 'visual_daily_limit_reached'
          ) {
            setUpgradeOpen(true);
            setDailyStatus('daily_limit');
          } else if (err.code === 'visual_cooldown_active') {
            sceneAutoKeyRef.current = `${autoKey}:cooldown`;
            setDailyStatus('plus_limit');
          } else if (err.code === 'rate_limit') {
            sceneAutoKeyRef.current = `${autoKey}:rate_limited`;
            setSceneExtras({ hybridFallbackReason: 'rate_limit' });
          } else if (err.code === 'openai_insufficient_quota') {
            sceneAutoKeyRef.current = `${autoKey}:quota`;
            setSceneExtras({ hybridFallbackReason: 'openai_quota' });
          } else if (err.code === 'generation_failed') {
            sceneAutoKeyRef.current = `${autoKey}:failed`;
          } else {
            sceneAutoKeyRef.current = `${autoKey}:failed`;
          }
        } else {
          sceneAutoKeyRef.current = null;
        }
        const mode = visual.renderMode ?? resolveMirrorRenderMode();
        if (!isV3MirrorCard(generatedDailyCard) && mode === 'hybrid_middle') {
          setHybridTextFallback(true);
          setSceneExtras({ hybridFallbackReason: 'generate_scene_api_error' });
        }
      } finally {
        sceneGenerationInFlightRef.current = false;
      }
    },
    [
      generatedDailyCard,
      conversationId,
      isAuthReady,
      isAuthenticated,
      isPlus,
      buildSceneAutoKey,
      prepareMirrorShareLink,
      resolveSceneDisplayUrl,
      sceneImageStatus,
      styleLensSession,
      refreshEntitlements,
    ]
  );

  /** Plus — aynı kart; sıradaki Style Lens ile sahne (snapshot / buildConversationMirrorState yok). */
  const handleNewMirrorScene = useCallback(() => {
    if (!isPlus) return;
    if (dailyStatus !== 'ready') return;
    if (!canCreateVisual) {
      setDailyStatus('plus_limit');
      return;
    }
    const nextSession = advanceStyleLensSession(styleLensSession);
    setStyleLensSession(nextSession);
    void handleGenerateMirrorScene(nextSession);
  }, [isPlus, dailyStatus, handleGenerateMirrorScene, styleLensSession, canCreateVisual]);

  const activeStyleLensLabel = useMemo(
    () => getStyleLensDisplayLabel(styleLensSession.selectedStyleLensId),
    [styleLensSession.selectedStyleLensId]
  );

  useEffect(() => {
    if (dailyStatus !== 'ready' || !generatedDailyCard) return;
    setStyleLensSession((prev) => {
      const resolved = resolveStyleLensSessionForCard(generatedDailyCard);
      if (
        prev.cardDate === resolved.cardDate &&
        prev.intentFingerprint === resolved.intentFingerprint &&
        prev.selectedStyleLensId === resolved.selectedStyleLensId
      ) {
        return prev;
      }
      return resolved;
    });
  }, [dailyStatus, generatedDailyCard, generatedDailyCard?.date, generatedDailyCard?.visual?.intentFingerprint]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) return;
    if (dailyStatus !== 'ready' || !generatedDailyCard?.visual?.prompt) return;
    if (sceneImageStatus !== 'idle') return;

    if (sceneAutoKeyRef.current?.endsWith(':hydrate')) {
      if (sceneImageUrl) return;
      sceneAutoKeyRef.current = null;
    }

    const autoKey = buildSceneAutoKey(generatedDailyCard);
    if (
      sceneAutoKeyRef.current === autoKey ||
      sceneAutoKeyRef.current === `${autoKey}:complete`
    ) {
      return;
    }
    void handleGenerateMirrorScene();
  }, [
    dailyStatus,
    generatedDailyCard,
    sceneImageStatus,
    mirrorRevision,
    isAuthReady,
    isAuthenticated,
    buildSceneAutoKey,
    handleGenerateMirrorScene,
  ]);

  const visualLimitStatus = useCallback((): 'daily_limit' | 'plus_limit' => {
    return accountEntitlements.usage.nextVisualAvailableAt ? 'plus_limit' : 'daily_limit';
  }, [accountEntitlements.usage.nextVisualAvailableAt]);

  const handleGenerateDailyMirror = useCallback(() => {
    if (entries.length < MIRROR_MIN_SAMPLES) {
      resetGeneratedCardState();
      setDailyStatus('insufficient');
      return;
    }

    if (conversationId) {
      const snap = readConversationSnapshot(conversationId);

      if (snap && hasNewDataSinceConversationSnapshot(entries, snap)) {
        if (!isPlus) {
          setDailyStatus('daily_limit');
          return;
        }
        if (!canCreateVisual) {
          setDailyStatus(visualLimitStatus());
          return;
        }
        runMirrorWithReveal(entries, { isUpdate: true });
        return;
      }

      if (snap && !hasNewDataSinceConversationSnapshot(entries, snap)) {
        if (!showExistingMirrorCard()) {
          runMirrorWithReveal(entries);
        }
        return;
      }

      if (!canCreateVisual) {
        setDailyStatus(visualLimitStatus());
        return;
      }

      runMirrorWithReveal(entries);
      return;
    }

    const snap = readTodaysSnapshot();

    if (snap && hasNewDataSinceSnapshot(entries, snap)) {
      if (!isPlus) {
        setDailyStatus('daily_limit');
        return;
      }
      if (!canCreateVisual) {
        setDailyStatus(visualLimitStatus());
        return;
      }
      runMirrorWithReveal(entries, { isUpdate: true });
      return;
    }

    if (snap && !hasNewDataSinceSnapshot(entries, snap)) {
      if (!showExistingMirrorCard()) {
        runMirrorWithReveal(entries);
      }
      return;
    }

    if (!canCreateVisual) {
      setDailyStatus(visualLimitStatus());
      return;
    }

    runMirrorWithReveal(entries);
  }, [
    conversationId,
    entries,
    isPlus,
    canCreateVisual,
    visualLimitStatus,
    resetGeneratedCardState,
    runMirrorWithReveal,
    showExistingMirrorCard,
  ]);

  useEffect(() => {
    if (!conversationId) return;

    const onMirrorBirthGenerate = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (detail?.conversationId !== conversationId) return;
      handleGenerateDailyMirror();
    };

    window.addEventListener(MIRROR_BIRTH_GENERATE_EVENT, onMirrorBirthGenerate);
    return () => window.removeEventListener(MIRROR_BIRTH_GENERATE_EVENT, onMirrorBirthGenerate);
  }, [conversationId, handleGenerateDailyMirror]);

  const handleMirrorRefresh = useCallback(() => {
    if (conversationId) {
      const snap = readConversationSnapshot(conversationId);
      if (!snap || !hasNewDataSinceConversationSnapshot(entries, snap)) return;

      if (!isPlus) {
        setDailyStatus('daily_limit');
        return;
      }

      if (!canCreateVisual) {
        setDailyStatus(visualLimitStatus());
        return;
      }

      if (entries.length < MIRROR_MIN_SAMPLES) return;
      runMirrorWithReveal(entries, { isUpdate: true });
      return;
    }

    const snap = readTodaysSnapshot();
    if (!snap || !hasNewDataSinceSnapshot(entries, snap)) return;

    if (!isPlus) {
      setDailyStatus('daily_limit');
      return;
    }

    if (!canCreateVisual) {
      setDailyStatus(visualLimitStatus());
      return;
    }

    if (entries.length < MIRROR_MIN_SAMPLES) return;
    runMirrorWithReveal(entries, { isUpdate: true });
  }, [conversationId, entries, isPlus, canCreateVisual, visualLimitStatus, runMirrorWithReveal]);

  const handleForceBmwMercedes = useCallback(() => {
    const boosted = withDevVehicleCueHints(entries);
    const state = buildConversationMirrorState(boosted, {
      seed: 'force-bmw-mercedes-dev',
      ...mirrorBuildOptions,
    });
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries, mirrorBuildOptions]);

  const handleToggleHybridMode = useCallback(() => {
    const next =
      resolveMirrorRenderMode() === 'hybrid_middle' ? 'scene_only' : 'hybrid_middle';
    setDevRenderMode(next);
    const state = buildConversationMirrorState(entries, mirrorBuildOptions);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries, mirrorBuildOptions]);

  const handleShareClose = useCallback(() => {
    setShareOpen(false);
    mirrorExport.reset();
  }, [mirrorExport]);

  const handleShareOpen = useCallback(() => {
    if (!isPlus) return;
    setShareOpen(true);
    trackMirrorShareOpened(
      generatedDailyCard?.mirrorShare?.networkSlug ?? conversationId ?? null,
      conversationId
    );
  }, [isPlus, generatedDailyCard, conversationId]);

  const handlePosterPreviewOpen = useCallback(() => {
    if (!sceneImageUrl?.trim()) return;
    setPosterLightboxOpen(true);
  }, [sceneImageUrl]);

  const handleShareCapture = useCallback(async () => {
    if (!isPlus) return;
    await mirrorExport.captureCard();
  }, [isPlus, mirrorExport]);

  const handleShareNative = useCallback(async () => {
    await mirrorExport.share(generatedDailyCard);
    trackMirrorShared(
      generatedDailyCard?.mirrorShare?.networkSlug ?? conversationId ?? null,
      conversationId
    );
  }, [mirrorExport, generatedDailyCard, conversationId]);

  const handleRetryMirrorScene = useCallback(() => {
    sceneAutoKeyRef.current = null;
    setSceneExtras({});
    void handleGenerateMirrorScene();
  }, [handleGenerateMirrorScene]);

  const isScenePosterVisible = useMemo(
    () =>
      dailyStatus === 'ready' &&
      Boolean(sceneImageUrl?.trim()) &&
      sceneImageStatus === 'ready',
    [dailyStatus, sceneImageUrl, sceneImageStatus]
  );

  const isSceneLoading = useMemo(() => {
    if (dailyStatus !== 'ready') return false;
    if (isScenePosterVisible) return false;
    if (sceneImageStatus === 'generating') return true;
    if (sceneImageStatus === 'error' && !sceneImageUrl?.trim()) return true;
    if (sceneImageStatus === 'idle') {
      if (!isAuthReady) return true;
      if (!isAuthenticated) return false;
      return true;
    }
    return false;
  }, [
    dailyStatus,
    isScenePosterVisible,
    sceneImageStatus,
    sceneImageUrl,
    isAuthReady,
    isAuthenticated,
  ]);

  const showShareAction =
    isPlus &&
    isScenePosterVisible &&
    generatedDailyCard !== null &&
    generatedDailyCard.shareEnabled;

  const showSceneLoginCta =
    !isAuthenticated &&
    dailyStatus === 'ready' &&
    !sceneImageUrl &&
    sceneImageStatus !== 'generating';

  const readyLoginCta =
    showSceneLoginCta ? (
      <DailyMirrorReadyFooter
        ephemeralNote=""
        loginOnly
        showLoginPrimary
        onLogin={() => openUpgrade('auth')}
      />
    ) : null;

  const readyRefreshCta: Exclude<MirrorRefreshCta, 'open_first'> =
    refreshCta === 'open_first' ? 'current' : refreshCta;

  const renderDailyPanel = () => {
    if (dailyStatus === 'revealing') {
      return <DailyMirrorReveal />;
    }

    if (dailyStatus === 'daily_limit') {
      return (
        <DailyLimitUpgrade
          onUpgrade={() => openUpgrade('upgrade')}
          onBack={() => setDailyStatus('idle')}
        />
      );
    }

    if (dailyStatus === 'plus_limit') {
      const cooldownMessage =
        accountEntitlements.usage.nextVisualAvailableAt != null
          ? resolveVisualLimitMessage({
              reason: 'visual_cooldown_active',
              nextVisualAvailableAt: accountEntitlements.usage.nextVisualAvailableAt,
            })
          : PLUS_MIRROR_QUOTA_EXCEEDED_BODY;
      return (
        <div className={cn(ms.dailyReadyStack, 'max-w-sm px-4 text-center')}>
          <h3 className="text-sm font-medium text-stone-800">{PLUS_MIRROR_QUOTA_EXCEEDED_TITLE}</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">{cooldownMessage}</p>
          <button
            type="button"
            className="mt-4 text-[11px] text-violet-700 underline"
            onClick={() => setDailyStatus('idle')}
          >
            Geri
          </button>
        </div>
      );
    }

    if (dailyStatus === 'ready' && cardForRender) {
      return (
        <div
          className={cn(
            ms.dailyReadyStack,
            isScenePosterVisible && ms.dailyReadyStackPoster,
            isSceneLoading && ms.dailyReadyStackLoading
          )}
        >
          {isSceneLoading ? (
            <MirrorLoadingExperience
              sceneImageStatus={sceneImageStatus}
              rateLimited={sceneExtras.hybridFallbackReason === 'rate_limit'}
              openaiQuota={sceneExtras.hybridFallbackReason === 'openai_quota'}
              onRetry={sceneImageStatus === 'error' ? handleRetryMirrorScene : undefined}
              generatingHeadline={panelGeneratingHeadline}
            />
          ) : isScenePosterVisible ? (
            <button
              type="button"
              className="saina-mirror-poster-preview-trigger"
              onClick={handlePosterPreviewOpen}
              aria-label="Aynayı tam boyutta gör"
            >
              {embedded ? (
                <span className="saina-mirror-preview-expand-hint" aria-hidden>
                  Büyüt
                </span>
              ) : null}
              <DailyMirrorCardEntrance
                className={cn(
                  ms.dailyPosterGlassFrame,
                  embedded ? 'saina-mirror-embedded-poster' : cn('w-full', ms.dailyPosterFrame)
                )}
              >
                <div ref={mirrorExport.cardRef} data-mirror-card className="w-full">
                  <DailyMirrorPosterCard
                    card={cardForRender}
                    entries={displayEntries}
                    meta={generatedDailyMeta ?? undefined}
                    embedded={embedded}
                    onSceneImageLoad={handleSceneImageLoad}
                    onSceneImageError={handleSceneImageError}
                    onForceBmwMercedes={handleForceBmwMercedes}
                    onToggleHybridMode={handleToggleHybridMode}
                    hybridTextFallback={hybridTextFallback}
                  />
                  {isPlus ? (
                    <div
                      className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] w-[432px] max-w-none opacity-100"
                      aria-hidden
                    >
                      <DailyMirrorSharePoster
                        card={cardForRender}
                        sceneImageUrl={cardForRender.visual?.sceneImageUrl}
                        sceneImageStatus={sceneImageStatus}
                        onSceneImageLoad={handleSceneImageLoad}
                        onSceneImageError={handleSceneImageError}
                      />
                    </div>
                  ) : null}
                </div>
              </DailyMirrorCardEntrance>
            </button>
          ) : (
            <DailyMirrorCardEntrance
              className={cn(
                embedded ? 'saina-mirror-embedded-poster' : cn('w-full', ms.dailyPosterFrame)
              )}
            >
              <div ref={mirrorExport.cardRef} data-mirror-card className="w-full">
                <DailyMirrorPosterCard
                  card={cardForRender}
                  entries={displayEntries}
                  meta={generatedDailyMeta ?? undefined}
                  embedded={embedded}
                  onSceneImageLoad={handleSceneImageLoad}
                  onSceneImageError={handleSceneImageError}
                  onForceBmwMercedes={handleForceBmwMercedes}
                  onToggleHybridMode={handleToggleHybridMode}
                  hybridTextFallback={hybridTextFallback}
                />
              </div>
            </DailyMirrorCardEntrance>
          )}

          {!isSceneLoading ? (
            <>
              {panelReadyHeadline ? (
                <p
                  className={cn(ms.sceneWrap, 'text-center text-[11px] font-medium text-stone-600')}
                  role="status"
                  data-testid="saina-mirror-ready-headline"
                >
                  {panelReadyHeadline}
                </p>
              ) : null}
              <DailyMirrorRefreshActions
              refreshCta={readyRefreshCta}
              isPlus={isPlus}
              cardReady={isScenePosterVisible}
              sceneImageStatus={sceneImageStatus}
              hasProductionQuota={hasProductionQuota}
              showShare={showShareAction}
              onShare={handleShareOpen}
              onUpdate={handleMirrorRefresh}
              onNewScene={handleNewMirrorScene}
              activeStyleLensLabel={isPlus ? activeStyleLensLabel : undefined}
              minimal={isScenePosterVisible}
            >
              {readyLoginCta}
            </DailyMirrorRefreshActions>
            </>
          ) : null}
        </div>
      );
    }

    if (refreshCta === 'current' && dailyStatus === 'idle') {
      return (
        <div className={ms.dailyReadyStack}>
          <DailyMirrorRefreshActions
            refreshCta="current"
            isPlus={isPlus}
            hasProductionQuota={hasProductionQuota}
            onUpdate={handleMirrorRefresh}
          />
        </div>
      );
    }

    const promptVariant: 'idle' | 'insufficient' | 'error' =
      dailyStatus === 'error'
        ? 'error'
        : dailyStatus === 'insufficient'
          ? 'insufficient'
          : 'idle';

    if (refreshCta === 'update' && dailyStatus === 'idle') {
      return (
        <div className={ms.dailyReadyStack}>
          <DailyMirrorRefreshActions
            refreshCta="update"
            isPlus={isPlus}
            hasProductionQuota={hasProductionQuota}
            onUpdate={handleMirrorRefresh}
          />
        </div>
      );
    }

    return (
      <DailyMirrorCreatePrompt
        variant={promptVariant}
        onGenerate={handleGenerateDailyMirror}
        buttonLabel={panelCreateLabel}
        onboardingTitle={panelOnboardingTitle}
        onboardingBody={panelOnboardingBody}
        compact={embedded}
        embedded={embedded}
        sampleCount={entries.length}
        minSamples={MIRROR_MIN_SAMPLES}
      />
    );
  };

  return (
    <>
      <div
        className={cn(
          ms.dailyStage,
          embedded && 'saina-mirror-embedded-stage',
          'overflow-x-hidden overflow-y-auto',
          dailyStatus === 'ready' && ms.dailyStageReady,
          dailyStatus === 'idle' ||
            dailyStatus === 'insufficient' ||
            dailyStatus === 'error' ||
            dailyStatus === 'daily_limit' ||
            dailyStatus === 'plus_limit'
            ? 'gap-0 py-0 sm:gap-0 sm:py-1'
            : undefined
        )}
      >
        {renderDailyPanel()}
      </div>

      <MirrorShareExperience
        open={shareOpen && isPlus}
        onClose={handleShareClose}
        card={generatedDailyCard}
        previewUrl={mirrorExport.previewUrl}
        loading={mirrorExport.loading}
        error={mirrorExport.error}
        shareLinkStatus={shareLinkStatus}
        shareLinkError={shareLinkError}
        impactSlug={
          shareLinkStatus === 'ready' ? generatedDailyCard?.mirrorShare?.networkSlug ?? null : null
        }
        onRetryShareLink={handleRetryShareLink}
        onCapture={handleShareCapture}
        onShare={handleShareNative}
        onCopyText={() => mirrorExport.copyText(generatedDailyCard)}
      />

      <MirrorPosterLightbox
        open={posterLightboxOpen}
        imageUrl={sceneImageUrl}
        title={generatedDailyCard?.dailyThemeTitle}
        onClose={() => setPosterLightboxOpen(false)}
      />

      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
      <UpgradeModal
        open={upgradeOpen}
        feature="mirror_scene_generate"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
