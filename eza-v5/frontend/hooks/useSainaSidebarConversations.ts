'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { listConversationGroups } from '@/lib/eza/conversation-tree/conversationGroups';
import {
  getGroupsForAuthenticatedSidebar,
  subscribeServerConversationGroups,
  getGroupAuthorityPhase,
} from '@/lib/eza/serverConversationGroupStore';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { readActiveChatId, type ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { useAuth } from '@/context/AuthContext';

/** Shared sidebar list shape — same tree on chat, discover, and pattern routes. */
export function useSainaSidebarConversations(
  archives: ArchivedChatSummary[],
  activeChatId?: string | null
) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const userId = user?.user_id ?? null;
  const resolvedActiveId = (activeChatId ?? readActiveChatId()) || null;

  const groupPhase = useSyncExternalStore(
    subscribeServerConversationGroups,
    getGroupAuthorityPhase,
    () => 'none' as const
  );

  const authorityGroups = useSyncExternalStore(
    subscribeServerConversationGroups,
    () => getGroupsForAuthenticatedSidebar(userId),
    () => []
  );

  const conversations = useMemo(
    () => mapArchivesToSainaConversations(archives, resolvedActiveId),
    [archives, resolvedActiveId]
  );

  const conversationGroups = useMemo(() => {
    const groups =
      isAuthReady && isAuthenticated && userId
        ? authorityGroups
        : listConversationGroups();
    return buildConversationTree(archives, groups, resolvedActiveId);
    // groupPhase forces recompute on authority flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    archives,
    resolvedActiveId,
    isAuthReady,
    isAuthenticated,
    userId,
    authorityGroups,
    groupPhase,
  ]);

  return { conversations, conversationGroups, activeChatId: resolvedActiveId };
}
