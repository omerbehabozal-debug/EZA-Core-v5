'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  MIRROR_NAV_ARIA,
  MIRROR_PAGE_SUBTITLE,
  MIRROR_PAGE_TITLE,
  MIRROR_REVEAL_DURATION_MS,
  MIRROR_SHARE_LABEL,
  MIRROR_TAB_DAILY,
  MIRROR_TAB_PATTERN,
} from '@/lib/eza/mirror/copy';
import type {
  DailyMirrorCardModel,
  MirrorSceneImageStatus,
  MirrorStateMeta,
} from '@/lib/eza/mirror/types';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { mergeDailyCardSceneVisual } from '@/lib/eza/mirror/mirrorSceneImage';
import {
  resolveMirrorIntentContext,
  withDevVehicleCueHints,
} from '@/lib/eza/mirror/mirrorIntentContext';
import { generateMirrorScene } from '@/lib/eza/mirror/generateSceneApi';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import DailyMirrorCreatePrompt from '@/components/mirror/DailyMirrorCreatePrompt';
import DailyMirrorReveal from '@/components/mirror/DailyMirrorReveal';
import DailyMirrorCardEntrance from '@/components/mirror/DailyMirrorCardEntrance';
import MirrorSceneGenerateButton from '@/components/mirror/MirrorSceneGenerateButton';
import MirrorShareModal from '@/components/mirror/MirrorShareModal';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';
import { useMirrorCardExport } from '@/hooks/useMirrorCardExport';
import ReportsPanelTransition from '@/components/standalone/ReportsPanelTransition';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

type ObservationTab = 'last' | 'map';

type DailyMirrorStatus = 'idle' | 'revealing' | 'ready' | 'insufficient' | 'error';

interface StandaloneObservationExperienceProps {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}

export default function StandaloneObservationExperience({
  entries,
}: StandaloneObservationExperienceProps) {
  const [tab, setTab] = useState<ObservationTab>('last');
  const [shareOpen, setShareOpen] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyMirrorStatus>('idle');
  const [generatedDailyCard, setGeneratedDailyCard] = useState<DailyMirrorCardModel | null>(
    null
  );
  const [generatedDailyMeta, setGeneratedDailyMeta] = useState<MirrorStateMeta | null>(null);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const [sceneImageStatus, setSceneImageStatus] = useState<MirrorSceneImageStatus>('idle');
  const [cardIntentFingerprint, setCardIntentFingerprint] = useState<string | null>(null);
  const mirrorExport = useMirrorCardExport();

  const liveIntentFingerprint = useMemo(() => {
    if (!entries.length) return null;
    return resolveMirrorIntentContext({ entries }).intentFingerprint;
  }, [entries]);

  const rp = standaloneSkin.reportsPremium;
  const op = standaloneSkin.observationPolish;
  const ms = standaloneSkin.mirrorSurface;

  useEffect(() => {
    if (entries.length === 0) {
      setGeneratedDailyCard(null);
      setGeneratedDailyMeta(null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setCardIntentFingerprint(null);
      setDailyStatus('idle');
    }
  }, [entries.length]);

  /** Bust stale scene when history/intent changes after card was generated. */
  useEffect(() => {
    if (dailyStatus !== 'ready' || !generatedDailyCard || !liveIntentFingerprint) return;
    if (cardIntentFingerprint && liveIntentFingerprint !== cardIntentFingerprint) {
      const state = buildMirrorState(entries);
      setGeneratedDailyCard(state.dailyMirrorCard);
      setGeneratedDailyMeta(state.meta);
      setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
    }
  }, [entries, dailyStatus, liveIntentFingerprint, cardIntentFingerprint]);

  const cardForRender = useMemo(
    () =>
      generatedDailyCard
        ? mergeDailyCardSceneVisual(generatedDailyCard, sceneImageUrl, sceneImageStatus)
        : null,
    [generatedDailyCard, sceneImageUrl, sceneImageStatus]
  );

  const handleSceneImageLoad = useCallback(() => {
    if (sceneImageUrl) {
      setSceneImageStatus('ready');
    }
  }, [sceneImageUrl]);

  const handleSceneImageError = useCallback(() => {
    setSceneImageStatus('error');
  }, []);

  const handleGenerateMirrorScene = useCallback(async () => {
    if (!generatedDailyCard?.visual) return;
    setSceneImageStatus('generating');
    setSceneImageUrl(null);
    try {
      const result = await generateMirrorScene(
        generatedDailyCard.visual,
        generatedDailyCard.date
      );
      setSceneImageUrl(result.sceneImageUrl);
      setSceneImageStatus('ready');
    } catch {
      setSceneImageUrl(null);
      setSceneImageStatus('error');
    }
  }, [generatedDailyCard]);

  const handleGenerateDailyMirror = useCallback(() => {
    setDailyStatus('revealing');
    window.setTimeout(() => {
      try {
        const state = buildMirrorState(entries);
        if (!state.meta.hasEnoughData || !state.dailyMirrorCard.shareEnabled) {
          setGeneratedDailyCard(null);
          setGeneratedDailyMeta(null);
          setSceneImageUrl(null);
          setSceneImageStatus('idle');
          setDailyStatus('insufficient');
          return;
        }
        setGeneratedDailyCard(state.dailyMirrorCard);
        setGeneratedDailyMeta(state.meta);
        setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
        setSceneImageUrl(null);
        setSceneImageStatus('idle');
        setDailyStatus('ready');
      } catch {
        setGeneratedDailyCard(null);
        setGeneratedDailyMeta(null);
        setDailyStatus('error');
      }
    }, MIRROR_REVEAL_DURATION_MS);
  }, [entries]);

  const handleForceBmwMercedes = useCallback(() => {
    const boosted = withDevVehicleCueHints(entries);
    const state = buildMirrorState(boosted, { seed: 'force-bmw-mercedes-dev' });
    setGeneratedDailyCard(state.dailyMirrorCard);
    setGeneratedDailyMeta(state.meta);
    setCardIntentFingerprint(state.dailyMirrorCard.visual?.intentFingerprint ?? null);
    setSceneImageUrl(null);
    setSceneImageStatus('idle');
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
    return mirrorExport.download(generatedDailyCard?.date);
  }, [mirrorExport, generatedDailyCard?.date]);

  const handleShareNative = useCallback(async () => {
    await mirrorExport.share(generatedDailyCard?.date);
  }, [mirrorExport, generatedDailyCard?.date]);

  const showShareAction =
    dailyStatus === 'ready' &&
    generatedDailyCard !== null &&
    generatedDailyCard.shareEnabled;

  const renderDailyPanel = () => {
    if (dailyStatus === 'revealing') {
      return <DailyMirrorReveal />;
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
              />
            </div>
          </DailyMirrorCardEntrance>

          <div className="flex w-full max-w-sm flex-col items-center gap-4">
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
            <MirrorSceneGenerateButton
              status={sceneImageStatus}
              onGenerate={() => void handleGenerateMirrorScene()}
              disabled={!generatedDailyCard?.visual?.prompt}
            />
          </div>
        </div>
      );
    }

    const promptVariant =
      dailyStatus === 'insufficient' || dailyStatus === 'error' ? 'insufficient' : 'idle';

    return (
      <DailyMirrorCreatePrompt variant={promptVariant} onGenerate={handleGenerateDailyMirror} />
    );
  };

  const renderPanel = useCallback(
    (key: string) => {
      if (key === 'last') {
        return <div className={ms.dailyStage}>{renderDailyPanel()}</div>;
      }

      return <RelationshipPatternView entries={entries} />;
    },
    [
      dailyStatus,
      cardForRender,
      generatedDailyMeta,
      entries,
      handleGenerateDailyMirror,
      handleGenerateMirrorScene,
      sceneImageStatus,
      handleSceneImageLoad,
      handleSceneImageError,
      mirrorExport.cardRef,
      showShareAction,
      ms.dailyStage,
      ms.dailyReadyStack,
      ms.shareAction,
    ]
  );

  return (
    <div className={cn(rp.container, rp.sectionStack)}>
      <div className={rp.ambientLayer} aria-hidden>
        <div className={rp.ambientOrbA} />
        <div className={rp.ambientOrbB} />
        <div className={rp.ambientOrbC} />
      </div>

      <header className={cn(rp.pageHeader, 'sm:mb-2')}>
        <div className="min-w-0 flex-1">
          <h1 className={op.headerTitle}>
            <span className={cn(rp.pageTitleRow, 'gap-2')}>
              <Sparkles
                className="h-6 w-6 text-violet-500/80 sm:h-7 sm:w-7"
                strokeWidth={1.5}
                aria-hidden
              />
              {MIRROR_PAGE_TITLE}
            </span>
          </h1>
          <p className={cn(op.headerSub, 'mt-2 max-w-md text-stone-500/85')}>
            {MIRROR_PAGE_SUBTITLE}
          </p>
        </div>
      </header>

      <nav className={ms.tabList} aria-label={MIRROR_NAV_ARIA}>
        <button
          type="button"
          onClick={() => setTab('last')}
          className={cn(ms.tab, tab === 'last' ? ms.tabActive : ms.tabIdle)}
        >
          {MIRROR_TAB_DAILY}
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={cn(ms.tab, tab === 'map' ? ms.tabActive : ms.tabIdle)}
        >
          {MIRROR_TAB_PATTERN}
        </button>
      </nav>

      <ReportsPanelTransition activeKey={tab} className={rp.panelStage}>
        {renderPanel}
      </ReportsPanelTransition>

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
    </div>
  );
}
