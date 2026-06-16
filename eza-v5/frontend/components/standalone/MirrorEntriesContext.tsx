'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BEHAVIORAL_HISTORY_UPDATED,
  readBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';

type MirrorEntriesContextValue = {
  entries: SavedBehavioralEntry[];
  setConversationEntries: (entries: SavedBehavioralEntry[]) => void;
};

const MirrorEntriesContext = createContext<MirrorEntriesContextValue>({
  entries: [],
  setConversationEntries: () => {},
});

/** Ayna alt görünümlerinin (Günlük / İlişki / sohbet paneli) paylaştığı davranış geçmişi. */
export function useMirrorEntries(): SavedBehavioralEntry[] {
  return useContext(MirrorEntriesContext).entries;
}

export function useSetConversationMirrorEntries(): MirrorEntriesContextValue['setConversationEntries'] {
  return useContext(MirrorEntriesContext).setConversationEntries;
}

export function MirrorEntriesProvider({ children }: { children: ReactNode }) {
  const [globalEntries, setGlobalEntries] = useState<SavedBehavioralEntry[]>([]);
  const [conversationEntries, setConversationEntries] = useState<SavedBehavioralEntry[]>([]);

  const refreshGlobal = useCallback(() => {
    setGlobalEntries(readBehavioralHistory());
  }, []);

  useEffect(() => {
    refreshGlobal();
    const onUpdate = () => refreshGlobal();
    window.addEventListener(BEHAVIORAL_HISTORY_UPDATED, onUpdate);
    window.addEventListener('focus', onUpdate);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onUpdate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener(BEHAVIORAL_HISTORY_UPDATED, onUpdate);
      window.removeEventListener('focus', onUpdate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshGlobal]);

  const entries = useMemo(
    () => (conversationEntries.length > 0 ? conversationEntries : globalEntries),
    [conversationEntries, globalEntries]
  );

  const value = useMemo(
    () => ({ entries, setConversationEntries }),
    [entries, setConversationEntries]
  );

  return (
    <MirrorEntriesContext.Provider value={value}>{children}</MirrorEntriesContext.Provider>
  );
}
