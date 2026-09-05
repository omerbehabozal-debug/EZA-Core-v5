import { describe, expect, it } from 'vitest';
import {
  buildConversationTree,
  hasRealConversationTreeGroups,
  shouldUseConversationTreeMode,
} from '@/lib/eza/conversation-tree/groupTree';
import { UNGROUPED_CONVERSATION_GROUP_ID } from '@/lib/eza/conversation-tree/types';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import {
  getConversationTimeBucketLabel,
  groupConversationsByTimeBucket,
  mapArchivesToSainaConversations,
} from '@/lib/eza/sainaConversationList';
import type { ArchivedChatSummary } from '@/lib/standaloneChatArchive';

function archive(
  id: string,
  opts?: { savedAt?: string; groupId?: string | null; lastMessageAt?: string }
): ArchivedChatSummary {
  const savedAt =
    opts?.savedAt ||
    opts?.lastMessageAt ||
    '2026-06-07T00:58:39.199000+00:00';
  return {
    id,
    title: id,
    preview: 'p',
    savedAt,
    messageCount: 1,
    groupId: opts?.groupId ?? null,
  };
}

function namedGroup(id: string, title: string): ConversationGroup {
  return {
    id,
    userId: 'user-a',
    title,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
  };
}

describe('Phase 8.8G-5 / 1.2 cross-device sidebar grouping mode', () => {
  it('1/5. fresh browser: null groupId + no named groups → date mode, not sole Diğer tree', () => {
    const archives = [
      archive('c1', { lastMessageAt: '2026-08-06T17:09:33.327000+00:00' }),
      archive('c2', { lastMessageAt: '2026-07-25T23:08:06.682000+00:00' }),
      archive('c3', { lastMessageAt: '2026-06-07T00:58:39.199000+00:00' }),
    ];
    const tree = buildConversationTree(archives, [], null);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe(UNGROUPED_CONVERSATION_GROUP_ID);
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
    expect(hasRealConversationTreeGroups(tree)).toBe(false);

    const items = mapArchivesToSainaConversations(archives);
    const buckets = groupConversationsByTimeBucket(items);
    expect(buckets.some((b) => b.label === 'Diğer')).toBe(false);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => ['Bugün', 'Dün', 'Bu hafta', 'Geçen hafta', 'Daha eski', 'Sohbetler'].includes(b.label))).toBe(
      true
    );
  });

  it('2. savedAt from server lastMessageAt remains usable by date grouping', () => {
    const lastMessageAt = '2026-08-06T17:09:33.327000+00:00';
    // Same mapping as serverConversationStore.mapListItemToSummary
    const savedAt = lastMessageAt || 'fallback';
    expect(getConversationTimeBucketLabel(savedAt, new Date('2026-09-05T12:00:00.000Z'))).toBe(
      'Daha eski'
    );
    const items = mapArchivesToSainaConversations([
      archive('srv', { savedAt }),
    ]);
    const buckets = groupConversationsByTimeBucket(items);
    expect(buckets[0]?.label).toBe('Daha eski');
    expect(buckets[0]?.items[0]?.id).toBe('srv');
  });

  it('3. at least one real named group → tree mode remains active', () => {
    const groups = [namedGroup('g-travel', 'Seyahat')];
    const archives = [
      archive('in-group', { groupId: 'g-travel', savedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    const tree = buildConversationTree(archives, groups, null);
    expect(tree.some((n) => n.id === 'g-travel')).toBe(true);
    expect(shouldUseConversationTreeMode(tree)).toBe(true);
  });

  it('4. named group + ungrouped → tree mode; Diğer remains inside tree', () => {
    const groups = [namedGroup('g-work', 'İş')];
    const archives = [
      archive('named', { groupId: 'g-work', savedAt: '2026-08-01T00:00:00.000Z' }),
      archive('loose', { groupId: null, savedAt: '2026-07-01T00:00:00.000Z' }),
    ];
    const tree = buildConversationTree(archives, groups, null);
    expect(shouldUseConversationTreeMode(tree)).toBe(true);
    expect(tree.some((n) => n.id === 'g-work')).toBe(true);
    expect(tree.some((n) => n.id === UNGROUPED_CONVERSATION_GROUP_ID)).toBe(true);
    const other = tree.find((n) => n.id === UNGROUPED_CONVERSATION_GROUP_ID);
    expect(other?.conversations.map((c) => c.id)).toEqual(['loose']);
  });

  it('5. synthetic ungrouped node alone must NOT activate tree mode', () => {
    const tree = buildConversationTree(
      [archive('a'), archive('b')],
      [],
      null
    );
    expect(tree.every((n) => n.id === UNGROUPED_CONVERSATION_GROUP_ID)).toBe(true);
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
    expect(shouldUseConversationTreeMode(null)).toBe(false);
    expect(shouldUseConversationTreeMode([])).toBe(false);
  });
});
