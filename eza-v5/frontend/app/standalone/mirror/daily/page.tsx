'use client';

import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import StandaloneObservationExperience from '@/components/standalone/StandaloneObservationExperience';

export default function StandaloneMirrorDailyPage() {
  const entries = useMirrorEntries();
  return <StandaloneObservationExperience entries={entries} />;
}
