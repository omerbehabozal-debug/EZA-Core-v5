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

/** Sentinel while chat shell is active but chat id is not yet assigned. */
export const PENDING_CONVERSATION_MIRROR_ID = '__pending_conversation__';

type MirrorEntriesContextValue = {
  entries: SavedBehavioralEntry[];
  activeConversationId: string | null;
  setConversationEntries: (
    entries: SavedBehavioralEntry[],
    conversationId?: string | null
  ) => void;
};

const MirrorEntriesContext = createContext<MirrorEntriesContextValue>({
  entries: [],
  activeConversationId: null,
  setConversationEntries: () => {},
});

/** Conversation Mirror entries — scoped to the active chat when in chat shell. */
export function useMirrorEntries(): SavedBehavioralEntry[] {
  return useContext(MirrorEntriesContext).entries;
}

export function useActiveConversationMirrorId(): string | null {
  const id = useContext(MirrorEntriesContext).activeConversationId;
  if (!id || id === PENDING_CONVERSATION_MIRROR_ID) return null;
  return id;
}

export function useSetConversationMirrorEntries(): MirrorEntriesContextValue['setConversationEntries'] {
  return useContext(MirrorEntriesContext).setConversationEntries;
}

export function MirrorEntriesProvider({ children }: { children: ReactNode }) {
  const [globalEntries, setGlobalEntries] = useState<SavedBehavioralEntry[]>([]);
  const [conversationEntries, setConversationEntriesState] = useState<SavedBehavioralEntry[]>(
    []
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

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

  const setConversationEntries = useCallback(
    (entries: SavedBehavioralEntry[], conversationId?: string | null) => {
      setConversationEntriesState(entries);
      if (conversationId !== undefined) {
        setActiveConversationId(conversationId);
      }
    },
    []
  );

  const entries = useMemo(() => {
    if (activeConversationId !== null) return conversationEntries;
    return globalEntries;
  }, [activeConversationId, conversationEntries, globalEntries]);

  const value = useMemo(
    () => ({ entries, activeConversationId, setConversationEntries }),
    [entries, activeConversationId, setConversationEntries]
  );

  return (
    <MirrorEntriesContext.Provider value={value}>{children}</MirrorEntriesContext.Provider>
  );
}
