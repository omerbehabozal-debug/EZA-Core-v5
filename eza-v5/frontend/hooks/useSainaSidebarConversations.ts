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
import { enrichConversationItemsWithYansiPresentation } from '@/lib/eza/mirror/journey/enrichConversationSidebarWithYansi';
import {
  listAllJourneyArtifactsForOwner,
  subscribeMirrorJourneyArtifactStore,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  getOwnerYansiPublicationSnapshot,
  hydrateOwnerYansiPublicationAuthority,
  markOwnerYansiPublicationAuthorityReadyEmpty,
  subscribeOwnerYansiPublicationAuthority,
} from '@/lib/eza/mirror/journey/ownerYansiPublicationAuthority';
import {
  isGuestJourneyOwnerKey,
  resolveJourneyOwnerKey,
} from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { readActiveChatId, type ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { useAuth } from '@/context/AuthContext';
import type { ConversationTreeChatItem } from '@/lib/eza/conversation-tree/types';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';

function toTreeChatItem(item: SainaConversationItem): ConversationTreeChatItem {
  return {
    id: item.id,
    kind: item.kind ?? 'conversation',
    sourceConversationId: item.sourceConversationId,
    journeyId: item.journeyId,
    journeyVersion: item.journeyVersion,
    yansiSourceIdentity: item.yansiSourceIdentity,
    title: item.title,
    preview: item.preview,
    time: item.time,
    thumbGradient: item.thumbGradient,
    thumbImageUrl: item.thumbImageUrl ?? null,
    savedAt: item.savedAt || new Date(0).toISOString(),
    isMirrorSource: Boolean(item.isMirrorSource),
    yansiStatus: item.yansiStatus,
    additionalYansiCount: item.additionalYansiCount,
    representativeYansiCount: item.representativeYansiCount,
  };
}

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

  const [publication, setPublication] = useState(getOwnerYansiPublicationSnapshot);
  useEffect(() => {
    return subscribeOwnerYansiPublicationAuthority(() => {
      setPublication(getOwnerYansiPublicationSnapshot());
    });
  }, []);

  const isGuest = !journeyOwnerId || isGuestJourneyOwnerKey(journeyOwnerId);
  const canFetchAuthority =
    Boolean(isAuthenticated) && isAuthReady !== false && !isGuest;

  useEffect(() => {
    if (canFetchAuthority) {
      void hydrateOwnerYansiPublicationAuthority();
      return;
    }
    markOwnerYansiPublicationAuthorityReadyEmpty();
  }, [canFetchAuthority, journeyOwnerId]);

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

  const artifacts = useMemo(() => {
    void artifactTick;
    return listAllJourneyArtifactsForOwner(journeyOwnerId);
  }, [artifactTick, journeyOwnerId]);

  const conversations = useMemo(() => {
    const base = mapArchivesToSainaConversations(archives, resolvedActiveId);
    return enrichConversationItemsWithYansiPresentation(
      base,
      artifacts,
      publication.bySlug,
      publication.ready
    );
  }, [archives, resolvedActiveId, artifacts, publication]);

  const conversationGroups = useMemo(() => {
    const groups =
      isAuthReady && isAuthenticated && userId
        ? authorityGroups
        : listConversationGroups();
    const tree = buildConversationTree(archives, groups, resolvedActiveId);
    return tree.map((group) => {
      const asSidebar: SainaConversationItem[] = group.conversations
        .filter((row) => (row.kind ?? 'conversation') !== 'yansi')
        .map((row) => ({
          id: row.id,
          kind: 'conversation' as const,
          title: row.title,
          preview: row.preview,
          time: row.time,
          savedAt: row.savedAt,
          thumbGradient: row.thumbGradient,
          thumbImageUrl: row.thumbImageUrl,
          isMirrorSource: row.isMirrorSource,
        }));
      const enriched = enrichConversationItemsWithYansiPresentation(
        asSidebar,
        artifacts,
        publication.bySlug,
        publication.ready
      );
      return {
        ...group,
        conversations: enriched.map(toTreeChatItem),
      };
    });
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
    artifacts,
    publication,
  ]);

  return { conversations, conversationGroups, activeChatId: resolvedActiveId };
}
