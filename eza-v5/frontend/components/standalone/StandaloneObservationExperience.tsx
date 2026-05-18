'use client';

import { useMemo, useRef, useState } from 'react';
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
import { reportSkin } from '@/lib/eza/reportSkin';
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
  const detailsRef = useRef<HTMLDivElement>(null);

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

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <h2 className={standaloneSkin.observationPolish.headerTitle}>
          Bugün AI ile ilişkin nasıl?
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-500">
          Birkaç sohbetten sonra son gözlem burada belirecek. İlişki haritası ikinci sekmede.
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

  return (
    <div className={rp.container}>
      <nav className={standaloneSkin.observationTabList} aria-label="Gözlem sekmeleri">
        <button
          type="button"
          onClick={() => setTab('last')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'last' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          EZA&apos;nın Son Gözlemi
        </button>
        <button
          type="button"
          onClick={() => setTab('map')}
          className={cn(
            standaloneSkin.observationTab,
            tab === 'map' ? standaloneSkin.observationTabActive : standaloneSkin.observationTabIdle
          )}
        >
          EZA İlişki Haritası
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
          <div ref={detailsRef}>
            <GovernanceInteractionReportView
              model={{ ...model, disclaimer: BEHAVIORAL_DISCLAIMER }}
              signalNote={STANDALONE_SIGNAL_NOTE}
              trendValueLabel="AI yanıt skoru"
              onClearHistory={onClear}
              embeddedInStandalone
              observationMode="details-only"
            />
          </div>
        </>
      ) : (
        <RelationshipMapView entries={entries} />
      )}
    </div>
  );
}
