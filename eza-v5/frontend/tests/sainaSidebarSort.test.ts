import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import {
  mapArchivesToSainaConversations,
  sortArchivesForSidebar,
} from '@/lib/eza/sainaConversationList';
import {
  DELETED_CHAT_IDS_STORAGE_KEY,
  markChatDeleted,
} from '@/lib/standaloneChatDelete';
import type { ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import {
  deleteChatArchive,
  listChatArchives,
  resolveChatRouteAfterDelete,
  upsertChatArchive,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';

function archive(
  id: string,
  savedAt: string,
  overrides: Partial<ArchivedChatSummary> = {}
): ArchivedChatSummary {
  return {
    id,
    title: id,
    preview: 'preview',
    savedAt,
    messageCount: 1,
    ...overrides,
  };
}

const T1 = '2026-05-01T12:00:00.000Z';
const T2 = '2026-05-02T12:00:00.000Z';
const T3 = '2026-05-03T12:00:00.000Z';

describe('saina sidebar sort', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('puts the second-ranked chat first when it becomes active', () => {
    const archives = [archive('chat-a', T3), archive('chat-b', T2), archive('chat-c', T1)];
    const sorted = sortArchivesForSidebar(archives, 'chat-b');
    expect(sorted.map((c) => c.id)).toEqual(['chat-b', 'chat-a', 'chat-c']);
  });

  it('puts the third-ranked chat first when it becomes active', () => {
    const archives = [archive('chat-a', T3), archive('chat-b', T2), archive('chat-c', T1)];
    const sorted = sortArchivesForSidebar(archives, 'chat-c');
    expect(sorted.map((c) => c.id)).toEqual(['chat-c', 'chat-a', 'chat-b']);
  });

  it('falls back to savedAt order when there is no active chat', () => {
    const archives = [archive('chat-a', T3), archive('chat-b', T2), archive('chat-c', T1)];
    expect(sortArchivesForSidebar(archives, null).map((c) => c.id)).toEqual([
      'chat-a',
      'chat-b',
      'chat-c',
    ]);
  });

  it('bumps a chat with a newer savedAt to the top when it is not active', () => {
    const archives = [
      archive('chat-a', T1),
      archive('chat-b', T2),
      archive('chat-c', T3),
    ];
    expect(sortArchivesForSidebar(archives, 'chat-a').map((c) => c.id)).toEqual([
      'chat-a',
      'chat-c',
      'chat-b',
    ]);
  });

  it('hides tombstoned chats from the sidebar list', () => {
    markChatDeleted('chat-b');
    const archives = [archive('chat-a', T3), archive('chat-b', T2), archive('chat-c', T1)];
    expect(sortArchivesForSidebar(archives, 'chat-c').map((c) => c.id)).toEqual([
      'chat-c',
      'chat-a',
    ]);
    expect(localStorage.getItem(DELETED_CHAT_IDS_STORAGE_KEY)).toBeTruthy();
  });

  it('mapArchivesToSainaConversations uses the same active-first ordering as pattern page', () => {
    const archives = [archive('chat-a', T3), archive('chat-b', T2), archive('chat-c', T1)];
    const rows = mapArchivesToSainaConversations(archives, 'chat-b');
    expect(rows.map((r) => r.id)).toEqual(['chat-b', 'chat-a', 'chat-c']);
  });

  it('buildConversationTree promotes the active chat within its group', () => {
    const archives = [
      { ...archive('chat-a', T3), groupId: 'g1' },
      { ...archive('chat-b', T2), groupId: 'g1' },
      { ...archive('chat-c', T1), groupId: 'g1' },
    ];
    const tree = buildConversationTree(
      archives,
      [{ id: 'g1', title: 'Grup', updatedAt: T3, sortOrder: 0 }],
      'chat-c'
    );
    expect(tree[0]?.conversations.map((c) => c.id)).toEqual(['chat-c', 'chat-a', 'chat-b']);
  });

  it('does not change archive savedAt when only sorting for display', () => {
    const archives = [archive('chat-a', T3), archive('chat-b', T2)];
    const before = archives.map((a) => ({ id: a.id, savedAt: a.savedAt }));
    sortArchivesForSidebar(archives, 'chat-b');
    expect(archives.map((a) => ({ id: a.id, savedAt: a.savedAt }))).toEqual(before);
  });

  it('after deleting the active chat, the routed next chat sorts to the top', () => {
    upsertChatArchive({
      id: 'chat-a',
      title: 'A',
      preview: 'a',
      savedAt: T3,
      messageCount: 1,
      messages: [{ id: 'm1', text: 'a', isUser: true }],
    });
    upsertChatArchive({
      id: 'chat-b',
      title: 'B',
      preview: 'b',
      savedAt: T2,
      messageCount: 1,
      messages: [{ id: 'm2', text: 'b', isUser: true }],
    });
    writeActiveChatId('chat-a');
    deleteChatArchive('chat-a');

    const route = resolveChatRouteAfterDelete();
    const nextId = new URL(route, 'http://localhost').searchParams.get('chat');
    const sorted = sortArchivesForSidebar(listChatArchives(), nextId);
    expect(sorted[0]?.id).toBe('chat-b');
  });
});
