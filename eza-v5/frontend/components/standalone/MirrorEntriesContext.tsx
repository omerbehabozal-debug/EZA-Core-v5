'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  BEHAVIORAL_HISTORY_UPDATED,
  readBehavioralHistory,
  type SavedBehavioralEntry,
} from '@/lib/behavioralHistory';

const MirrorEntriesContext = createContext<SavedBehavioralEntry[]>([]);

/** Ayna alt görünümlerinin (Günlük / İlişki) paylaştığı davranış geçmişi. */
export function useMirrorEntries(): SavedBehavioralEntry[] {
  return useContext(MirrorEntriesContext);
}

export function MirrorEntriesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SavedBehavioralEntry[]>([]);

  const refresh = useCallback(() => {
    setItems(readBehavioralHistory());
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
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
  }, [refresh]);

  return (
    <MirrorEntriesContext.Provider value={items}>{children}</MirrorEntriesContext.Provider>
  );
}
