'use client';

import { useMemo, useRef, useState } from 'react';
import { Share2, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildBehavioralDashboard,
  BEHAVIORAL_DISCLAIMER,
} from '@/lib/eza/behavioralDashboard';
import {
  buildGovernanceReportFromBehavioral,
  emptyGovernanceReportPlaceholder,
  type GovernanceReportViewModel,
} from '@/lib/eza/governanceReportModel';
import { MIRROR_LABELS, STANDALONE_OBSERVATION_SUB, STANDALONE_SIGNAL_NOTE } from '@/lib/eza/presentationTone';
import { pickStandalonePersona } from '@/lib/eza/standalonePersonas';
import { buildObservationSharePayload } from '@/lib/eza/standaloneShare';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import StandaloneObservationHero from '@/components/standalone/StandaloneObservationHero';
import RelationshipMapView from '@/components/standalone/RelationshipMapView';
import StandaloneShareModal from '@/components/standalone/StandaloneShareModal';
import { buildPersonaSeed } from '@/lib/standaloneObservation';

const sh = standaloneSkin.share;

type ObservationTab = 'last' | 'map';

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
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const dash = useMemo(() => {
    try {
      return buildBehavioralDashboard(entries);
    } catch {
      return null;
    }
  }, [entries]);

  const reportModel: GovernanceReportViewModel | null = useMemo(() => {
    if (!dash || entries.length === 0) return null;
    try {
      return buildGovernanceReportFromBehavioral(dash, entries);
    } catch {
      return null;
    }
  }, [dash, entries]);

  const rp = standaloneSkin.reportsPremium;
  const op = standaloneSkin.observationPolish;

  if (entries.length === 0) {
    return (
      <div className={cn(rp.container, 'text-center')}>
        <div className={rp.pageHeader}>
          <div>
            <h1 className={op.headerTitle}>
              <span className={rp.pageTitleRow}>
                <Sparkles className={rp.pageTitleIcon} aria-hidden />
                Bugün AI ile ilişkin nasıl?
              </span>
            </h1>
            <p className={op.headerSub}>{STANDALONE_OBSERVATION_SUB}</p>
          </div>
        </div>
        <p className="mt-8 text-sm text-stone-500">
          Birkaç sohbetten sonra gözlemin burada belirecek.
        </p>
      </div>
    );
  }

  const model =
    reportModel ?? emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');

  const observation = model.dailyObservation;
  const personaSeed = buildPersonaSeed(
    entries,
    observation.personaFamilyId ?? 'balanced_calm'
  );

  const persona = pickStandalonePersona(
    observation.personaFamilyId ?? observation.categoryId,
    personaSeed
  );

  const sharePayload = useMemo(
    () => buildObservationSharePayload(observation, persona),
    [observation, persona]
  );

  const mirror = MIRROR_LABELS.standalone;

  return (
    <div className={cn(rp.container, rp.sectionStack)}>
      <header className={rp.pageHeader}>
        <div className="min-w-0 flex-1">
          <h1 className={op.headerTitle}>
            <span className={rp.pageTitleRow}>
              <Sparkles className={rp.pageTitleIcon} aria-hidden />
              Bugün AI ile ilişkin nasıl?
            </span>
          </h1>
          <p className={op.headerSub}>{STANDALONE_OBSERVATION_SUB}</p>
        </div>
        {tab === 'last' && observation.show ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={cn(sh.triggerBtn, 'shrink-0')}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Paylaş
          </button>
        ) : null}
      </header>

      <nav className={standaloneSkin.observationTabList} aria-label="Gözlem sekmeleri">
        <button
          type="button"
          onClick={() => setTab('last')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'last' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          Bugünkü Gözlem
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'map' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          İlişki Haritası
        </button>
      </nav>

      {tab === 'last' ? (
        <>
          {observation.show ? (
            <StandaloneObservationHero
              observation={observation}
              personaSeed={personaSeed}
              onScrollDetails={() =>
                detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            />
          ) : null}

          <details
            ref={detailsRef}
            className="rounded-2xl border border-white/70 bg-white/50 open:bg-white/65"
          >
            <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-stone-600 marker:content-none [&::-webkit-details-marker]:hidden">
              İsteğe bağlı teknik detaylar
            </summary>
            <div className="border-t border-violet-100/50 px-2 pb-4 pt-2">
              <GovernanceInteractionReportView
                model={{ ...model, disclaimer: BEHAVIORAL_DISCLAIMER }}
                signalNote={STANDALONE_SIGNAL_NOTE}
                trendValueLabel="AI yanıt skoru"
                onClearHistory={onClear}
                embeddedInStandalone
                observationMode="details-only"
              />
            </div>
          </details>

          <div className={rp.disclaimerBar} role="note">
            <Shield className={rp.disclaimerIcon} aria-hidden />
            <p>{BEHAVIORAL_DISCLAIMER}</p>
          </div>
        </>
      ) : (
        <RelationshipMapView entries={entries} variant="full" />
      )}

      <StandaloneShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareTitle={sharePayload.title}
        clipboardText={sharePayload.clipboardText}
      >
        <div className={sh.card}>
          <p className={sh.cardLogo}>EZA</p>
          <p className="mt-1 text-xs text-stone-500">{sharePayload.personaLabel}</p>
          <p className={sh.cardInsight}>{sharePayload.insight}</p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.user}: </span>
            {sharePayload.userLine}
          </p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.ai}: </span>
            {sharePayload.aiLine}
          </p>
          <p className={sh.cardRow}>
            <span className="font-medium text-stone-500">{mirror.balance}: </span>
            {sharePayload.balanceLine}
          </p>
          <p className={sh.cardWatermark}>eza.global</p>
        </div>
      </StandaloneShareModal>
    </div>
  );
}
