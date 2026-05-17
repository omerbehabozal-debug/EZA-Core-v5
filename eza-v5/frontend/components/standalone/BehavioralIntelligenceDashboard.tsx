'use client';

import { useMemo } from 'react';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import {
  buildBehavioralDashboard,
  BEHAVIORAL_DISCLAIMER,
} from '@/lib/eza/behavioralDashboard';
import {
  buildGovernanceReportFromBehavioral,
  emptyGovernanceReportPlaceholder,
} from '@/lib/eza/governanceReportModel';
import { reportSkin } from '@/lib/eza/reportSkin';
import { STANDALONE_SIGNAL_NOTE } from '@/lib/eza/presentationTone';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

interface BehavioralIntelligenceDashboardProps {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}

export default function BehavioralIntelligenceDashboard({
  entries,
  onClear,
}: BehavioralIntelligenceDashboardProps) {
  const dash = useMemo(() => {
    try {
      return buildBehavioralDashboard(entries);
    } catch (e) {
      console.error('[behavioralDashboard] build failed', e);
      return null;
    }
  }, [entries]);

  const reportModel = useMemo(() => {
    if (!dash || entries.length === 0) return null;
    try {
      return buildGovernanceReportFromBehavioral(dash, entries);
    } catch (e) {
      console.error('[behavioralDashboard] governance map failed', e);
      return null;
    }
  }, [dash, entries]);

  if (!dash && entries.length > 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-stone-600">Rapor yüklenirken bir sorun oluştu. Sayfayı yenileyin.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <p className={reportSkin.eyebrow}>EZA&apos;nın Son Gözlemi</p>
        <p className="mt-6 max-w-md text-2xl font-medium leading-snug text-stone-900">
          EZA bugün senin hakkında ne fark edecek?
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Birkaç sohbetten sonra son gözlem burada belirecek — yargı değil, kısa bir etkileşim notu.
        </p>
      </div>
    );
  }

  const model =
    reportModel ??
    emptyGovernanceReportPlaceholder('Gözlem şu an yüklenemedi.');

  return (
    <div className="-mx-4 sm:mx-0">
      <GovernanceInteractionReportView
        model={{ ...model, disclaimer: BEHAVIORAL_DISCLAIMER }}
        signalNote={STANDALONE_SIGNAL_NOTE}
        trendValueLabel="AI yanıt skoru"
        onClearHistory={onClear}
        embeddedInStandalone
      />
    </div>
  );
}
