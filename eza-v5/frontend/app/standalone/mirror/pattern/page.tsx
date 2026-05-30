'use client';

import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';

export default function StandaloneMirrorPatternPage() {
  const entries = useMirrorEntries();
  return <RelationshipPatternView entries={entries} className="min-h-0 flex-1" />;
}
