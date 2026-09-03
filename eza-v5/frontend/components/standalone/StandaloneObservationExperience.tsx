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
  hasPersistedConversationMirror,
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
  buildPrepareMessageDtos,
  prepareDirectorDraft,
} from '@/lib/eza/mirror/prepareDirectorDraftApi';
import { runFailClosedMirrorSceneGeneration } from '@/lib/eza/mirror/runFailClosedMirrorSceneGeneration';
import { logMirrorSceneLineage } from '@/lib/eza/mirror/d2SceneGenerationGuard';
import { getActiveConversationLiveMessages } from '@/lib/eza/mirror/activeConversationLiveMessages';
import { resolveMirrorBuildConversationTexts } from '@/lib/eza/mirror/collectConversationTextsForMirror';
import {
  resolveMirrorSceneDisplayUrl,
  revokePosterObjectUrl,
} from '@/lib/eza/mirror/resolveMirrorSceneDisplayUrl';
import { getChatArchive } from '@/lib/standaloneChatArchive';
import {
  resolveMirrorRenderMode,
  setDevRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';
import {
  isMockSceneImageUrl,
  probeHybridTypographyInImage,
} from '@/lib/eza/mirror/hybridPosterDebug';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import DailyMirrorRefreshActions from '@/components/mirror/DailyMirrorRefreshActions';
import MirrorPublicCard from '@/components/mirror/MirrorPublicCard';
import MirrorPublishShareActions from '@/components/mirror/MirrorPublishShareActions';
import DailyLimitUpgrade from '@/components/mirror/DailyLimitUpgrade';
import DailyMirrorCreatePrompt from '@/components/mirror/DailyMirrorCreatePrompt';
import DailyMirrorReveal from '@/components/mirror/DailyMirrorReveal';
import DailyMirrorCardEntrance from '@/components/mirror/DailyMirrorCardEntrance';
import MirrorLoadingExperience from '@/components/mirror/MirrorLoadingExperience';
import DailyMirrorReadyFooter from '@/components/mirror/DailyMirrorReadyFooter';
import MirrorPosterLightbox from '@/components/mirror/MirrorPosterLightbox';
import MirrorShareExperience from '@/components/mirror/MirrorShareExperience';
import {
  isMirrorJourneyV1ClientEnabled,
  loadActiveReview8Draft,
  resolveJourneyPublishContract,
  resolveScopedJourneyMeaning,
  canReuseMappedPromptForJourney,
  completeJourneyGenerationLineageSeal,
  listJourneyArtifactsForConversation,
  findReusablePreparedYansiArtifact,
  shouldSkipAynaSceneGeneration,
  subscribeMirrorJourneyArtifactStore,
  resolveJourneyArtifactShareIdentity,
  buildPublishCardFromArtifact,
  markMirrorJourneyArtifactPublished,
  markMirrorJourneyArtifactPublishFailed,
  markMirrorJourneyArtifactFailed,
  noteOwnerYansiSlugPublication,
  loadMirrorJourneyArtifact,
  resolveMirrorJourneySharePayload,
  buildShareCardFromJourneyPayload,
  publicPreviewFromJourneySharePayload,
  hydratePublishedJourneysFromServer,
  JOURNEY_AYNA_GENERATE_EVENT,
  readPendingJourneyAynaGeneration,
  consumePendingJourneyAynaGeneration,
  recoverPublishedJourneyAfterLostResponse,
  resolveJourneyOwnerKey,
  type JourneyAynaGenerateDetail,
  type MirrorJourneySharePayload,
} from '@/lib/eza/mirror/journey';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { persistAuthenticatedReadyYansi, captureYansiPreparationAuthority } from '@/lib/eza/mirror/journey/persistAuthenticatedReadyYansi';
import { hydrateYansiPreparationsFromServer } from '@/lib/eza/mirror/journey/hydrateYansiPreparationsFromServer';
import {
  getServerConversationAuthority,
  getServerIdForClientChat,
  noteServerYansiPublished,
} from '@/lib/eza/serverConversationStore';
import { linkServerYansiPreparationPublication } from '@/lib/eza/standaloneConversationsApi';
import AynaJourneyReel from '@/components/mirror/ayna/AynaJourneyReel';
import {
  authorProfilePath,
  parentChildrenPath,
} from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  MIRROR_AYNA_EMPTY_BODY,
  MIRROR_AYNA_EMPTY_TITLE,
} from '@/lib/eza/mirror/copy';
import type { AynaJourneySlideActions } from '@/components/mirror/ayna/AynaJourneySlide';
import UpgradeModal from '@/components/plan/UpgradeModal';
import IdentityModal from '@/components/plan/IdentityModal';
import type { MirrorPanelCopy } from '@/lib/eza/mirror/resolveMirrorPanelCopy';
import { useRouter } from 'next/navigation';
import { MIRROR_PUBLISHED_STATUS, MIRROR_SHARE_PUBLISH_CONSENT, MIRROR_SHARE_PUBLISH_CONSENT_CANCEL, MIRROR_SHARE_PUBLISH_CONSENT_CONFIRM } from '@/lib/eza/mirror/copy';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import {
  advanceStyleLensSession,
  clearStyleLensSession,
  createDefaultStyleLensSession,
  resetStyleLensSessionForCard,
  resolveLensForGeneration,
  resolveStyleLensSessionForCard,
  type MirrorStyleLensSession,
} from '@/lib/eza/mirror/mirrorSceneStyleLens';
import { withSceneVariationSeed } from '@/lib/eza/mirror/styleLensPrompt';
import { hasPinnedMappedMirrorPrompt } from '@/lib/eza/mirror/pinnedMappedMirrorPrompt';
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
  saveMirrorShareLinkForJourney,
} from '@/lib/eza/mirror-share/mirrorShareLinkCache';
import { isPublishableJourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import {
  applyShareUrlToCard,
  mergeCachedShareLinkIntoCard,
  publishMirrorToNetwork,
} from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { createAlignmentSceneRegenerator } from '@/lib/eza/mirror/narrativeAlignment';
import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import { shouldSkipShareLinkPrepare } from '@/lib/eza/mirror-share/shareLinkPrepareIntent';
import type { MirrorShareLinkStatus } from '@/components/mirror/MirrorShareExperience';
import { markDiscoverMirrorCompletedForConversation } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import {
  clearConversationSceneIdentity,
  setConversationSceneIdentity,
} from '@/lib/standaloneChatArchive';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import {
  shouldAutoGenerateMirrorScene,
  shouldHydrateExistingMirrorScene,
} from '@/lib/eza/mirror/shouldAutoGenerateMirrorScene';
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
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState<MirrorShareLinkStatus>('idle');
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishBusyJourneyId, setPublishBusyJourneyId] = useState<string | null>(
    null
  );
  const [shareBusyJourneyId, setShareBusyJourneyId] = useState<string | null>(null);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [shareTargetArtifact, setShareTargetArtifact] =
    useState<MirrorJourneyArtifact | null>(null);
  /** Phase 3.8.1 — frozen share session; identity never tracks live card while open. */
  const [shareSessionPayload, setShareSessionPayload] =
    useState<MirrorJourneySharePayload | null>(null);
  const [sharePublishConsentOpen, setSharePublishConsentOpen] = useState(false);
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
  const sceneRequestIdByAutoKeyRef = useRef<Map<string, string>>(new Map());
  /** Active generationId — accept scenes only when response matches this. */
  const activeGenerationIdRef = useRef<string | null>(null);
  /** Last generationId successfully bound at publish — for stale/supersede checks. */
  const lastPublishedGenerationIdRef = useRef<string | null>(null);
  const sceneGenerationInFlightRef = useRef(false);
  /** Same-instance Review→Ayna kick; resets on remount so pending can retry. */
  const journeyAynaKickKeyRef = useRef<string | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  /** Armed only by explicit create / update / retry / new-scene — blocks chat remount regen. */
  const allowAutoSceneGenerationRef = useRef(false);
  const lastRawSceneUrlRef = useRef<string | null>(null);
  const hydratedFromSnapshotRef = useRef(false);
  const sceneDisplayBlobUrlRef = useRef<string | null>(null);
  const shareLinkInFlightRef = useRef(false);
  const publishedLandingHydrateRef = useRef<string | null>(null);
  const mirrorExport = useMirrorCardExport();
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const shareCacheUserId = resolveJourneyOwnerKey(user?.user_id);
  const authenticatedUserId = user?.user_id?.trim() || null;
  const { isPlus, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements, refreshEntitlements } = useAccountEntitlements();

  const requireConfirmedReview8OrOpen = useCallback((): boolean => {
    if (!isMirrorJourneyV1ClientEnabled()) return true;
    if (!conversationId) return true;
    const ownerUserId = user?.user_id?.trim();
    if (!ownerUserId) {
      setIdentityOpen(true);
      return false;
    }
    const contract = resolveJourneyPublishContract({
      ownerUserId,
      conversationId,
      generationLineage: generatedDailyCard?.mirrorJourneyGenerationLineage,
    });
    if ('legacy' in contract && contract.ok) return true;
    if (contract.ok) return true;
    // Window decision + Review 8 live in chat — do not open Candidate Review here.
    setShareLinkError(
      contract.message ||
        'Önce sohbette 8 soruluk Yansı kararını verip onaylaman gerekir.'
    );
    return false;
  }, [conversationId, generatedDailyCard?.mirrorJourneyGenerationLineage, user?.user_id]);

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

  const clearChatBackgroundScene = useCallback((id: string | null | undefined) => {
    if (!id?.trim()) return;
    clearConversationSceneIdentity(id);
    // Chrome store drives SainaPersistentScene; clear immediately so create UX
    // does not keep showing the previous Mirror while the new one generates.
    useSainaChromeStore.getState().setChrome({ conversationSceneUrl: null });
  }, []);

  const hydrateSceneFromCache = useCallback(
    async (card: DailyMirrorCardModel, rawUrl: string, provider?: string) => {
      const displayUrl = await resolveSceneDisplayUrl(rawUrl, card);
      setSceneImageUrl(displayUrl);
      setSceneImageStatus('ready');
      setSceneExtras(provider ? { imageProvider: provider } : {});
      const fp = card.visual?.intentFingerprint ?? '';
      sceneAutoKeyRef.current = `${card.date}:${fp}:hydrate`;
      allowAutoSceneGenerationRef.current = false;
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
  const conversationTexts = useMemo(() => {
    if (!conversationId) return undefined;
    return resolveMirrorBuildConversationTexts({
      conversationId,
      getArchiveMessages: (id) => getChatArchive(id)?.messages ?? null,
      getLiveMessages: (id) => getActiveConversationLiveMessages(id),
    });
  }, [conversationId, entries.length]);
  const mirrorBuildOptions = useMemo(
    () =>
      conversationId
        ? {
            conversationId,
            ...(conversationTexts?.length ? { conversationTexts } : {}),
          }
        : undefined,
    [conversationId, conversationTexts]
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
    // Remount / reopen must NOT wipe scene cache — hydrate restores from cache/archive.
    // Cache clears only on explicit create/update/reset (runMirrorWithReveal, resetGeneratedCardState).
    hydratedFromSnapshotRef.current = false;
    sceneAutoKeyRef.current = null;
    allowAutoSceneGenerationRef.current = false;
    setMirrorRevision(0);
    clearStyleLensSession();
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
      allowAutoSceneGenerationRef.current = false;
      setMirrorRevision(0);
      clearStyleLensSession();
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
    allowAutoSceneGenerationRef.current = false;
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
    ): Promise<boolean> => {
      if (!isAuthReady || !isAuthenticated) {
        setShareLinkError('Yayınlamak için giriş yapmalısın.');
        return false;
      }
      if (!card.mirrorV3Payload && !card.mirrorFinalInterpretation) {
        setShareLinkError(
          'Yansı henüz yayına hazır değil. Sahneyi oluşturup tekrar dene.'
        );
        return false;
      }
      if (shouldSkipShareLinkPrepare({ inFlight: shareLinkInFlightRef.current, refreshScene: options?.refreshScene })) {
        return Boolean(card.mirrorShare?.shareUrl);
      }

      if (card.mirrorShare?.shareUrl && !options?.refreshScene) {
        setShareLinkStatus('ready');
        setShareLinkError(null);
        return true;
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
        const { variationIndex } = resolveLensForGeneration(isPlus, styleLensSession);
        const result = await publishMirrorToNetwork({
          card,
          conversationId,
          ownerUserId: user?.user_id ?? null,
          sceneImageUrl: rawScene,
          generationId: activeGenerationIdRef.current ?? undefined,
          generationAcceptedAt: Date.now(),
          forceRepublish: Boolean(options?.refreshScene),
          replacesGenerationId:
            lastPublishedGenerationIdRef.current &&
            activeGenerationIdRef.current &&
            lastPublishedGenerationIdRef.current !== activeGenerationIdRef.current
              ? lastPublishedGenerationIdRef.current
              : undefined,
          // Narrative Alignment Phase 1 — FAIL → one regenerate → recheck → publish/block.
          narrativeAlignment: rawScene
            ? {
                regenerateScene: createAlignmentSceneRegenerator({
                  card,
                  conversationId,
                  generationId: activeGenerationIdRef.current,
                  variationIndex,
                  onSceneReady: async (sceneImageUrl) => {
                    lastRawSceneUrlRef.current = sceneImageUrl;
                    const displayUrl = await resolveSceneDisplayUrl(sceneImageUrl, card);
                    setSceneImageUrl(displayUrl);
                    saveMirrorSceneCacheForScope(conversationId, card, sceneImageUrl);
                    if (
                      conversationId &&
                      isPersistableConversationSceneUrl(sceneImageUrl)
                    ) {
                      setConversationSceneIdentity(conversationId, {
                        url: sceneImageUrl,
                        source: 'mirror_local',
                      });
                    }
                  },
                }),
              }
            : undefined,
        });

        if (result.ok) {
          if (activeGenerationIdRef.current) {
            lastPublishedGenerationIdRef.current = activeGenerationIdRef.current;
          }
          // Prefer gate-accepted scene (may be retry URL).
          if (result.lineage?.sceneAssetId || result.publicPayload.sceneImageUrl) {
            const publishedScene =
              result.publicPayload.sceneImageUrl?.trim() ||
              lastRawSceneUrlRef.current ||
              rawScene;
            if (publishedScene) {
              lastRawSceneUrlRef.current = publishedScene;
            }
          }
          const landing = {
            publicTitle:
              result.publicPayload.publicTitle?.trim() ||
              result.publicPayload.cardTitle?.trim() ||
              null,
            publicSummary:
              result.publicPayload.publicSummary?.trim() ||
              result.publicPayload.curiosityContext?.trim() ||
              result.publicPayload.landingContext?.trim() ||
              null,
          };
          if (conversationId) {
            saveMirrorShareLink(
              conversationId,
              result.slug,
              result.shareUrl,
              shareCacheUserId,
              new Date(),
              landing
            );
            const lineage = card.mirrorJourneyGenerationLineage;
            if (shareCacheUserId && result.slug) {
              if (isPublishableJourneyGenerationLineage(lineage)) {
                saveMirrorShareLinkForJourney({
                  userId: shareCacheUserId,
                  conversationId,
                  journeyId: lineage.journeyId,
                  journeyVersion: lineage.journeyVersion,
                  slug: result.slug,
                  shareUrl: result.shareUrl,
                  publicTitle: landing.publicTitle,
                  publicSummary: landing.publicSummary,
                });
                markMirrorJourneyArtifactPublished(shareCacheUserId, {
                  journeyId: lineage.journeyId,
                  journeyVersion: lineage.journeyVersion,
                  slug: result.slug,
                  shareUrl: result.shareUrl,
                  publicTitle: landing.publicTitle,
                  publicSummary: landing.publicSummary,
                  continuationContext:
                    card.mirrorV3Payload?.curiosityBundle?.publicLanding?.continuationContext?.trim() ||
                    null,
                  sceneImageUrl:
                    result.publicPayload.sceneImageUrl?.trim() ||
                    lastRawSceneUrlRef.current?.trim() ||
                    rawScene?.trim() ||
                    null,
                });
              } else {
                const ready = findReusablePreparedYansiArtifact(
                  listJourneyArtifactsForConversation(
                    shareCacheUserId,
                    conversationId
                  )
                );
                if (ready) {
                  markMirrorJourneyArtifactPublished(shareCacheUserId, {
                    journeyId: ready.journeyId,
                    journeyVersion: ready.journeyVersion,
                    slug: result.slug,
                    shareUrl: result.shareUrl,
                    publicTitle: landing.publicTitle,
                    publicSummary: landing.publicSummary,
                    continuationContext:
                      card.mirrorV3Payload?.curiosityBundle?.publicLanding?.continuationContext?.trim() ||
                      null,
                    sceneImageUrl:
                      result.publicPayload.sceneImageUrl?.trim() ||
                      lastRawSceneUrlRef.current?.trim() ||
                      rawScene?.trim() ||
                      null,
                  });
                }
              }
              noteOwnerYansiSlugPublication(result.slug, {
                visibility: 'public',
                safetyStatus: 'open',
              });
              const serverConvId = getServerIdForClientChat(conversationId);
              if (serverConvId) {
                const journeyId =
                  (isPublishableJourneyGenerationLineage(lineage)
                    ? lineage.journeyId
                    : null) ||
                  findReusablePreparedYansiArtifact(
                    listJourneyArtifactsForConversation(shareCacheUserId, conversationId)
                  )?.journeyId;
                void linkServerYansiPreparationPublication(serverConvId, {
                  slug: result.slug,
                  ...(journeyId
                    ? {
                        journeyId,
                        journeyVersion: isPublishableJourneyGenerationLineage(lineage)
                          ? lineage.journeyVersion
                          : 1,
                      }
                    : {}),
                }).catch(() => undefined);
                noteServerYansiPublished(conversationId, result.slug);
              }
            }
            const publishedScene =
              result.publicPayload.sceneImageUrl?.trim() ||
              lastRawSceneUrlRef.current?.trim() ||
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
            prev
              ? applyShareUrlToCard(prev, result.shareUrl, result.slug, landing)
              : prev
          );
          setShareLinkStatus('ready');
          setShareLinkError(null);
          return true;
        }

        // Phase 8.6 — never treat prior local shareUrl as publish success after a failed attempt.
        // Lost HTTP response: recover from durable owner published-journeys.
        const failedLineage = card.mirrorJourneyGenerationLineage;
        if (
          shareCacheUserId &&
          conversationId &&
          isPublishableJourneyGenerationLineage(failedLineage)
        ) {
          const recovered = await recoverPublishedJourneyAfterLostResponse({
            ownerUserId: shareCacheUserId,
            conversationId,
            journeyId: failedLineage.journeyId,
            journeyVersion: failedLineage.journeyVersion,
          });
          if (recovered.recovered && recovered.item?.slug) {
            const shareUrl =
              recovered.artifact?.publish.shareUrl ||
              `/m/${recovered.item.slug}`;
            saveMirrorShareLink(
              conversationId,
              recovered.item.slug,
              shareUrl,
              shareCacheUserId,
              new Date(),
              {
                publicTitle: recovered.item.publicTitle ?? null,
                publicSummary: recovered.item.publicSummary ?? null,
              }
            );
            setGeneratedDailyCard((prev) =>
              prev
                ? applyShareUrlToCard(prev, shareUrl, recovered.item!.slug, {
                    publicTitle: recovered.item!.publicTitle ?? null,
                    publicSummary: recovered.item!.publicSummary ?? null,
                  })
                : prev
            );
            setShareLinkStatus('ready');
            setShareLinkError(null);
            setArtifactRevision((n) => n + 1);
            return true;
          }
          markMirrorJourneyArtifactPublishFailed(shareCacheUserId, {
            journeyId: failedLineage.journeyId,
            journeyVersion: failedLineage.journeyVersion,
            message: result.message || 'publish_failed',
          });
        }
        setShareLinkStatus('failed');
        setShareLinkError(result.message);
        return false;
      } finally {
        shareLinkInFlightRef.current = false;
      }
    },
    [
      conversationId,
      isAuthReady,
      isAuthenticated,
      shareCacheUserId,
      isPlus,
      styleLensSession,
      resolveSceneDisplayUrl,
      user?.user_id,
    ]
  );

  const handleRetryShareLink = useCallback(() => {
    if (!generatedDailyCard) return;
    if (!requireConfirmedReview8OrOpen()) return;
    void prepareMirrorShareLink(generatedDailyCard);
  }, [generatedDailyCard, prepareMirrorShareLink, requireConfirmedReview8OrOpen]);

  const commitMirrorReady = useCallback(
    (sourceEntries: SavedBehavioralEntry[]) => {
      const state = buildConversationMirrorState(sourceEntries, mirrorBuildOptions);
      if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
        resetGeneratedCardState();
        setDailyStatus('insufficient');
        return false;
      }
      const cachedLink =
        conversationId && shareCacheUserId
          ? readMirrorShareLink(conversationId, shareCacheUserId)
          : null;
      const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
      allowAutoSceneGenerationRef.current = true;
      clearChatBackgroundScene(conversationId);
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
        // Defer network publish until scene exists (avoids double publish + chat-time spam).
        setShareLinkStatus('idle');
        setShareLinkError(null);
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
      clearChatBackgroundScene,
      conversationId,
      isPlus,
      mirrorBuildOptions,
      resetGeneratedCardState,
      shareCacheUserId,
    ]
  );

  const runMirrorWithReveal = useCallback(
    (sourceEntries: SavedBehavioralEntry[], options?: { isUpdate?: boolean; immediate?: boolean }) => {
      // Drop stale chat background + cache immediately so create/update UX
      // never shows the previous Mirror while the new one is generating.
      clearChatBackgroundScene(conversationId);
      clearMirrorSceneCacheForScope(conversationId);
      allowAutoSceneGenerationRef.current = true;
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setSceneExtras({});

      const commit = () => {
        try {
          if (options?.isUpdate) {
            sceneAutoKeyRef.current = null;
            setMirrorRevision((r) => r + 1);
          }
          const ok = commitMirrorReady(sourceEntries);
          if (!ok) {
            setDailyStatus('insufficient');
          }
        } catch {
          resetGeneratedCardState();
          setDailyStatus('error');
        }
      };

      if (revealTimeoutRef.current != null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }

      if (options?.immediate) {
        commit();
        return;
      }

      setDailyStatus('revealing');
      revealTimeoutRef.current = window.setTimeout(() => {
        revealTimeoutRef.current = null;
        commit();
      }, MIRROR_REVEAL_DURATION_MS);
    },
    [clearChatBackgroundScene, commitMirrorReady, conversationId, resetGeneratedCardState]
  );

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current != null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, []);

  const showExistingMirrorCard = useCallback(() => {
    const mirrorEntries = conversationId
      ? entriesForDisplayedConversationMirror(entries, conversationSnapshot)
      : entriesForDisplayedMirror(entries, todaysSnapshot);
    const state = buildConversationMirrorState(mirrorEntries, mirrorBuildOptions);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
      return false;
    }

    hydratedFromSnapshotRef.current = true;
    const cachedLink =
      conversationId && shareCacheUserId
        ? readMirrorShareLink(conversationId, shareCacheUserId)
        : null;
    const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
    setGeneratedDailyCard(card);
    setGeneratedDailyMeta(state.meta);
    setStyleLensSession(resolveStyleLensSessionForCard(card));
    setHybridTextFallback(false);
    if (card.mirrorShare?.shareUrl) {
      setShareLinkStatus('ready');
    } else {
      setShareLinkStatus('idle');
    }

    const sceneCache = readMirrorSceneCacheForScope(conversationId, card);
    const archiveUrl = conversationId
      ? getChatArchive(conversationId)?.conversationSceneUrl?.trim() || null
      : null;
    const archiveScene =
      archiveUrl && isPersistableConversationSceneUrl(archiveUrl) ? archiveUrl : null;
    const existingScene = sceneCache?.sceneImageUrl ?? archiveScene;

    if (existingScene) {
      allowAutoSceneGenerationRef.current = false;
      void hydrateSceneFromCache(card, existingScene, sceneCache?.provider);
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
    shareCacheUserId,
    todaysSnapshot,
  ]);

  /** Sayfa yenileme — bugünkü snapshot ile kartı sessizce göster; aynı veride sahne üretme. */
  useEffect(() => {
    if (hydratedFromSnapshotRef.current || generatedDailyCard) return;
    if (dailyStatus !== 'idle') return;
    const persisted =
      Boolean(conversationId) && hasPersistedConversationMirror(conversationId!);
    // Keşfet → sohbet: snapshot may lag; archive/cache still counts as existing Mirror.
    if ((refreshCta === 'open_first' && !persisted) || entries.length < MIRROR_MIN_SAMPLES) {
      return;
    }

    const mirrorEntries = conversationId
      ? entriesForDisplayedConversationMirror(entries, conversationSnapshot)
      : entriesForDisplayedMirror(entries, todaysSnapshot);
    const state = buildConversationMirrorState(mirrorEntries, mirrorBuildOptions);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;

    hydratedFromSnapshotRef.current = true;
    const cachedLink =
      conversationId && shareCacheUserId
        ? readMirrorShareLink(conversationId, shareCacheUserId)
        : null;
    const card = mergeCachedShareLinkIntoCard(state.dailyMirrorCard, cachedLink);
    setGeneratedDailyCard(card);
    setGeneratedDailyMeta(state.meta);
    setStyleLensSession(resolveStyleLensSessionForCard(card));
    setHybridTextFallback(false);
    if (card.mirrorShare?.shareUrl) {
      setShareLinkStatus('ready');
    } else {
      setShareLinkStatus('idle');
    }

    const sceneCache = readMirrorSceneCacheForScope(conversationId, card);
    const archiveUrl = conversationId
      ? getChatArchive(conversationId)?.conversationSceneUrl?.trim() || null
      : null;
    const archiveScene =
      archiveUrl && isPersistableConversationSceneUrl(archiveUrl) ? archiveUrl : null;
    const existingScene = sceneCache?.sceneImageUrl ?? archiveScene;

    if (
      existingScene &&
      shouldHydrateExistingMirrorScene({
        allowAuto: allowAutoSceneGenerationRef.current,
        existingPersistableSceneUrl: existingScene,
      })
    ) {
      allowAutoSceneGenerationRef.current = false;
      void hydrateSceneFromCache(card, existingScene, sceneCache?.provider);
    } else if (sceneCache) {
      void hydrateSceneFromCache(card, sceneCache.sceneImageUrl, sceneCache.provider);
    } else if (archiveScene) {
      allowAutoSceneGenerationRef.current = false;
      void hydrateSceneFromCache(card, archiveScene, undefined);
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
    shareCacheUserId,
  ]);

  /** current + idle fallback — force hydrate if the silent effect missed a remount race. */
  useEffect(() => {
    if (refreshCta !== 'current' || dailyStatus !== 'idle') return;
    if (hydratedFromSnapshotRef.current || generatedDailyCard) return;
    if (entries.length < MIRROR_MIN_SAMPLES) return;
    showExistingMirrorCard();
  }, [refreshCta, dailyStatus, generatedDailyCard, entries.length, showExistingMirrorCard]);

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

  const createSceneGenerationId = useCallback(() => {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `scene-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  const handleGenerateMirrorScene = useCallback(
    async (
      sessionOverride?: MirrorStyleLensSession,
      options?: { reuseMappedPrompt?: boolean }
    ) => {
      if (sceneGenerationInFlightRef.current) return;
      if (sceneImageStatus === 'generating') return;
      if (!isAuthReady) return;
      if (!canCreateVisual) return;
      if (!generatedDailyCard?.visual) return;
      let cardForScene = generatedDailyCard;
      const autoKey = buildSceneAutoKey(cardForScene);
      if (sceneAutoKeyRef.current === `${autoKey}:complete`) return;
      const session = sessionOverride ?? styleLensSession;
      const { variationIndex } = resolveLensForGeneration(isPlus, session);

      // New generationId per attempt — cancel/ignore prior in-flight by id mismatch.
      const generationRequestId = createSceneGenerationId();
      sceneRequestIdByAutoKeyRef.current.set(autoKey, generationRequestId);
      activeGenerationIdRef.current = generationRequestId;
      const boundOwnerAtStart = shareCacheUserId;
      const boundPersist = captureYansiPreparationAuthority(authenticatedUserId);

      sceneGenerationInFlightRef.current = true;
      sceneAutoKeyRef.current = autoKey;
      if (conversationId) {
        consumePendingJourneyAynaGeneration(conversationId);
      }
      setSceneImageStatus('generating');
      setSceneImageUrl(null);
      setHybridTextFallback(false);
      setSceneExtras({});

      logMirrorSceneLineage('generation_start', {
        generationId: generationRequestId,
        conversationId,
        generationPipeline: 'D2_V5',
        prepareAttempt: 0,
        prepareSucceeded: false,
      });

      try {
        const reuseMappedPromptRequested =
          Boolean(options?.reuseMappedPrompt) &&
          hasPinnedMappedMirrorPrompt(cardForScene);

        let shouldPrepare = false;
        let prepareMessages: ReturnType<typeof buildPrepareMessageDtos> = [];
        let archiveTitle: string | undefined;
        let journeySemanticScope:
          | import('@/lib/eza/mirror/journey').JourneySemanticScopePayload
          | undefined;
        let reuseMappedPrompt = reuseMappedPromptRequested;

        if (conversationId) {
          const archive = getChatArchive(conversationId);
          archiveTitle = archive?.title;

          // Scoped prepare is fail-closed behind Journey V1 identity. Invitation
          // can run with that flag off — use the same full-conversation prepare
          // as the Ayna CTA so client hashes cannot 422 the scene birth.
          const ownerId = shareCacheUserId;
          const draft = ownerId
            ? loadActiveReview8Draft(ownerId, conversationId)
            : null;
          const scoped = resolveScopedJourneyMeaning(draft);
          if (isMirrorJourneyV1ClientEnabled()) {
            if (!scoped.ok) {
              throw new MirrorSceneError(
                scoped.message || 'Yansı anlam kapsamı geçersiz.',
                scoped.code
              );
            }
            reuseMappedPrompt =
              reuseMappedPromptRequested &&
              canReuseMappedPromptForJourney({
                card: cardForScene,
                scope: scoped.scope,
              });
            if (!reuseMappedPrompt) {
              prepareMessages = scoped.messages;
              journeySemanticScope = scoped.scope;
              shouldPrepare = true;
            }
          } else if (!reuseMappedPrompt) {
            const live = getActiveConversationLiveMessages(conversationId);
            const merged = [
              ...(archive?.messages ?? []),
              ...live.filter(
                (m) => !(archive?.messages ?? []).some((a) => a.id === m.id)
              ),
            ];
            prepareMessages = buildPrepareMessageDtos(merged);
            shouldPrepare = prepareMessages.some((m) => m.role === 'user');
          }
        }

        // Defer React card update until after scene completes — avoids autoKey churn mid-flight.
        const outcome = await runFailClosedMirrorSceneGeneration({
          generationId: generationRequestId,
          conversationId,
          card: cardForScene,
          reuseMappedPrompt,
          shouldPrepare,
          // Conversation Mirror is D2; daily aggregate remains explicit LEGACY until migrated.
          generationPipeline: conversationId ? 'D2_V5' : 'LEGACY_V3',
          isGenerationStillActive: (id) => activeGenerationIdRef.current === id,
          prepare: async () => {
            const runPrepare = (scope?: typeof journeySemanticScope) =>
              prepareDirectorDraft({
                conversationId: conversationId!,
                generationRequestId,
                messages: scope ? prepareMessages : (() => {
                  const archiveMessages = getChatArchive(conversationId!)?.messages ?? [];
                  const live = getActiveConversationLiveMessages(conversationId!);
                  const merged = [
                    ...archiveMessages,
                    ...live.filter(
                      (m) => !archiveMessages.some((a) => a.id === m.id)
                    ),
                  ];
                  return buildPrepareMessageDtos(merged);
                })(),
                ...(scope
                  ? {
                      journeySemanticScope: {
                        semanticScope: scope.semanticScope,
                        journeyId: scope.journeyId,
                        journeyVersion: scope.journeyVersion,
                        sourceConversationId: scope.sourceConversationId,
                        parentJourneyId: scope.parentJourneyId,
                        windowIndex: scope.windowIndex,
                        windowStart: scope.windowStart,
                        windowEnd: scope.windowEnd,
                        blockIndex: scope.blockIndex,
                        blockStart: scope.blockStart,
                        blockEnd: scope.blockEnd,
                        selectedSteps: scope.selectedSteps,
                        sourceBlockSteps: scope.sourceBlockSteps,
                      },
                    }
                  : { title: archiveTitle }),
              });

            let prepared;
            try {
              prepared = await runPrepare(journeySemanticScope);
            } catch (err) {
              // Invitation can run with Journey V1 identity flag off. If scoped
              // prepare is rejected, fall back to the full conversation so a
              // scene can still be born; publish identity stays fail-closed.
              if (journeySemanticScope && !isMirrorJourneyV1ClientEnabled()) {
                prepared = await runPrepare(undefined);
              } else {
                throw err;
              }
            }
            if (journeySemanticScope?.selectedSteps?.length === 8) {
              return {
                ...prepared,
                journeySelectedSteps: journeySemanticScope.selectedSteps,
              };
            }
            return prepared;
          },
          generate: async ({
            card,
            generationId,
            generationPipeline,
            finalScenePromptHash,
          }) => {
            const visual = card.visual!;
            const visualForApi = withSceneVariationSeed(visual, variationIndex);
            return generateMirrorScene(visualForApi, card.date, {
              conversationId: conversationId ?? undefined,
              generationRequestId: generationId,
              generationPipeline,
              finalScenePromptHash,
            });
          },
        });

        if (!outcome.ok) {
          throw outcome.error;
        }

        if (activeGenerationIdRef.current !== generationRequestId) {
          throw new MirrorSceneError('Stale generation ignored.', 'stale_generation');
        }
        if (resolveJourneyOwnerKey(user?.user_id) !== boundOwnerAtStart) {
          throw new MirrorSceneError('Stale generation ignored.', 'stale_generation');
        }

        cardForScene = outcome.card;
        const result = outcome.result;
        const visual = cardForScene.visual!;

        cardForScene = await completeJourneyGenerationLineageSeal({
          card: cardForScene,
          sceneImageUrl: result.sceneImageUrl,
          generationId: generationRequestId,
          ownerUserId: boundOwnerAtStart,
        });

        if (resolveJourneyOwnerKey(user?.user_id) !== boundOwnerAtStart) {
          throw new MirrorSceneError('Stale generation ignored.', 'stale_generation');
        }

        const sealedLineage = cardForScene.mirrorJourneyGenerationLineage;
        const sealedArtifact =
          sealedLineage?.journeyId
            ? loadMirrorJourneyArtifact(
                boundOwnerAtStart,
                sealedLineage.journeyId,
                sealedLineage.journeyVersion ?? 1
              )
            : null;
        if (
          sealedArtifact &&
          conversationId &&
          isAuthenticated &&
          authenticatedUserId
        ) {
          void persistAuthenticatedReadyYansi({
            artifact: sealedArtifact,
            clientConversationId: conversationId,
            bound: boundPersist,
            ownerNow: user?.user_id,
            sceneFocalX: typeof result.focalX === 'number' ? result.focalX : null,
            sceneFocalY: typeof result.focalY === 'number' ? result.focalY : null,
          });
        }

        lastRawSceneUrlRef.current = result.sceneImageUrl;
        const displayUrl = await resolveSceneDisplayUrl(
          result.sceneImageUrl,
          cardForScene
        );

        if (activeGenerationIdRef.current !== generationRequestId) {
          throw new MirrorSceneError('Stale generation ignored.', 'stale_generation');
        }

        setGeneratedDailyCard(cardForScene);
        setSceneImageUrl(displayUrl);
        setSceneImageStatus('ready');
        setSceneExtras({
          imageProvider: result.provider,
          ...(typeof result.focalX === 'number' ? { sceneFocalX: result.focalX } : {}),
          ...(typeof result.focalY === 'number' ? { sceneFocalY: result.focalY } : {}),
        });
        allowAutoSceneGenerationRef.current = false;
        saveMirrorSceneCacheForScope(
          conversationId,
          cardForScene,
          result.sceneImageUrl,
          result.provider
        );
        // Ensure snapshot exists for Keşfet → sohbet remount hydrate (CTA ≠ open_first).
        if (conversationId) {
          saveConversationMirrorSnapshot(conversationId, entries, cardForScene.date);
        }
        sceneAutoKeyRef.current = `${autoKey}:complete`;
        if (conversationId && isPersistableConversationSceneUrl(result.sceneImageUrl)) {
          setConversationSceneIdentity(conversationId, {
            url: result.sceneImageUrl,
            source: 'mirror_local',
          });
          useSainaChromeStore.getState().setChrome({
            conversationSceneUrl: result.sceneImageUrl,
            ...(typeof result.focalX === 'number'
              ? { conversationSceneFocalX: result.focalX }
              : {}),
            ...(typeof result.focalY === 'number'
              ? { conversationSceneFocalY: result.focalY }
              : {}),
          });
          markDiscoverMirrorCompletedForConversation(conversationId);
        }
        // Yayınla is explicit — do not auto-register to Keşfet on scene success.
        void refreshEntitlements();
        if (
          !isV3MirrorCard(cardForScene) &&
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
        if (
          err instanceof MirrorSceneError &&
          err.code === 'stale_generation'
        ) {
          // Newer generation owns the UI — do not clobber.
          return;
        }
        if (activeGenerationIdRef.current !== generationRequestId) {
          return;
        }
        setSceneImageUrl(null);
        setSceneImageStatus('error');
        const visual = cardForScene.visual;
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
          } else if (
            err.code === 'prepare_failed' ||
            err.code === 'd2_prompt_invalid'
          ) {
            sceneAutoKeyRef.current = `${autoKey}:prepare_failed`;
            setSceneExtras({ hybridFallbackReason: err.code });
          } else if (err.code === 'generation_failed') {
            sceneAutoKeyRef.current = `${autoKey}:failed`;
          } else {
            sceneAutoKeyRef.current = `${autoKey}:failed`;
          }
        } else {
          sceneAutoKeyRef.current = null;
        }
        const mode = visual?.renderMode ?? resolveMirrorRenderMode();
        if (!isV3MirrorCard(cardForScene) && mode === 'hybrid_middle') {
          setHybridTextFallback(true);
          setSceneExtras({ hybridFallbackReason: 'generate_scene_api_error' });
        }
      } finally {
        if (activeGenerationIdRef.current === generationRequestId) {
          sceneGenerationInFlightRef.current = false;
        }
      }
    },
    [
      generatedDailyCard,
      conversationId,
      entries,
      isAuthReady,
      canCreateVisual,
      isPlus,
      buildSceneAutoKey,
      createSceneGenerationId,
      resolveSceneDisplayUrl,
      sceneImageStatus,
      styleLensSession,
      refreshEntitlements,
      shareCacheUserId,
      authenticatedUserId,
      isAuthenticated,
      user?.user_id,
    ]
  );

  /** Plus — aynı kart; yeni seed ile aynı anlatıdan sahne (Interpretation yeniden koşmaz). */
  const handleNewMirrorScene = useCallback(() => {
    if (!isPlus) return;
    if (dailyStatus !== 'ready') return;
    if (!canCreateVisual) {
      setDailyStatus('plus_limit');
      return;
    }
    if (generatedDailyCard) {
      const autoKey = buildSceneAutoKey(generatedDailyCard);
      sceneRequestIdByAutoKeyRef.current.delete(autoKey);
    }
    sceneAutoKeyRef.current = null;
    allowAutoSceneGenerationRef.current = true;
    const nextSession = advanceStyleLensSession(styleLensSession);
    setStyleLensSession(nextSession);
    void handleGenerateMirrorScene(nextSession, { reuseMappedPrompt: true });
  }, [
    isPlus,
    dailyStatus,
    handleGenerateMirrorScene,
    styleLensSession,
    canCreateVisual,
    generatedDailyCard,
    buildSceneAutoKey,
  ]);

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
    if (!isAuthReady || !canCreateVisual) return;
    if (dailyStatus !== 'ready' || !generatedDailyCard?.visual?.prompt) return;
    if (sceneImageStatus !== 'idle') return;

    if (sceneAutoKeyRef.current?.endsWith(':hydrate')) {
      if (sceneImageUrl) return;
      sceneAutoKeyRef.current = null;
    }

    const autoKey = buildSceneAutoKey(generatedDailyCard);
    const archiveUrl = conversationId
      ? getChatArchive(conversationId)?.conversationSceneUrl?.trim() || null
      : null;
    const existingPersistableSceneUrl =
      archiveUrl && isPersistableConversationSceneUrl(archiveUrl) ? archiveUrl : null;

    if (
      !shouldAutoGenerateMirrorScene({
        allowAuto: allowAutoSceneGenerationRef.current,
        isAuthReady,
        canCreateVisual,
        dailyStatus,
        sceneImageStatus,
        hasVisualPrompt: Boolean(generatedDailyCard.visual?.prompt),
        autoKey,
        sceneAutoKey: sceneAutoKeyRef.current,
        existingPersistableSceneUrl,
      })
    ) {
      if (
        existingPersistableSceneUrl &&
        shouldHydrateExistingMirrorScene({
          allowAuto: allowAutoSceneGenerationRef.current,
          existingPersistableSceneUrl,
        })
      ) {
        void hydrateSceneFromCache(
          generatedDailyCard,
          existingPersistableSceneUrl,
          undefined
        );
      }
      return;
    }

    void handleGenerateMirrorScene();
  }, [
    dailyStatus,
    generatedDailyCard,
    sceneImageStatus,
    mirrorRevision,
    isAuthReady,
    canCreateVisual,
    buildSceneAutoKey,
    handleGenerateMirrorScene,
    conversationId,
    sceneImageUrl,
    hydrateSceneFromCache,
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

  /** Phase 8.6 — Review confirm → force Ayna scene create (reel hides create CTA). */
  useEffect(() => {
    if (!conversationId) return;

      const kickJourneyAynaGenerate = (detail: JourneyAynaGenerateDetail) => {
      if (!detail || detail.conversationId !== conversationId) return;
      if (entries.length < MIRROR_MIN_SAMPLES) return;
      if (!canCreateVisual) {
        consumePendingJourneyAynaGeneration(conversationId);
        setDailyStatus(visualLimitStatus());
        return;
      }
      const kickKey = `${detail.conversationId}:${detail.journeyId}:${detail.journeyVersion ?? 1}`;
      if (journeyAynaKickKeyRef.current === kickKey) return;
      const authority = getServerConversationAuthority();
      const tryKick = (reusableNow: boolean) => {
        if (reusableNow) {
          consumePendingJourneyAynaGeneration(conversationId);
          return;
        }
        journeyAynaKickKeyRef.current = kickKey;
        runMirrorWithReveal(entries, { isUpdate: true, immediate: true });
      };
      const localReusable =
        Boolean(shareCacheUserId) &&
        shouldSkipAynaSceneGeneration({
          artifacts: listJourneyArtifactsForConversation(
            shareCacheUserId,
            conversationId
          ),
          journeyId: detail.journeyId,
        });
      if (localReusable) {
        tryKick(true);
        return;
      }
      if (isAuthenticated && authenticatedUserId) {
        void hydrateYansiPreparationsFromServer({
          ownerUserId: authenticatedUserId,
          clientConversationId: conversationId,
          ownerAtStart: authority.ownerKey,
          epochAtStart: authority.epoch,
        }).then((rows) => {
          const skip = shouldSkipAynaSceneGeneration({
            artifacts:
              rows.length > 0
                ? listJourneyArtifactsForConversation(shareCacheUserId, conversationId)
                : listJourneyArtifactsForConversation(shareCacheUserId, conversationId),
            journeyId: detail.journeyId,
          });
          tryKick(skip);
        });
        return;
      }
      tryKick(false);
    };

    const pending = readPendingJourneyAynaGeneration(conversationId);
    if (pending) {
      kickJourneyAynaGenerate(pending);
    }

    const onJourneyAynaGenerate = (event: Event) => {
      const detail = (event as CustomEvent<JourneyAynaGenerateDetail>).detail;
      if (!detail) return;
      kickJourneyAynaGenerate(detail);
    };

    window.addEventListener(JOURNEY_AYNA_GENERATE_EVENT, onJourneyAynaGenerate);
    return () =>
      window.removeEventListener(JOURNEY_AYNA_GENERATE_EVENT, onJourneyAynaGenerate);
  }, [
    conversationId,
    entries,
    canCreateVisual,
    visualLimitStatus,
    runMirrorWithReveal,
    shareCacheUserId,
    isAuthenticated,
    authenticatedUserId,
  ]);

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
    setSharePublishConsentOpen(false);
    setShareTargetArtifact(null);
    setShareSessionPayload(null);
    mirrorExport.reset();
  }, [mirrorExport]);

  const handlePublishOrUpdate = useCallback(async () => {
    if (!generatedDailyCard) {
      setShareLinkError('Yayınlanacak Yansı bulunamadı.');
      return;
    }
    if (!isAuthReady) {
      setShareLinkError('Oturum doğrulanıyor. Biraz sonra tekrar dene.');
      return;
    }
    if (!isAuthenticated) {
      setIdentityOpen(true);
      return;
    }
    if (!requireConfirmedReview8OrOpen()) return;
    setPublishBusy(true);
    try {
      const ok = await prepareMirrorShareLink(generatedDailyCard, sceneImageUrl, {
        refreshScene: true,
      });
      if (!ok && !shareLinkError) {
        setShareLinkError('Yayınlanamadı. Tekrar dene.');
      }
    } finally {
      setPublishBusy(false);
    }
  }, [
    generatedDailyCard,
    isAuthReady,
    isAuthenticated,
    prepareMirrorShareLink,
    requireConfirmedReview8OrOpen,
    sceneImageUrl,
    shareLinkError,
  ]);

  const handleOpenPublicLanding = useCallback(() => {
    const slug = generatedDailyCard?.mirrorShare?.networkSlug?.trim();
    if (!slug) return;
    router.push(`/m/${encodeURIComponent(slug)}`);
  }, [generatedDailyCard, router]);

  const freezeArtifactShareSession = useCallback(
    (artifact: MirrorJourneyArtifact) => {
      const payload = resolveMirrorJourneySharePayload({
        artifact,
        ownerUserId: shareCacheUserId,
        conversationId,
      });
      setShareTargetArtifact(artifact);
      setShareSessionPayload(payload);
      return payload;
    },
    [shareCacheUserId, conversationId]
  );

  const openShareExperience = useCallback(
    (openedSlug?: string | null) => {
      setShareOpen(true);
      trackMirrorShareOpened(
        openedSlug ??
          shareSessionPayload?.slug ??
          generatedDailyCard?.mirrorShare?.networkSlug ??
          conversationId ??
          null,
        conversationId
      );
    },
    [generatedDailyCard, conversationId, shareSessionPayload?.slug]
  );

  const handleShareOpen = useCallback(() => {
    if (!isPlus) {
      setUpgradeOpen(true);
      return;
    }
    if (!isAuthenticated) {
      setIdentityOpen(true);
      return;
    }
    if (!generatedDailyCard) return;

    if (!requireConfirmedReview8OrOpen()) return;

    if (!generatedDailyCard.mirrorShare?.shareUrl) {
      setSharePublishConsentOpen(true);
      return;
    }

    openShareExperience();
  }, [
    isPlus,
    isAuthenticated,
    generatedDailyCard,
    openShareExperience,
    requireConfirmedReview8OrOpen,
  ]);

  const handlePosterPreviewOpen = useCallback(() => {
    if (!sceneImageUrl?.trim()) return;
    setPosterLightboxOpen(true);
  }, [sceneImageUrl]);

  const handleShareCapture = useCallback(
    async (node?: HTMLElement | null) => {
      if (!isPlus) return;
      await mirrorExport.captureCard(node ? { node } : undefined);
    },
    [isPlus, mirrorExport]
  );

  const handleShareNative = useCallback(async () => {
    const cardForShare = shareSessionPayload
      ? buildShareCardFromJourneyPayload(shareSessionPayload)
      : generatedDailyCard;
    const result = await mirrorExport.share(cardForShare);
    if (result === 'aborted') return;
    if (result === 'shared' || result === 'copied') {
      trackMirrorShared(
        shareSessionPayload?.slug ??
          cardForShare?.mirrorShare?.networkSlug ??
          conversationId ??
          null,
        conversationId
      );
    }
  }, [
    mirrorExport,
    generatedDailyCard,
    conversationId,
    shareSessionPayload,
  ]);

  const handleShareCopyText = useCallback(async () => {
    const cardForShare = shareSessionPayload
      ? buildShareCardFromJourneyPayload(shareSessionPayload)
      : generatedDailyCard;
    return mirrorExport.copyText(cardForShare);
  }, [mirrorExport, shareSessionPayload, generatedDailyCard]);

  const journeyV1PanelOn = isMirrorJourneyV1ClientEnabled();

  useEffect(() => {
    if (!journeyV1PanelOn) return;
    return subscribeMirrorJourneyArtifactStore(() => {
      setArtifactRevision((n) => n + 1);
    });
  }, [journeyV1PanelOn]);

  /** Phase 4 — recover published Yansılar from durable server after localStorage loss. */
  useEffect(() => {
    if (!journeyV1PanelOn || !conversationId || !authenticatedUserId || !isAuthenticated) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const authority = getServerConversationAuthority();
      const readyRows = await hydrateYansiPreparationsFromServer({
        ownerUserId: authenticatedUserId,
        clientConversationId: conversationId,
        ownerAtStart: authority.ownerKey,
        epochAtStart: authority.epoch,
      });
      const items = await hydratePublishedJourneysFromServer({
        ownerUserId: authenticatedUserId,
        conversationId,
      });
      if (!cancelled && (readyRows.length > 0 || items.length > 0)) {
        setArtifactRevision((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyV1PanelOn, conversationId, authenticatedUserId, isAuthenticated]);

  const journeyArtifacts = useMemo(() => {
    if (!journeyV1PanelOn || !conversationId || !shareCacheUserId) return [];
    void artifactRevision;
    return listJourneyArtifactsForConversation(shareCacheUserId, conversationId);
  }, [journeyV1PanelOn, conversationId, shareCacheUserId, artifactRevision]);

  const useAynaJourneyReel =
    journeyV1PanelOn && Boolean(conversationId) && Boolean(shareCacheUserId);

  const prepareArtifactShareLink = useCallback(
    async (
      artifact: MirrorJourneyArtifact,
      options?: { refreshScene?: boolean; openShareAfter?: boolean }
    ): Promise<boolean> => {
      if (!isAuthReady || !isAuthenticated) {
        setIdentityOpen(true);
        return false;
      }
      // Never borrow a foreign live card for this artifact's publish body.
      const card = buildPublishCardFromArtifact({
        artifact,
        liveCard: generatedDailyCard,
      });
      if (!card) {
        setShareLinkError(
          'Bu Yansı için yayınlanabilir içerik henüz hazır değil.'
        );
        return false;
      }
      setPublishBusyJourneyId(artifact.journeyId);
      setPublishBusy(true);
      try {
        const ok = await prepareMirrorShareLink(
          card,
          artifact.sceneImageUrl || null,
          { refreshScene: options?.refreshScene }
        );
        if (ok) {
          const updated =
            loadMirrorJourneyArtifact(
              shareCacheUserId,
              artifact.journeyId,
              artifact.journeyVersion
            ) || artifact;
          const payload = freezeArtifactShareSession(updated);
          if (options?.openShareAfter) {
            openShareExperience(payload.slug);
          }
        }
        return ok;
      } finally {
        setPublishBusy(false);
        setPublishBusyJourneyId(null);
      }
    },
    [
      isAuthReady,
      isAuthenticated,
      generatedDailyCard,
      prepareMirrorShareLink,
      shareCacheUserId,
      freezeArtifactShareSession,
      openShareExperience,
    ]
  );

  const aynaReelActions = useMemo<AynaJourneySlideActions>(
    () => ({
      onPublish: (artifact) => {
        void prepareArtifactShareLink(artifact, { refreshScene: true });
      },
      onRetry: (artifact) => {
        if (artifact.status !== 'failed' && artifact.status !== 'generating') {
          return;
        }
        if (!conversationId) return;
        if (entries.length < MIRROR_MIN_SAMPLES) return;
        if (!canCreateVisual) {
          setDailyStatus(visualLimitStatus());
          return;
        }
        // Re-kick the same Review→scene path; do not allocate a new journeyId.
        runMirrorWithReveal(entries, { isUpdate: true });
      },
      onShare: (artifact) => {
        if (!isPlus) {
          setUpgradeOpen(true);
          return;
        }
        if (!isAuthenticated) {
          setIdentityOpen(true);
          return;
        }
        const identity = resolveJourneyArtifactShareIdentity({
          ownerUserId: shareCacheUserId,
          journeyId: artifact.journeyId,
          journeyVersion: artifact.journeyVersion,
          conversationId,
          allowConversationLegacyFallback: false,
        });
        if (identity?.shareUrl) {
          setShareBusyJourneyId(artifact.journeyId);
          const payload = freezeArtifactShareSession(artifact);
          openShareExperience(payload.slug);
          setShareBusyJourneyId(null);
          return;
        }
        setShareTargetArtifact(artifact);
        freezeArtifactShareSession(artifact);
        setSharePublishConsentOpen(true);
      },
      onOpenDiscover: (artifact) => {
        const identity = resolveJourneyArtifactShareIdentity({
          ownerUserId: shareCacheUserId,
          journeyId: artifact.journeyId,
          journeyVersion: artifact.journeyVersion,
          conversationId,
          allowConversationLegacyFallback: false,
        });
        const slug =
          identity?.slug?.trim() || artifact.publish.slug?.trim() || null;
        if (!slug) return;
        router.push(`/m/${encodeURIComponent(slug)}`);
      },
      onOpenAuthorProfile: (artifact) => {
        const authorId = artifact.authorUserId?.trim();
        if (!authorId) return;
        router.push(authorProfilePath(authorId));
      },
      onOpenParent: (artifact) => {
        const slug = artifact.parentSlug?.trim();
        if (!slug) return;
        router.push(`/m/${encodeURIComponent(slug)}`);
      },
      onOpenChildren: (artifact) => {
        const slug =
          artifact.publish.slug?.trim() ||
          resolveJourneyArtifactShareIdentity({
            ownerUserId: shareCacheUserId,
            journeyId: artifact.journeyId,
            journeyVersion: artifact.journeyVersion,
          })?.slug;
        if (!slug || typeof artifact.childYansiCount !== 'number') return;
        router.push(parentChildrenPath(slug));
      },
    }),
    [
      prepareArtifactShareLink,
      isPlus,
      isAuthenticated,
      shareCacheUserId,
      conversationId,
      freezeArtifactShareSession,
      openShareExperience,
      router,
      entries,
      canCreateVisual,
      visualLimitStatus,
      runMirrorWithReveal,
    ]
  );

  const handleConfirmSharePublish = useCallback(async () => {
    if (shareTargetArtifact && useAynaJourneyReel) {
      setSharePublishConsentOpen(false);
      await prepareArtifactShareLink(shareTargetArtifact, {
        refreshScene: true,
        openShareAfter: true,
      });
      return;
    }
    if (!generatedDailyCard) return;
    if (!requireConfirmedReview8OrOpen()) {
      setSharePublishConsentOpen(false);
      return;
    }
    setSharePublishConsentOpen(false);
    setPublishBusy(true);
    try {
      const ok = await prepareMirrorShareLink(generatedDailyCard, sceneImageUrl, {
        refreshScene: true,
      });
      if (!ok) return;
      openShareExperience(
        generatedDailyCard.mirrorShare?.networkSlug ?? null
      );
    } finally {
      setPublishBusy(false);
    }
  }, [
    shareTargetArtifact,
    useAynaJourneyReel,
    prepareArtifactShareLink,
    generatedDailyCard,
    prepareMirrorShareLink,
    sceneImageUrl,
    openShareExperience,
    requireConfirmedReview8OrOpen,
  ]);

  const handleRetryJourneyOrLegacyShareLink = useCallback(() => {
    if (shareSessionPayload && useAynaJourneyReel) {
      const artifact =
        loadMirrorJourneyArtifact(
          shareCacheUserId,
          shareSessionPayload.journeyId,
          shareSessionPayload.journeyVersion
        ) || shareTargetArtifact;
      if (!artifact) return;
      void prepareArtifactShareLink(artifact, { refreshScene: true });
      return;
    }
    handleRetryShareLink();
  }, [
    shareSessionPayload,
    useAynaJourneyReel,
    shareCacheUserId,
    shareTargetArtifact,
    prepareArtifactShareLink,
    handleRetryShareLink,
  ]);

  const handleRetryMirrorScene = useCallback(() => {
    if (!isAuthReady) return;
    if (!canCreateVisual) {
      setDailyStatus(visualLimitStatus());
      return;
    }
    sceneGenerationInFlightRef.current = false;
    sceneAutoKeyRef.current = null;
    allowAutoSceneGenerationRef.current = true;
    setSceneExtras({});
    if (!generatedDailyCard?.visual) {
      const ok = commitMirrorReady(entries);
      if (!ok) return;
      return;
    }
    setSceneImageStatus('idle');
    void handleGenerateMirrorScene();
  }, [
    isAuthReady,
    canCreateVisual,
    visualLimitStatus,
    generatedDailyCard,
    commitMirrorReady,
    entries,
    handleGenerateMirrorScene,
  ]);

  const isScenePosterVisible = useMemo(
    () =>
      dailyStatus === 'ready' &&
      Boolean(sceneImageUrl?.trim()) &&
      sceneImageStatus === 'ready',
    [dailyStatus, sceneImageUrl, sceneImageStatus]
  );

  const publicPreview = useMemo(() => {
    if (!cardForRender) return null;
    return resolveMirrorPublicPreview(cardForRender, sceneImageUrl);
  }, [cardForRender, sceneImageUrl]);

  const shareExperienceCard = useMemo(() => {
    if (shareSessionPayload) {
      return buildShareCardFromJourneyPayload(shareSessionPayload);
    }
    return generatedDailyCard;
  }, [shareSessionPayload, generatedDailyCard]);

  const shareExperiencePreview = useMemo(() => {
    if (shareSessionPayload) {
      return publicPreviewFromJourneySharePayload(shareSessionPayload);
    }
    return publicPreview;
  }, [shareSessionPayload, publicPreview]);

  const isPublished = Boolean(generatedDailyCard?.mirrorShare?.shareUrl);

  /** Already-published mirrors: restore Discover title/summary when local D2 was lost. */
  useEffect(() => {
    const share = generatedDailyCard?.mirrorShare;
    if (!share) return;
    const slug = share.networkSlug?.trim();
    const shareUrl = share.shareUrl?.trim();
    if (!slug || !shareUrl) return;
    if (share.publicTitle?.trim() && share.publicSummary?.trim()) return;
    if (publishedLandingHydrateRef.current === slug) return;
    publishedLandingHydrateRef.current = slug;

    let cancelled = false;
    void (async () => {
      const result = await fetchPublicMirrorBySlug(slug);
      if (cancelled || !result.ok) return;
      const landing = {
        publicTitle:
          result.data.publicTitle?.trim() || result.data.cardTitle?.trim() || null,
        publicSummary:
          result.data.publicSummary?.trim() ||
          result.data.curiosityContext?.trim() ||
          result.data.landingContext?.trim() ||
          null,
      };
      if (!landing.publicTitle && !landing.publicSummary) return;

      setGeneratedDailyCard((prev) => {
        if (!prev?.mirrorShare?.shareUrl) return prev;
        return applyShareUrlToCard(
          prev,
          prev.mirrorShare.shareUrl,
          prev.mirrorShare.networkSlug ?? slug,
          landing
        );
      });

      if (conversationId && shareCacheUserId) {
        saveMirrorShareLink(
          conversationId,
          slug,
          shareUrl,
          shareCacheUserId,
          new Date(),
          landing
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    generatedDailyCard?.mirrorShare,
    shareCacheUserId,
  ]);

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
          ) : isScenePosterVisible && publicPreview ? (
            <DailyMirrorCardEntrance
              className={cn(
                embedded ? 'saina-mirror-embedded-poster' : cn('w-full', ms.dailyPosterFrame)
              )}
            >
              <div ref={mirrorExport.cardRef} data-mirror-card className="w-full">
                <MirrorPublicCard
                  title={publicPreview.title}
                  summary={publicPreview.summary}
                  sceneImageUrl={publicPreview.sceneImageUrl}
                  metaLabel={isPublished ? MIRROR_PUBLISHED_STATUS : null}
                  testIdPrefix="mirror-public-preview"
                  onOpenFullscreen={handlePosterPreviewOpen}
                />
              </div>
            </DailyMirrorCardEntrance>
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

          {!isSceneLoading && isScenePosterVisible ? (
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
              <MirrorPublishShareActions
                isPublished={isPublished}
                publishBusy={publishBusy || shareLinkStatus === 'preparing'}
                canShare={isPlus}
                publishError={shareLinkError}
                showNewScene={
                  isPlus && readyRefreshCta === 'current' && typeof handleNewMirrorScene === 'function'
                }
                sceneImageStatus={sceneImageStatus}
                hasProductionQuota={hasProductionQuota}
                onPublish={() => void handlePublishOrUpdate()}
                onShare={() => handleShareOpen()}
                onOpenPublic={handleOpenPublicLanding}
                onNewScene={handleNewMirrorScene}
              />
              {readyLoginCta}
            </>
          ) : !isSceneLoading ? (
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
                cardReady={false}
                sceneImageStatus={sceneImageStatus}
                hasProductionQuota={hasProductionQuota}
                showShare={false}
                onUpdate={handleMirrorRefresh}
                onNewScene={handleNewMirrorScene}
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
          useAynaJourneyReel
            ? 'overflow-hidden'
            : 'overflow-x-hidden overflow-y-auto',
          dailyStatus === 'ready' && !useAynaJourneyReel && ms.dailyStageReady,
          dailyStatus === 'idle' ||
            dailyStatus === 'insufficient' ||
            dailyStatus === 'error' ||
            dailyStatus === 'daily_limit' ||
            dailyStatus === 'plus_limit'
            ? 'gap-0 py-0 sm:gap-0 sm:py-1'
            : undefined
        )}
        data-testid={
          useAynaJourneyReel ? 'ayna-journey-panel' : 'ayna-legacy-panel'
        }
      >
        {useAynaJourneyReel ? (
          <AynaJourneyReel
            artifacts={journeyArtifacts}
            actions={aynaReelActions}
            publishBusyJourneyId={publishBusyJourneyId}
            shareBusyJourneyId={shareBusyJourneyId}
            canShare={isPlus}
            emptyState={
              <div
                className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center"
                data-testid="ayna-empty-state"
              >
                <p className="saina-serif text-sm text-[rgba(246,244,239,0.92)]">
                  {MIRROR_AYNA_EMPTY_TITLE}
                </p>
                <p className="text-[11px] leading-relaxed text-[rgba(217,196,163,0.75)]">
                  {MIRROR_AYNA_EMPTY_BODY}
                </p>
              </div>
            }
          />
        ) : (
          renderDailyPanel()
        )}
      </div>

      <MirrorShareExperience
        open={shareOpen && isPlus}
        onClose={handleShareClose}
        card={shareExperienceCard}
        publicPreview={shareExperiencePreview}
        journeySharePayload={shareSessionPayload}
        previewUrl={mirrorExport.previewUrl}
        loading={mirrorExport.loading}
        error={mirrorExport.error}
        shareLinkStatus={shareLinkStatus}
        shareLinkError={shareLinkError}
        impactSlug={
          shareLinkStatus === 'ready'
            ? shareSessionPayload?.slug ??
              generatedDailyCard?.mirrorShare?.networkSlug ??
              null
            : null
        }
        onRetryShareLink={handleRetryJourneyOrLegacyShareLink}
        onCapture={handleShareCapture}
        onShare={handleShareNative}
        onCopyText={handleShareCopyText}
      />

      {sharePublishConsentOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mirror-share-publish-consent-title"
          data-testid="mirror-share-publish-consent"
          onClick={() => setSharePublishConsentOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141210] p-5 text-[#f4f0e8] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="mirror-share-publish-consent-title" className="text-sm leading-relaxed text-[rgba(246,244,239,0.9)]">
              {MIRROR_SHARE_PUBLISH_CONSENT}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(231,180,91,0.42)] bg-[linear-gradient(165deg,rgba(231,180,91,0.28)_0%,rgba(231,180,91,0.14)_100%)] px-4 py-2.5 text-xs font-semibold text-[#f6f0e4]"
                onClick={() => void handleConfirmSharePublish()}
                data-testid="mirror-share-publish-consent-confirm"
              >
                {MIRROR_SHARE_PUBLISH_CONSENT_CONFIRM}
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-xs font-medium text-[rgba(217,196,163,0.85)]"
                onClick={() => setSharePublishConsentOpen(false)}
                data-testid="mirror-share-publish-consent-cancel"
              >
                {MIRROR_SHARE_PUBLISH_CONSENT_CANCEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
