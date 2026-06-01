'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  FREE_MIRROR_CREATE_ANOTHER,
  FREE_MIRROR_READY_PLUS_HINT,
  MIRROR_REVEAL_DURATION_MS,
  MIRROR_SHARE_LABEL,
  MIRROR_UPDATE_LABEL,
} from '@/lib/eza/mirror/copy';
import {
  MIRROR_MIN_SAMPLES,
  type DailyMirrorCardModel,
  type MirrorSceneImageStatus,
  type MirrorStateMeta,
} from '@/lib/eza/mirror/types';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { mergeDailyCardSceneVisual, type DailyCardSceneVisualExtras } from '@/lib/eza/mirror/mirrorSceneImage';
import {
  resolveMirrorIntentContext,
  withDevVehicleCueHints,
} from '@/lib/eza/mirror/mirrorIntentContext';
import { generateMirrorScene, MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
import {
  resolveMirrorRenderMode,
  setDevRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';
import { resolveCardRenderMode } from '@/lib/eza/mirror/mirrorPosterLayout';
import {
  isMockSceneImageUrl,
  probeHybridTypographyInImage,
} from '@/lib/eza/mirror/hybridPosterDebug';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import DailyLimitUpgrade from '@/components/mirror/DailyLimitUpgrade';
import DailyMirrorCreatePrompt from '@/components/mirror/DailyMirrorCreatePrompt';
import DailyMirrorReveal from '@/components/mirror/DailyMirrorReveal';
import DailyMirrorCardEntrance from '@/components/mirror/DailyMirrorCardEntrance';
import MirrorSceneGenerateButton from '@/components/mirror/MirrorSceneGenerateButton';
import MirrorShareModal from '@/components/mirror/MirrorShareModal';
import UpgradeModal, { type UpgradeModalVariant } from '@/components/plan/UpgradeModal';
import { useMirrorCardExport } from '@/hooks/useMirrorCardExport';
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
  const [cardIntentFingerprint, setCardIntentFingerprint] = useState<string | null>(null);
  const [hybridTextFallback, setHybridTextFallback] = useState(false);
  const [sceneExtras, setSceneExtras] = useState<DailyCardSceneVisualExtras>({});
  const [mirrorRevision, setMirrorRevision] = useState(0);
  const sceneAutoKeyRef = useRef<string | null>(null);
  const mirrorExport = useMirrorCardExport();
  const { isPlus } = usePlan();

  const liveIntentFingerprint = useMemo(() => {
    if (!entries.length) return null;
    return resolveMirrorIntentContext({ entries }).intentFingerprint;
  }, [entries]);

  const ms = standaloneSkin.mirrorSurface;

  useEffect(() => {
    if (entries.length === 0) {
      setGeneratedDailyCard(null);
      setGeneratedDailyMeta(null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setCardIntentFingerprint(null);
      setHybridTextFallback(false);
      setSceneExtras({});
      setDailyStatus('idle');
    }
  }, [entries.length]);

  /** Bust stale scene when history/intent or renderMode changes after card was generated. */
  useEffect(() => {
    if (dailyStatus !== 'ready' || !generatedDailyCard || !liveIntentFingerprint) return;

    const effectiveMode = resolveMirrorRenderMode();
    const cardMode = resolveCardRenderMode(generatedDailyCard);
    const modeStale = cardMode !== effectiveMode;

    if (cardIntentFingerprint && liveIntentFingerprint !== cardIntentFingerprint) {
      const state = buildMirrorState(entries);
      sceneAutoKeyRef.current = null;
      setMirrorRevision((r) => r + 1);
      setGeneratedDailyCard(state.dailyMirrorCard);
      setGeneratedDailyMeta(state.meta);
      setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setSceneExtras({});
      setHybridTextFallback(false);
      return;
    }

    if (modeStale) {
      const state = buildMirrorState(entries);
      sceneAutoKeyRef.current = null;
      setMirrorRevision((r) => r + 1);
      setGeneratedDailyCard(state.dailyMirrorCard);
      setGeneratedDailyMeta(state.meta);
      setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setSceneExtras({});
      setHybridTextFallback(false);
    }
  }, [entries, dailyStatus, liveIntentFingerprint, cardIntentFingerprint, generatedDailyCard]);

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
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            '[EZA Mirror] Hybrid OCR probe skipped — mock/picsum image cannot embed typography.'
          );
        }
        return;
      }

      const probe = await probeHybridTypographyInImage(
        url,
        generatedDailyCard?.visual?.hybridTextPayload
      );
      const probeLabel = probe.ok ? `pass: ${probe.reason}` : `fail: ${probe.reason}`;
      setSceneExtras((prev) => ({ ...prev, hybridOcrProbe: probeLabel }));
      if (process.env.NODE_ENV === 'development') {
        console.log('[EZA Mirror] hybrid OCR probe', probe);
      }
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

  const handleGenerateMirrorScene = useCallback(async () => {
    if (!generatedDailyCard?.visual) return;
    const visual = generatedDailyCard.visual;
    setSceneImageStatus('generating');
    setSceneImageUrl(null);
    setHybridTextFallback(false);
    setSceneExtras({});
    if (process.env.NODE_ENV === 'development') {
      console.group('[EZA Mirror] generate-scene request');
      console.log('renderMode:', visual.renderMode ?? resolveMirrorRenderMode());
      console.log('usedPromptType:', visual.usedPromptType);
      console.log('promptLength:', visual.prompt.length);
      console.log('promptTruncated:', visual.promptTruncated);
      console.log('FINAL PROMPT → generate-scene API:\n', visual.prompt);
      console.groupEnd();
    }
    try {
      const result = await generateMirrorScene(visual, generatedDailyCard.date);
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
  }, [generatedDailyCard, openUpgrade]);

  useEffect(() => {
    if (dailyStatus !== 'ready' || !generatedDailyCard?.visual?.prompt) return;
    if (sceneImageStatus !== 'idle') return;

    const fingerprint = generatedDailyCard.visual.intentFingerprint ?? '';
    const autoKey = `${generatedDailyCard.date}:${fingerprint}:${mirrorRevision}`;
    if (sceneAutoKeyRef.current === autoKey) return;
    sceneAutoKeyRef.current = autoKey;
    void handleGenerateMirrorScene();
  }, [
    dailyStatus,
    generatedDailyCard,
    sceneImageStatus,
    mirrorRevision,
    handleGenerateMirrorScene,
  ]);

  const resetGeneratedCardState = useCallback(() => {
    sceneAutoKeyRef.current = null;
    setMirrorRevision(0);
    setGeneratedDailyCard(null);
    setGeneratedDailyMeta(null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setCardIntentFingerprint(null);
    setHybridTextFallback(false);
    setSceneExtras({});
  }, []);

  const handleGenerateDailyMirror = useCallback(() => {
    // 1) Veri — reveal öncesi örnek eşiği
    if (entries.length < MIRROR_MIN_SAMPLES) {
      resetGeneratedCardState();
      setDailyStatus('insufficient');
      return;
    }

    // 2) Plan / günlük hak — reveal ve buildMirrorState öncesi
    if (!isPlus && !canCreateFreeMirrorToday()) {
      setDailyStatus('daily_limit');
      return;
    }

    // 3) Veri + hak uygun — reveal, sonra üretim
    setDailyStatus('revealing');
    window.setTimeout(() => {
      try {
        const state = buildMirrorState(entries);
        if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
          resetGeneratedCardState();
          setDailyStatus('insufficient');
          return;
        }
        setGeneratedDailyCard(state.dailyMirrorCard);
        setGeneratedDailyMeta(state.meta);
        setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
        setSceneImageUrl(null);
        setSceneImageStatus('idle');
        setHybridTextFallback(false);
        setSceneExtras({});
        setDailyStatus('ready');
        if (!isPlus) {
          markFreeMirrorUsedToday(state.dailyMirrorCard.date);
        }
      } catch {
        resetGeneratedCardState();
        setDailyStatus('error');
      }
    }, MIRROR_REVEAL_DURATION_MS);
  }, [entries, isPlus, resetGeneratedCardState]);

  const handleForceBmwMercedes = useCallback(() => {
    const boosted = withDevVehicleCueHints(entries);
    const state = buildMirrorState(boosted, { seed: 'force-bmw-mercedes-dev' });
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
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
    setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries]);

  const handleUpdateMirror = useCallback(() => {
    if (!isPlus) {
      openUpgrade('upgrade');
      return;
    }
    if (entries.length < MIRROR_MIN_SAMPLES) return;
    const state = buildMirrorState(entries);
    if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) return;
    sceneAutoKeyRef.current = null;
    setMirrorRevision((r) => r + 1);
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
    setHybridTextFallback(false);
    setSceneExtras({});
    setDailyStatus('ready');
  }, [entries, isPlus, openUpgrade]);

  const handleShareClose = useCallback(() => {
    setShareOpen(false);
    mirrorExport.reset();
  }, [mirrorExport]);

  const handleShareCapture = useCallback(async () => {
    await mirrorExport.captureCard();
  }, [mirrorExport]);

  const handleShareDownload = useCallback(async () => {
    return mirrorExport.download(generatedDailyCard?.date);
  }, [mirrorExport, generatedDailyCard?.date]);

  const handleShareNative = useCallback(async () => {
    await mirrorExport.share(generatedDailyCard?.date);
  }, [mirrorExport, generatedDailyCard?.date]);

  const showShareAction =
    isPlus &&
    dailyStatus === 'ready' &&
    generatedDailyCard !== null &&
    generatedDailyCard.shareEnabled;

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
                entries={entries}
                meta={generatedDailyMeta ?? undefined}
                onSceneImageLoad={handleSceneImageLoad}
                onSceneImageError={handleSceneImageError}
                onForceBmwMercedes={handleForceBmwMercedes}
                onToggleHybridMode={handleToggleHybridMode}
                hybridTextFallback={hybridTextFallback}
              />
            </div>
          </DailyMirrorCardEntrance>

          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            {isPlus ? (
              <>
                {showShareAction ? (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className={ms.shareAction}
                  >
                    <Share2 className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {MIRROR_SHARE_LABEL}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleUpdateMirror}
                  className={cn(
                    'inline-flex items-center justify-center rounded-full border border-stone-200/50 bg-white/80 px-5 py-2 text-xs font-medium tracking-tight text-stone-600',
                    'transition-colors hover:border-violet-200/40 hover:bg-white hover:text-stone-800',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50'
                  )}
                >
                  {MIRROR_UPDATE_LABEL}
                </button>
                {sceneImageStatus === 'error' ? (
                  <MirrorSceneGenerateButton
                    status={sceneImageStatus}
                    onGenerate={() => void handleGenerateMirrorScene()}
                    disabled={!generatedDailyCard?.visual?.prompt}
                  />
                ) : sceneImageStatus === 'generating' ? (
                  <MirrorSceneGenerateButton
                    status={sceneImageStatus}
                    onGenerate={() => {}}
                    disabled
                  />
                ) : sceneImageStatus === 'ready' ? (
                  <MirrorSceneGenerateButton
                    status={sceneImageStatus}
                    onGenerate={() => {}}
                    disabled
                  />
                ) : null}
              </>
            ) : (
              <>
                <p className={cn(ms.sceneWrap, 'text-center text-[11px] text-stone-500')}>
                  {FREE_MIRROR_READY_PLUS_HINT}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateDailyMirror}
                  className={cn(
                    'text-[12px] font-medium text-stone-500 underline-offset-2',
                    'transition-colors hover:text-violet-700 hover:underline',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400'
                  )}
                >
                  {FREE_MIRROR_CREATE_ANOTHER}
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    const promptVariant: 'idle' | 'insufficient' | 'error' =
      dailyStatus === 'error'
        ? 'error'
        : dailyStatus === 'insufficient'
          ? 'insufficient'
          : 'idle';

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
        onCopyText={mirrorExport.copyText}
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
