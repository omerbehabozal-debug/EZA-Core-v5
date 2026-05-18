'use client';

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import StandaloneObservationExperience from '@/components/standalone/StandaloneObservationExperience';

interface BehavioralIntelligenceDashboardProps {
  entries: SavedBehavioralEntry[];
  onClear?: () => void;
}

export default function BehavioralIntelligenceDashboard({
  entries,
  onClear,
}: BehavioralIntelligenceDashboardProps) {
  return <StandaloneObservationExperience entries={entries} onClear={onClear} />;
}
