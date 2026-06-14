'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import {
  backfillBehavioralHistoryFromArchives,
  PATTERN_DEVICE_SIDEBAR_NOTICE,
  resolvePatternDeviceState,
  type PatternDeviceState,
} from '@/lib/eza/patternDeviceSync';

export function usePatternDeviceSync(options: {
  isPremium: boolean;
  archives: ArchivedChatSummary[];
}): {
  entries: SavedBehavioralEntry[];
  deviceState: PatternDeviceState;
  patternDeviceNotice: string | null;
} {
  const realEntries = useMirrorEntries();
  const backfillAttempted = useRef(false);

  useEffect(() => {
    if (!options.isPremium) return;
    if (realEntries.length > 0) return;
    if (!options.archives.some((a) => a.messageCount > 0)) return;
    if (backfillAttempted.current) return;
    backfillAttempted.current = true;
    backfillBehavioralHistoryFromArchives();
  }, [options.isPremium, options.archives, realEntries.length]);

  const entries = useMemo(
    () => (options.isPremium ? realEntries : []),
    [options.isPremium, realEntries]
  );

  const deviceState = useMemo(
    () =>
      resolvePatternDeviceState({
        isPremium: options.isPremium,
        entries,
        archives: options.archives,
      }),
    [options.isPremium, entries, options.archives]
  );

  const patternDeviceNotice = useMemo(
    () => (deviceState === 'chats_pending_pattern' ? PATTERN_DEVICE_SIDEBAR_NOTICE : null),
    [deviceState]
  );

  return { entries, deviceState, patternDeviceNotice };
}
