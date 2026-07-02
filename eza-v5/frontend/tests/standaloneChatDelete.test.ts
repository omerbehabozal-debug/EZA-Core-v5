import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isBranchSuggestionDismissed,
  markBranchSuggestionDismissed,
} from '@/lib/eza/conversation-tree/branchSuggestionSession';
import { isMirrorBirthDismissed, markMirrorBirthDismissed } from '@/lib/eza/mirror-birth/mirrorBirthSession';
import { readMirrorShareLink, saveMirrorShareLink } from '@/lib/eza/mirror-share/mirrorShareLinkCache';
import {
  DELETED_CHAT_IDS_STORAGE_KEY,
  DELETED_CHAT_TOMBSTONE_TTL_MS,
  isChatDeleted,
  markChatDeleted,
  pruneExpiredDeletedChatTombstones,
} from '@/lib/standaloneChatDelete';
import {
  createStandaloneChat,
  deleteChatArchive,
  getChatArchive,
  listChatArchives,
  readActiveChatId,
  resolveChatRouteAfterDelete,
  saveStandaloneChat,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

function seedTwoChats() {
  upsertChatArchive({
    id: 'chat-older',
    title: 'Eski',
    preview: 'a',
    savedAt: new Date(Date.now() - 1000).toISOString(),
    messageCount: 1,
    messages: [{ id: 'm1', text: 'a', isUser: true }],
  });
  upsertChatArchive({
    id: 'chat-newer',
    title: 'Yeni',
    preview: 'b',
    savedAt: new Date().toISOString(),
    messageCount: 1,
    messages: [{ id: 'm2', text: 'b', isUser: true }],
  });
}

/** Mirrors SainaPatternPageInner executeDeleteChat after modal confirm. */
function patternDeleteChat(id: string): { deleted: boolean; wasActive: boolean; route: string | null } {
  const archive = getChatArchive(id);
  if (!archive) return { deleted: false, wasActive: false, route: null };

  const wasActive = readActiveChatId() === id;
  deleteChatArchive(id);
  return {
    deleted: true,
    wasActive,
    route: wasActive ? resolveChatRouteAfterDelete() : null,
  };
}

/** Mirrors StandaloneChatInner executeDeleteChat after modal confirm. */
function standaloneDeleteChat(
  activeChatId: string | null,
  targetId: string
): { deleted: boolean; wasActive: boolean } {
  const archive = getChatArchive(targetId);
  if (!archive) return { deleted: false, wasActive: false };

  const wasActive = activeChatId === targetId;
  deleteChatArchive(targetId);
  return { deleted: true, wasActive };
}

describe('standalone chat delete hardening', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('blocks saveStandaloneChat for deleted chat ids', () => {
    const id = createStandaloneChat({ title: 'Silinecek' });
    saveStandaloneChat(id, [{ id: 'm1', text: 'merhaba', isUser: true }]);
    deleteChatArchive(id);

    const saved = saveStandaloneChat(id, [{ id: 'm2', text: 'geri gelme', isUser: true }]);
    expect(saved).toBeNull();
    expect(getChatArchive(id)).toBeNull();
    expect(isChatDeleted(id)).toBe(true);
  });

  it('blocks upsertChatArchive for deleted chat ids', () => {
    const id = createStandaloneChat({ title: 'Upsert test' });
    deleteChatArchive(id);

    upsertChatArchive({
      id,
      title: 'Geri',
      preview: 'x',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'x', isUser: true }],
    });

    expect(getChatArchive(id)).toBeNull();
  });

  it('stores tombstone in localStorage for multi-tab guard', () => {
    markChatDeleted('chat-tab-1');
    const raw = localStorage.getItem(DELETED_CHAT_IDS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(isChatDeleted('chat-tab-1')).toBe(true);

    saveStandaloneChat('chat-tab-1', [{ id: 'm1', text: 'cross-tab', isUser: true }]);
    expect(getChatArchive('chat-tab-1')).toBeNull();
  });

  it('prunes expired tombstones after TTL', () => {
    const expiredAt = Date.now() - DELETED_CHAT_TOMBSTONE_TTL_MS - 1;
    localStorage.setItem(
      DELETED_CHAT_IDS_STORAGE_KEY,
      JSON.stringify([{ id: 'chat-expired', deletedAt: expiredAt }])
    );

    pruneExpiredDeletedChatTombstones();
    expect(isChatDeleted('chat-expired')).toBe(false);
    expect(localStorage.getItem(DELETED_CHAT_IDS_STORAGE_KEY)).toBe('[]');
  });

  it('delete preserves chat when archive is missing', () => {
    seedTwoChats();
    const result = standaloneDeleteChat('chat-newer', 'chat-missing');
    expect(result.deleted).toBe(false);
    expect(listChatArchives()).toHaveLength(2);
  });

  it('confirmed delete removes archive and blocks resurrection', () => {
    seedTwoChats();

    const result = standaloneDeleteChat('chat-newer', 'chat-newer');
    expect(result.deleted).toBe(true);
    expect(getChatArchive('chat-newer')).toBeNull();
    expect(saveStandaloneChat('chat-newer', [{ id: 'm1', text: 'nope', isUser: true }])).toBeNull();
  });

  it('pattern active delete redirects using wasActive captured before delete', () => {
    seedTwoChats();
    expect(readActiveChatId()).toBe('chat-newer');

    const result = patternDeleteChat('chat-newer');
    expect(result.deleted).toBe(true);
    expect(result.wasActive).toBe(true);
    expect(result.route).toBe('/standalone?chat=chat-older');
    expect(readActiveChatId()).toBeNull();
  });

  it('pattern non-active delete does not redirect', () => {
    seedTwoChats();
    const result = patternDeleteChat('chat-older');
    expect(result.deleted).toBe(true);
    expect(result.wasActive).toBe(false);
    expect(result.route).toBeNull();
    expect(getChatArchive('chat-newer')).not.toBeNull();
  });

  it('deletes active chat and routes to next newest chat', () => {
    seedTwoChats();
    deleteChatArchive('chat-newer');

    expect(listChatArchives().map((c) => c.id)).toEqual(['chat-older']);
    expect(resolveChatRouteAfterDelete()).toBe('/standalone?chat=chat-older');
  });

  it('routes to empty standalone when last chat is deleted', () => {
    const only = createStandaloneChat({ title: 'Son' });
    deleteChatArchive(only);
    expect(listChatArchives()).toHaveLength(0);
    expect(resolveChatRouteAfterDelete()).toBe('/standalone');
  });

  it('pending autosave cannot resurrect deleted chat', () => {
    vi.useFakeTimers();
    const id = createStandaloneChat({ title: 'Autosave' });
    deleteChatArchive(id);

    saveStandaloneChat(id, [{ id: 'm1', text: 'late save', isUser: true }]);
    vi.runAllTimers();
    expect(getChatArchive(id)).toBeNull();
    vi.useRealTimers();
  });

  it('deleteChatArchive removes archive and clears active chat id', () => {
    const id = createStandaloneChat({ title: 'Aktif' });
    expect(readActiveChatId()).toBe(id);

    deleteChatArchive(id);
    expect(getChatArchive(id)).toBeNull();
    expect(readActiveChatId()).toBeNull();
  });

  it('purges per-conversation local caches without touching other chats', () => {
    const id = 'chat-purge-1';
    const other = 'chat-purge-2';
    markMirrorBirthDismissed(id);
    markBranchSuggestionDismissed(id);
    saveMirrorShareLink(id, 'published-slug', 'https://saina.app/m/published-slug');

    deleteChatArchive(id);

    expect(isMirrorBirthDismissed(id)).toBe(false);
    expect(isBranchSuggestionDismissed(id)).toBe(false);
    expect(readMirrorShareLink(id)).toBeNull();

    markMirrorBirthDismissed(other);
    deleteChatArchive(other);
    expect(isMirrorBirthDismissed(other)).toBe(false);
  });

  it('does not delete unrelated chats when deleting one id', () => {
    upsertChatArchive({
      id: 'chat-keep',
      title: 'Kalacak',
      preview: 'a',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'a', isUser: true }],
    });
    upsertChatArchive({
      id: 'chat-remove',
      title: 'Gidecek',
      preview: 'b',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm2', text: 'b', isUser: true }],
    });
    deleteChatArchive('chat-remove');

    expect(getChatArchive('chat-keep')?.title).toBe('Kalacak');
    expect(getChatArchive('chat-remove')).toBeNull();
  });
});
