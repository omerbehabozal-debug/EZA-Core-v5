'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { STANDALONE_SIGNAL_NOTE } from '@/lib/eza/presentationTone';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import StandaloneObservationHero from '@/components/standalone/StandaloneObservationHero';
import RelationshipMapView from '@/components/standalone/RelationshipMapView';
import { buildPersonaSeed } from '@/lib/standaloneObservation';

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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const observationPanelRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);

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

  const selectTab = useCallback((next: ObservationTab) => {
    setTab(next);
    const isWide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
    if (!isWide) return;
    const target =
      next === 'last' ? observationPanelRef.current : mapPanelRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <h2 className={standaloneSkin.observationPolish.headerTitle}>
          Bugün AI ile ilişkin nasıl?
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-500">
          Birkaç sohbetten sonra son gözlem burada belirecek. İlişki haritası sağda görünecek.
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

  const rp = standaloneSkin.reportsPremium;

  const observationBlock = observation.show ? (
    <StandaloneObservationHero
      observation={observation}
      personaSeed={personaSeed}
      onScrollDetails={() =>
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    />
  ) : null;

  const detailsBlock = (
    <details ref={detailsRef} className="mt-10 rounded-2xl border border-indigo-500/10 bg-white/50 open:bg-white/70">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-stone-600 marker:content-none [&::-webkit-details-marker]:hidden">
        İsteğe bağlı teknik detaylar
      </summary>
      <div className="border-t border-indigo-500/10 px-1 pb-4 pt-2">
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
  );

  return (
    <div className={rp.container}>
      <nav
        className={cn(standaloneSkin.observationTabList, 'sticky top-0 z-20 mb-6 backdrop-blur-md')}
        aria-label="Gözlem sekmeleri"
      >
        <button
          type="button"
          onClick={() => selectTab('last')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'last' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          EZA&apos;nın Son Gözlemi
        </button>
        <button
          type="button"
          onClick={() => selectTab('map')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'map' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          EZA İlişki Haritası
        </button>
      </nav>

      {/* Desktop: mockup-style iki sütun */}
      <div className={rp.splitGrid}>
        <div ref={observationPanelRef} className={rp.splitColObservation}>
          {observationBlock}
          {detailsBlock}
        </div>
        <div ref={mapPanelRef} id="map-panel" className={rp.splitColMap}>
          <RelationshipMapView entries={entries} variant="sidebar" />
        </div>
      </div>

      {/* Mobil: sekme ile tek panel */}
      <div className={rp.mobileOnly}>
        {tab === 'last' ? (
          <>
            {observationBlock}
            {detailsBlock}
          </>
        ) : (
          <RelationshipMapView entries={entries} variant="full" />
        )}
      </div>
    </div>
  );
}
