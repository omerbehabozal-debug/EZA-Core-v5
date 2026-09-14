'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { listConversationGroups } from '@/lib/eza/conversation-tree/conversationGroups';
import {
  getGroupsForAuthenticatedSidebar,
  subscribeServerConversationGroups,
  getGroupAuthorityPhase,
} from '@/lib/eza/serverConversationGroupStore';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import {
  injectYansiItemsIntoConversationTree,
  mergeFlatSidebarWithYansiItems,
  projectReadyYansiSidebarItems,
} from '@/lib/eza/mirror/journey/projectYansiSidebarItems';
import {
  listAllJourneyArtifactsForOwner,
  subscribeMirrorJourneyArtifactStore,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { readActiveChatId, type ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { useAuth } from '@/context/AuthContext';

/** Shared sidebar list shape — same tree on chat, discover, and pattern routes. */
export function useSainaSidebarConversations(
  archives: ArchivedChatSummary[],
  activeChatId?: string | null
) {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const userId = user?.user_id ?? null;
  const journeyOwnerId = resolveJourneyOwnerKey(user?.user_id);
  const resolvedActiveId = (activeChatId ?? readActiveChatId()) || null;

  const [artifactTick, setArtifactTick] = useState(0);
  useEffect(() => {
    return subscribeMirrorJourneyArtifactStore(() => {
      setArtifactTick((n) => n + 1);
    });
  }, []);

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

  const yansiItems = useMemo(() => {
    void artifactTick;
    return projectReadyYansiSidebarItems(
      listAllJourneyArtifactsForOwner(journeyOwnerId)
    );
  }, [artifactTick, journeyOwnerId]);

  const conversations = useMemo(() => {
    const base = mapArchivesToSainaConversations(archives, resolvedActiveId);
    return mergeFlatSidebarWithYansiItems(base, yansiItems);
  }, [archives, resolvedActiveId, yansiItems]);

  const conversationGroups = useMemo(() => {
    const groups =
      isAuthReady && isAuthenticated && userId
        ? authorityGroups
        : listConversationGroups();
    const tree = buildConversationTree(archives, groups, resolvedActiveId);
    const groupByConv: Record<string, string | null | undefined> = {};
    for (const row of archives) {
      groupByConv[row.id] = row.groupId ?? null;
    }
    return injectYansiItemsIntoConversationTree(tree, yansiItems, groupByConv);
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
    yansiItems,
  ]);

  return { conversations, conversationGroups, activeChatId: resolvedActiveId };
}
