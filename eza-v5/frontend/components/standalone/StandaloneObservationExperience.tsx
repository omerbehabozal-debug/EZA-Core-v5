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
import LastObservationHero from '@/components/governance/LastObservationHero';
import RelationshipMapView from '@/components/standalone/RelationshipMapView';

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
        <p className={reportSkin.eyebrow}>EZA&apos;nın Son Gözlemi</p>
        <p className="mt-6 max-w-md text-2xl font-medium leading-snug text-stone-900">
          AI ile kurduğun ilişkinin gözlemsel aynası
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Birkaç sohbetten sonra son gözlem ve ilişki haritası burada belirecek.
        </p>
      </div>
    );
  }

  const model =
    reportModel ?? emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');

  const observation = model.dailyObservation;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <nav
        className={cn(standaloneSkin.observationTabList, 'mx-4 sm:mx-0')}
        aria-label="Gözlem sekmeleri"
      >
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
            <LastObservationHero
              observation={observation}
              personaSeed={`${observation.categoryId ?? 'quiet'}-${entries[0]?.interaction_id ?? 'seed'}`}
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
