'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
import { cn } from '@/lib/utils';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

const STANDALONE_SIGNAL_NOTE =
  'EZA mesaj metnini saklamadan yalnızca sayısal etkileşim sinyallerini analiz eder.';

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
        <Link href="/standalone" className={cn('mt-4', reportSkin.link)}>
          ← Sohbete dön
        </Link>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <Link href="/standalone" className={cn('mb-8 self-start', reportSkin.link)}>
          ← Sohbete dön
        </Link>
        <p className={reportSkin.eyebrow}>Etkileşim Raporu</p>
        <p className="mt-6 max-w-md text-2xl font-medium leading-snug text-stone-900">
          Seni tanımak için biraz daha zaman gerekiyor.
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Sohbette birkaç yanıt aldıktan sonra ilk davranışsal gözleminiz burada belirecek.
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
        backHref="/standalone"
        backLabel="← Sohbete dön"
        signalNote={STANDALONE_SIGNAL_NOTE}
        trendValueLabel="AI yanıt skoru"
        onClearHistory={onClear}
      />
    </div>
  );
}
