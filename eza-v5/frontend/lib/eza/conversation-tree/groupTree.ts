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
    savedAt: item.savedAt,
    isMirrorSource: Boolean(item.isMirrorSource),
  };
}

function sortChats(items: ConversationTreeChatItem[]): ConversationTreeChatItem[] {
  return [...items].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

export function buildConversationTree(
  archives: ArchivedChatSummaryWithTree[],
  groups: ConversationGroup[] = listConversationGroups()
): ConversationTreeGroupNode[] {
  const byGroup = new Map<string, ConversationTreeChatItem[]>();
  const ungrouped: ConversationTreeChatItem[] = [];

  for (const item of archives) {
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
      conversations: sortChats(byGroup.get(g.id) ?? []),
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
      conversations: sortChats(ungrouped),
    });
  }

  return nodes;
}

export function flattenConversationTree(nodes: ConversationTreeGroupNode[]): ConversationTreeChatItem[] {
  return nodes.flatMap((n) => n.conversations);
}
