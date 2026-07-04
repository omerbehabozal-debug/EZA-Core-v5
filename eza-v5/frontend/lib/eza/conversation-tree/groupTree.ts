import {
  listConversationGroups,
} from '@/lib/eza/conversation-tree/conversationGroups';
import type {
  ConversationTreeGroupNode,
  ConversationTreeChatItem,
  ConversationGroup,
} from '@/lib/eza/conversation-tree/types';
import { UNGROUPED_CONVERSATION_GROUP_ID } from '@/lib/eza/conversation-tree/types';
import {
  formatSainaConversationTime,
  thumbGradientForChatId,
} from '@/lib/eza/sainaConversationList';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import { isChatDeleted } from '@/lib/standaloneChatDelete';
import { summarizeArchiveTitle, type ArchivedChatSummary } from '@/lib/standaloneChatArchive';

export type ArchivedChatSummaryWithTree = ArchivedChatSummary & {
  groupId?: string | null;
  isMirrorSource?: boolean;
};

function toTreeChatItem(item: ArchivedChatSummaryWithTree): ConversationTreeChatItem {
  return {
    id: item.id,
    title: summarizeArchiveTitle(item.title) || 'Yeni sohbet',
    preview: item.preview?.trim() || 'SAINA ile düşün, keşfet…',
    time: formatSainaConversationTime(item.savedAt),
    thumbGradient: thumbGradientForChatId(item.id),
    thumbImageUrl:
      item.conversationSceneUrl &&
      isPersistableConversationSceneUrl(item.conversationSceneUrl)
        ? item.conversationSceneUrl
        : null,
    savedAt: item.savedAt,
    isMirrorSource: Boolean(item.isMirrorSource),
  };
}

function sortChats(
  items: ConversationTreeChatItem[],
  activeChatId?: string | null
): ConversationTreeChatItem[] {
  const activeId = (activeChatId || '').trim() || null;
  return [...items].sort((a, b) => {
    if (activeId) {
      if (a.id === activeId && b.id !== activeId) return -1;
      if (b.id === activeId && a.id !== activeId) return 1;
    }
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
  });
}

export function buildConversationTree(
  archives: ArchivedChatSummaryWithTree[],
  groups: ConversationGroup[] = listConversationGroups(),
  activeChatId?: string | null
): ConversationTreeGroupNode[] {
  const visibleArchives = archives.filter((item) => !isChatDeleted(item.id));
  const byGroup = new Map<string, ConversationTreeChatItem[]>();
  const ungrouped: ConversationTreeChatItem[] = [];

  for (const item of visibleArchives) {
    const chat = toTreeChatItem(item);
    const groupId = item.groupId?.trim();
    if (!groupId) {
      ungrouped.push(chat);
      continue;
    }
    const bucket = byGroup.get(groupId) ?? [];
    bucket.push(chat);
    byGroup.set(groupId, bucket);
  }

  const nodes: ConversationTreeGroupNode[] = groups
    .filter((g) => byGroup.has(g.id))
    .map((g) => ({
      id: g.id,
      title: g.title,
      updatedAt: g.updatedAt,
      sortOrder: g.sortOrder ?? 0,
      conversations: sortChats(byGroup.get(g.id) ?? [], activeChatId),
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  if (ungrouped.length > 0) {
    const latest = ungrouped.reduce((max, c) =>
      new Date(c.savedAt).getTime() > new Date(max.savedAt).getTime() ? c : max
    );
    nodes.push({
      id: UNGROUPED_CONVERSATION_GROUP_ID,
      title: 'Diğer',
      updatedAt: latest.savedAt,
      sortOrder: -1,
      conversations: sortChats(ungrouped, activeChatId),
    });
  }

  return nodes;
}

export function flattenConversationTree(nodes: ConversationTreeGroupNode[]): ConversationTreeChatItem[] {
  return nodes.flatMap((n) => n.conversations);
}
