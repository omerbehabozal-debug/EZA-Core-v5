'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  FREE_MIRROR_READY_PLUS_HINT,
  MIRROR_REVEAL_DURATION_MS,
} from '@/lib/eza/mirror/copy';
import {
  entriesForDisplayedMirror,
  hasNewDataSinceSnapshot,
  readTodaysSnapshot,
  resolveMirrorRefreshCta,
  saveDailyMirrorSnapshot,
  type MirrorRefreshCta,
} from '@/lib/eza/mirror/dailyMirrorSnapshot';
import {
  MIRROR_MIN_SAMPLES,
  type DailyMirrorCardModel,
  type MirrorSceneImageStatus,
  type MirrorStateMeta,
} from '@/lib/eza/mirror/types';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { mergeDailyCardSceneVisual, type DailyCardSceneVisualExtras } from '@/lib/eza/mirror/mirrorSceneImage';
import { withDevVehicleCueHints } from '@/lib/eza/mirror/mirrorIntentContext';
import { generateMirrorScene, MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
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
import MirrorSceneGenerateButton from '@/components/mirror/MirrorSceneGenerateButton';
import MirrorShareModal from '@/components/mirror/MirrorShareModal';
import UpgradeModal, { type UpgradeModalVariant } from '@/components/plan/UpgradeModal';
import { useMirrorCardExport } from '@/hooks/useMirrorCardExport';
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
import { usePlan } from '@/lib/eza/plan/usePlan';
import {
  canCreateFreeMirrorToday,
  markFreeMirrorUsedToday,
} from '@/lib/eza/plan/freeMirrorUsage';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

type DailyMirrorStatus =
  | 'idle'
  | 'revealing'
  | 'ready'
  | 'insufficient'
  | 'daily_limit'
  | 'error';

interface StandaloneObservationExperienceProps {
  entries: SavedBehavioralEntry[];
}

/** Ayna → Günlük Ayna görünümü (üst nav ve ortak kabuk artık mirror layout'ta). */
export default function StandaloneObservationExperience({
  entries,
}: StandaloneObservationExperienceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeVariant, setUpgradeVariant] = useState<UpgradeModalVariant>('upgrade');
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
  const hydratedFromSnapshotRef = useRef(false);
  const mirrorExport = useMirrorCardExport();
  const { isPlus } = usePlan();

  const todaysSnapshot = useMemo(() => readTodaysSnapshot(), [entries]);
  const refreshCta: MirrorRefreshCta = useMemo(
    () => resolveMirrorRefreshCta(entries),
    [entries, todaysSnapshot?.generatedAt]
  );

  const displayEntries = useMemo(() => {
    if (dailyStatus !== 'ready' && dailyStatus !== 'revealing') return entries;
    return entriesForDisplayedMirror(entries, todaysSnapshot);
  }, [entries, todaysSnapshot, dailyStatus]);

  const ms = standaloneSkin.mirrorSurface;

  useEffect(() => {
    if (entries.length === 0) {
      hydratedFromSnapshotRef.current = false;
      sceneAutoKeyRef.current = null;
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
  }, [entries.length]);

  const resetGeneratedCardState = useCallback(() => {
    sceneAutoKeyRef.current = null;
    setMirrorRevision(0);
    clearStyleLensSession();
    setStyleLensSession(createDefaultStyleLensSession({ date: '', visual: undefined }));
    setGeneratedDailyCard(null);
    setGeneratedDailyMeta(null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
  }, []);

  const commitMirrorReady = useCallback(
    (sourceEntries: SavedBehavioralEntry[]) => {
      const state = buildMirrorState(sourceEntries);
      if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
        resetGeneratedCardState();
        setDailyStatus('insufficient');
        return false;
      }
      setGeneratedDailyCard(state.dailyMirrorCard);
      setGeneratedDailyMeta(state.meta);
      setStyleLensSession(resetStyleLensSessionForCard(state.dailyMirrorCard));
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setHybridTextFallback(false);
      setSceneExtras({});
      setDailyStatus('ready');
      saveDailyMirrorSnapshot(sourceEntries, state.dailyMirrorCard.date);
      if (!isPlus) {
        markFreeMirrorUsedToday(state.dailyMirrorCard.date);
      }
      return true;
    },
    [isPlus, resetGeneratedCardState]
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
          if (!ok) return;
        } catch {
          resetGeneratedCardState();
          setDailyStatus('error');
        }
      }, MIRROR_REVEAL_DURATION_MS);
    },
    [commitMirrorReady, resetGeneratedCardState]
  );

  /** Sayfa yenileme — bugünkü snapshot ile kartı sessizce göster; aynı veride sahne üretme. */
  useEffect(() => {
    if (hydratedFromSnapshotRef.current || generatedDailyCard) return;
    if (dailyStatus !== 'idle') return;
    if (refreshCta === 'open_first' || entries.length < MIRROR_MIN_SAMPLES) return;

    const mirrorEntries = entriesForDisplayedMirror(entries, todaysSnapshot);
    const state = buildMirrorState(mirrorEntries);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;

    hydratedFromSnapshotRef.current = true;
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setStyleLensSession(resolveStyleLensSessionForCard(state.dailyMirrorCard));
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');

    const fingerprint = state.dailyMirrorCard.visual?.intentFingerprint ?? '';
    sceneAutoKeyRef.current = `${state.dailyMirrorCard.date}:${fingerprint}:hydrate`;
  }, [
    dailyStatus,
    entries,
    generatedDailyCard,
    refreshCta,
    todaysSnapshot,
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
    setSceneImageStatus('error');
    const mode =
      generatedDailyCard?.visual?.renderMode ?? resolveMirrorRenderMode();
    if (mode === 'hybrid_middle') {
      setHybridTextFallback(true);
      setSceneExtras((prev) => ({
        ...prev,
        hybridFallbackReason: 'scene_image_load_error',
      }));
    }
  }, [generatedDailyCard?.visual?.renderMode]);

  const openUpgrade = useCallback((variant: UpgradeModalVariant = 'upgrade') => {
    setUpgradeVariant(variant);
    setUpgradeOpen(true);
  }, []);

  const handleGenerateMirrorScene = useCallback(
    async (sessionOverride?: MirrorStyleLensSession) => {
      if (sceneImageStatus === 'generating') return;
      if (!generatedDailyCard?.visual) return;
      const visual = generatedDailyCard.visual;
      const session = sessionOverride ?? styleLensSession;
      const { lensId, variationIndex } = resolveLensForGeneration(isPlus, session);
      const visualForApi = applyStyleLensToVisual(visual, lensId, variationIndex);
      setSceneImageStatus('generating');
      setSceneImageUrl(null);
      setHybridTextFallback(false);
      setSceneExtras({});
      try {
        const result = await generateMirrorScene(visualForApi, generatedDailyCard.date);
        setSceneImageUrl(result.sceneImageUrl);
        setSceneImageStatus('ready');
        setSceneExtras({ imageProvider: result.provider });
        if (
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
            setUpgradeVariant('auth_required');
            setUpgradeOpen(true);
          } else if (err.code === 'upgrade_required') {
            setUpgradeVariant('upgrade');
            setUpgradeOpen(true);
          }
        }
        const mode = visual.renderMode ?? resolveMirrorRenderMode();
        if (mode === 'hybrid_middle') {
          setHybridTextFallback(true);
          setSceneExtras({ hybridFallbackReason: 'generate_scene_api_error' });
        }
      }
    },
    [generatedDailyCard, isPlus, openUpgrade, sceneImageStatus, styleLensSession]
  );

  /** Plus — aynı kart; sıradaki Style Lens ile sahne (snapshot / buildMirrorState yok). */
  const handleNewMirrorScene = useCallback(() => {
    if (!isPlus) return;
    if (dailyStatus !== 'ready') return;
    const nextSession = advanceStyleLensSession(styleLensSession);
    setStyleLensSession(nextSession);
    void handleGenerateMirrorScene(nextSession);
  }, [isPlus, dailyStatus, handleGenerateMirrorScene, styleLensSession]);

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
    if (dailyStatus !== 'ready' || !generatedDailyCard?.visual?.prompt) return;
    if (sceneImageStatus !== 'idle') return;

    const fingerprint = generatedDailyCard.visual.intentFingerprint ?? '';
    const autoKey = `${generatedDailyCard.date}:${fingerprint}:${mirrorRevision}`;
    if (sceneAutoKeyRef.current === autoKey) return;
    if (sceneAutoKeyRef.current?.endsWith(':hydrate')) return;
    sceneAutoKeyRef.current = autoKey;
    void handleGenerateMirrorScene();
  }, [
    dailyStatus,
    generatedDailyCard,
    sceneImageStatus,
    mirrorRevision,
    handleGenerateMirrorScene,
  ]);

  const handleGenerateDailyMirror = useCallback(() => {
    if (entries.length < MIRROR_MIN_SAMPLES) {
      resetGeneratedCardState();
      setDailyStatus('insufficient');
      return;
    }

    const snap = readTodaysSnapshot();

    if (snap && hasNewDataSinceSnapshot(entries, snap)) {
      if (!isPlus) {
        setDailyStatus('daily_limit');
        return;
      }
      runMirrorWithReveal(entries, { isUpdate: true });
      return;
    }

    if (snap && !hasNewDataSinceSnapshot(entries, snap)) {
      return;
    }

    if (!isPlus && !canCreateFreeMirrorToday()) {
      setDailyStatus('daily_limit');
      return;
    }

    runMirrorWithReveal(entries);
  }, [entries, isPlus, resetGeneratedCardState, runMirrorWithReveal]);

  const handleMirrorRefresh = useCallback(() => {
    const snap = readTodaysSnapshot();
    if (!snap || !hasNewDataSinceSnapshot(entries, snap)) return;

    if (!isPlus) {
      setDailyStatus('daily_limit');
      return;
    }

    if (entries.length < MIRROR_MIN_SAMPLES) return;
    runMirrorWithReveal(entries, { isUpdate: true });
  }, [entries, isPlus, runMirrorWithReveal]);

  const handleForceBmwMercedes = useCallback(() => {
    const boosted = withDevVehicleCueHints(entries);
    const state = buildMirrorState(boosted, { seed: 'force-bmw-mercedes-dev' });
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries]);

  const handleToggleHybridMode = useCallback(() => {
    const next =
      resolveMirrorRenderMode() === 'hybrid_middle' ? 'scene_only' : 'hybrid_middle';
    setDevRenderMode(next);
    const state = buildMirrorState(entries);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries]);

  const handleShareClose = useCallback(() => {
    setShareOpen(false);
    mirrorExport.reset();
  }, [mirrorExport]);

  const handleShareCapture = useCallback(async () => {
    await mirrorExport.captureCard();
  }, [mirrorExport]);

  const handleShareDownload = useCallback(async () => {
    return mirrorExport.download(generatedDailyCard);
  }, [mirrorExport, generatedDailyCard]);

  const handleShareNative = useCallback(async () => {
    await mirrorExport.share(generatedDailyCard);
  }, [mirrorExport, generatedDailyCard]);

  const showShareAction =
    isPlus &&
    dailyStatus === 'ready' &&
    generatedDailyCard !== null &&
    generatedDailyCard.shareEnabled;

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

    if (dailyStatus === 'ready' && cardForRender) {
      return (
        <div className={ms.dailyReadyStack}>
          <DailyMirrorCardEntrance className="w-full">
            <div ref={mirrorExport.cardRef} data-mirror-card className="w-full">
              <DailyMirrorPosterCard
                card={cardForRender}
                entries={displayEntries}
                meta={generatedDailyMeta ?? undefined}
                onSceneImageLoad={handleSceneImageLoad}
                onSceneImageError={handleSceneImageError}
                onForceBmwMercedes={handleForceBmwMercedes}
                onToggleHybridMode={handleToggleHybridMode}
                hybridTextFallback={hybridTextFallback}
              />
              <div
                className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] w-full max-w-[28rem] opacity-100"
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
            </div>
          </DailyMirrorCardEntrance>

          <DailyMirrorRefreshActions
            refreshCta={readyRefreshCta}
            isPlus={isPlus}
            cardReady
            sceneImageStatus={sceneImageStatus}
            showShare={showShareAction}
            onShare={() => setShareOpen(true)}
            onUpdate={handleMirrorRefresh}
            onNewScene={handleNewMirrorScene}
            activeStyleLensLabel={isPlus ? activeStyleLensLabel : undefined}
            freePlusHint={!isPlus ? FREE_MIRROR_READY_PLUS_HINT : undefined}
          >
            {!isPlus && sceneImageStatus === 'error' ? (
              <MirrorSceneGenerateButton
                status={sceneImageStatus}
                onGenerate={() => void handleGenerateMirrorScene()}
                disabled={!generatedDailyCard?.visual?.prompt}
              />
            ) : null}
          </DailyMirrorRefreshActions>
        </div>
      );
    }

    if (refreshCta === 'current' && dailyStatus === 'idle') {
      return (
        <div className={ms.dailyReadyStack}>
          <DailyMirrorRefreshActions
            refreshCta="current"
            isPlus={isPlus}
            onUpdate={handleMirrorRefresh}
            freePlusHint={!isPlus ? FREE_MIRROR_READY_PLUS_HINT : undefined}
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
            onUpdate={handleMirrorRefresh}
            freePlusHint={!isPlus ? FREE_MIRROR_READY_PLUS_HINT : undefined}
          />
        </div>
      );
    }

    return (
      <DailyMirrorCreatePrompt variant={promptVariant} onGenerate={handleGenerateDailyMirror} />
    );
  };

  return (
    <>
      <div
        className={cn(
          ms.dailyStage,
          'min-h-0 flex-1',
          dailyStatus === 'idle' ||
          dailyStatus === 'insufficient' ||
          dailyStatus === 'error' ||
          dailyStatus === 'daily_limit'
            ? 'justify-center gap-0 overflow-x-hidden overflow-y-auto py-0 sm:gap-0 sm:py-1'
            : 'justify-center overflow-y-auto'
        )}
      >
        {renderDailyPanel()}
      </div>

      <MirrorShareModal
        open={shareOpen}
        onClose={handleShareClose}
        previewUrl={mirrorExport.previewUrl}
        loading={mirrorExport.loading}
        error={mirrorExport.error}
        onCapture={handleShareCapture}
        onDownload={handleShareDownload}
        onShare={handleShareNative}
        onCopyText={() => mirrorExport.copyText(generatedDailyCard)}
      />

      <UpgradeModal
        open={upgradeOpen}
        variant={upgradeVariant}
        feature="mirror_scene_generate"
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
