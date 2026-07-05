'use client';

import { useMemo } from 'react';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { listConversationGroups } from '@/lib/eza/conversation-tree/conversationGroups';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { readActiveChatId, type ArchivedChatSummary } from '@/lib/standaloneChatArchive';

/** Shared sidebar list shape — same tree on chat, discover, and pattern routes. */
export function useSainaSidebarConversations(
  archives: ArchivedChatSummary[],
  activeChatId?: string | null
) {
  const resolvedActiveId = (activeChatId ?? readActiveChatId()) || null;

  const conversations = useMemo(
    () => mapArchivesToSainaConversations(archives, resolvedActiveId),
    [archives, resolvedActiveId]
  );

  const conversationGroups = useMemo(
    () => buildConversationTree(archives, listConversationGroups(), resolvedActiveId),
    [archives, resolvedActiveId]
  );

  return { conversations, conversationGroups, activeChatId: resolvedActiveId };
}
