'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import {
  backfillBehavioralHistoryFromArchives,
  buildPatternSystemNotifications,
  resolvePatternDeviceState,
  type PatternDeviceState,
  type PatternSystemNotification,
} from '@/lib/eza/patternDeviceSync';

export function usePatternDeviceSync(options: {
  hasMapDataAccess: boolean;
  archives: ArchivedChatSummary[];
}): {
  entries: SavedBehavioralEntry[];
  deviceState: PatternDeviceState;
  systemNotifications: PatternSystemNotification[];
} {
  const realEntries = useMirrorEntries();
  const backfillAttempted = useRef(false);

  useEffect(() => {
    if (!options.hasMapDataAccess) return;
    if (realEntries.length > 0) return;
    if (!options.archives.some((a) => a.messageCount > 0)) return;
    if (backfillAttempted.current) return;
    backfillAttempted.current = true;
    backfillBehavioralHistoryFromArchives();
  }, [options.hasMapDataAccess, options.archives, realEntries.length]);

  const entries = useMemo(
    () => (options.hasMapDataAccess ? realEntries : []),
    [options.hasMapDataAccess, realEntries]
  );

  const deviceState = useMemo(
    () =>
      resolvePatternDeviceState({
        hasMapDataAccess: options.hasMapDataAccess,
        entries,
        archives: options.archives,
      }),
    [options.hasMapDataAccess, entries, options.archives]
  );

  const systemNotifications = useMemo(
    () => buildPatternSystemNotifications(deviceState),
    [deviceState]
  );

  return { entries, deviceState, systemNotifications };
}
