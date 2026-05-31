'use client';

import { useMemo } from 'react';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';
import PatternPlusUpsellBanner from '@/components/mirror/relationship/PatternPlusUpsellBanner';
import { usePlan } from '@/lib/eza/plan/usePlan';

/** Free plan — behavioral history kullanılmaz; her zaman boş-durum deneyimi. */
const FREE_EMPTY_ENTRIES: SavedBehavioralEntry[] = [];

export default function StandaloneMirrorPatternPage() {
  const realEntries = useMirrorEntries();
  const { isPlus } = usePlan();

  const entries = useMemo(
    () => (isPlus ? realEntries : FREE_EMPTY_ENTRIES),
    [isPlus, realEntries]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!isPlus ? <PatternPlusUpsellBanner className="shrink-0" /> : null}
      <RelationshipPatternView
        entries={entries}
        previewMode={!isPlus}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
