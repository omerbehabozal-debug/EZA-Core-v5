'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildBehavioralDashboard } from '@/lib/eza/behavioralDashboard';
import {
  buildGovernanceReportFromBehavioral,
  emptyGovernanceReportPlaceholder,
  type GovernanceReportViewModel,
} from '@/lib/eza/governanceReportModel';
import { STANDALONE_SIGNAL_NOTE } from '@/lib/eza/presentationTone';
import {
  MIRROR_DETAILS_SUMMARY,
  MIRROR_EPHEMERAL_NOTE,
  MIRROR_NAV_ARIA,
  MIRROR_PAGE_SUBTITLE,
  MIRROR_PAGE_TITLE,
  MIRROR_PRIVACY_SHORT,
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
import { generateMirrorScene } from '@/lib/eza/mirror/generateSceneApi';
import DailyMirrorPosterCard from '@/components/mirror/DailyMirrorPosterCard';
import DailyMirrorCreatePrompt from '@/components/mirror/DailyMirrorCreatePrompt';
import MirrorSceneGenerateButton from '@/components/mirror/MirrorSceneGenerateButton';
import MirrorShareModal from '@/components/mirror/MirrorShareModal';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';
import { useMirrorCardExport } from '@/hooks/useMirrorCardExport';
import ReportsPanelTransition from '@/components/standalone/ReportsPanelTransition';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const sh = standaloneSkin.share;

type ObservationTab = 'last' | 'map';

type DailyMirrorStatus = 'idle' | 'generating' | 'ready' | 'insufficient';

interface StandaloneObservationExperienceProps {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}

export default function StandaloneObservationExperience({
  entries,
  onClear,
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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const mirrorExport = useMirrorCardExport();

  const hasEntries = entries.length > 0;

  const dash = useMemo(() => {
    if (!hasEntries) return null;
    try {
      return buildBehavioralDashboard(entries);
    } catch {
      return null;
    }
  }, [entries, hasEntries]);

  const reportModel: GovernanceReportViewModel | null = useMemo(() => {
    if (!hasEntries || !dash) return null;
    try {
      return buildGovernanceReportFromBehavioral(dash, entries);
    } catch {
      return null;
    }
  }, [dash, entries, hasEntries]);

  const model = useMemo(
    () =>
      hasEntries
        ? reportModel ?? emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.')
        : null,
    [hasEntries, reportModel]
  );

  const observation = model?.dailyObservation;
  const rp = standaloneSkin.reportsPremium;
  const op = standaloneSkin.observationPolish;

  useEffect(() => {
    if (entries.length === 0) {
      setGeneratedDailyCard(null);
      setGeneratedDailyMeta(null);
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setDailyStatus('idle');
    }
  }, [entries.length]);

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
    setDailyStatus('generating');
    window.setTimeout(() => {
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
      setSceneImageUrl(null);
      setSceneImageStatus('idle');
      setDailyStatus('ready');
    }, 120);
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

  const showShareButton =
    tab === 'last' &&
    dailyStatus === 'ready' &&
    generatedDailyCard !== null &&
    generatedDailyCard.shareEnabled;

  const renderDailyPanel = () => {
    if (dailyStatus === 'ready' && cardForRender) {
      return (
        <>
          <div ref={mirrorExport.cardRef} data-mirror-card>
            <DailyMirrorPosterCard
              card={cardForRender}
              meta={generatedDailyMeta ?? undefined}
              onSceneImageLoad={handleSceneImageLoad}
              onSceneImageError={handleSceneImageError}
            />
          </div>
          <MirrorSceneGenerateButton
            status={sceneImageStatus}
            onGenerate={() => void handleGenerateMirrorScene()}
            disabled={!generatedDailyCard?.visual?.prompt}
          />
          <p className="text-center text-sm leading-relaxed text-stone-500">
            {MIRROR_EPHEMERAL_NOTE}
          </p>

          {model && observation ? (
            <details
              ref={detailsRef}
              className="rounded-2xl border border-white/70 bg-white/50 open:bg-white/65"
            >
              <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-stone-600 marker:content-none [&::-webkit-details-marker]:hidden">
                {MIRROR_DETAILS_SUMMARY}
              </summary>
              <div className="border-t border-violet-100/50 px-2 pb-4 pt-2">
                <GovernanceInteractionReportView
                  model={{ ...model, disclaimer: MIRROR_PRIVACY_SHORT }}
                  signalNote={STANDALONE_SIGNAL_NOTE}
                  trendValueLabel="AI yanıt yansıması"
                  onClearHistory={onClear}
                  embeddedInStandalone
                  observationMode="details-only"
                />
              </div>
            </details>
          ) : null}
        </>
      );
    }

    const promptVariant =
      dailyStatus === 'generating'
        ? 'generating'
        : dailyStatus === 'insufficient'
          ? 'insufficient'
          : 'idle';

    return (
      <DailyMirrorCreatePrompt variant={promptVariant} onGenerate={handleGenerateDailyMirror} />
    );
  };

  const renderPanel = useCallback(
    (key: string) => {
      if (key === 'last') {
        return (
          <>
            {renderDailyPanel()}
            <div className={rp.disclaimerBar} role="note">
              <Shield className={rp.disclaimerIcon} aria-hidden />
              <p>{MIRROR_PRIVACY_SHORT}</p>
            </div>
          </>
        );
      }

      return <RelationshipPatternView entries={entries} />;
    },
    [
      dailyStatus,
      cardForRender,
      generatedDailyMeta,
      entries,
      model,
      observation,
      onClear,
      handleGenerateDailyMirror,
      handleGenerateMirrorScene,
      sceneImageStatus,
      handleSceneImageLoad,
      handleSceneImageError,
      mirrorExport.cardRef,
      rp.disclaimerBar,
      rp.disclaimerIcon,
    ]
  );

  return (
    <div className={cn(rp.container, rp.sectionStack)}>
      <div className={rp.ambientLayer} aria-hidden>
        <div className={rp.ambientOrbA} />
        <div className={rp.ambientOrbB} />
        <div className={rp.ambientOrbC} />
      </div>

      <header className={rp.pageHeader}>
        <div className="min-w-0 flex-1">
          <h1 className={op.headerTitle}>
            <span className={rp.pageTitleRow}>
              <Sparkles className={rp.pageTitleIcon} aria-hidden />
              {MIRROR_PAGE_TITLE}
            </span>
          </h1>
          <p className={op.headerSub}>{MIRROR_PAGE_SUBTITLE}</p>
        </div>
        {showShareButton ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={cn(sh.triggerBtn, 'sm:w-auto sm:self-start')}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            {MIRROR_SHARE_LABEL}
          </button>
        ) : null}
      </header>

      <nav className={standaloneSkin.observationTabList} aria-label={MIRROR_NAV_ARIA}>
        <button
          type="button"
          onClick={() => setTab('last')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'last' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          {MIRROR_TAB_DAILY}
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'map' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
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
