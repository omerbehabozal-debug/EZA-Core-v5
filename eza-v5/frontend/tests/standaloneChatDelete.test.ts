import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isBranchSuggestionDismissed,
  markBranchSuggestionDismissed,
} from '@/lib/eza/conversation-tree/branchSuggestionSession';
import { isMirrorBirthDismissed, markMirrorBirthDismissed } from '@/lib/eza/mirror-birth/mirrorBirthSession';
import { saveMirrorShareLink, readMirrorShareLink } from '@/lib/eza/mirror-share/mirrorShareLinkCache';
import { isChatDeleted } from '@/lib/standaloneChatDelete';
import {
  confirmDeleteChatArchive,
  createStandaloneChat,
  deleteChatArchive,
  getChatArchive,
  listChatArchives,
  readActiveChatId,
  resolveChatRouteAfterDelete,
  saveStandaloneChat,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

describe('standalone chat delete hotfix', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('deletes active chat and routes to next newest chat', () => {
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

  it('confirmDeleteChatArchive removes archive and clears active chat id', () => {
    const id = createStandaloneChat({ title: 'Aktif' });
    expect(readActiveChatId()).toBe(id);

    const ok = confirmDeleteChatArchive(id, 'Aktif');
    expect(ok).toBe(true);
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

  it('pattern-style active delete redirects to remaining chat', () => {
    upsertChatArchive({
      id: 'chat-active',
      title: 'Aktif pattern',
      preview: 'a',
      savedAt: new Date(Date.now() - 1000).toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'a', isUser: true }],
    });
    upsertChatArchive({
      id: 'chat-other',
      title: 'Diğer',
      preview: 'b',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm2', text: 'b', isUser: true }],
    });
    expect(readActiveChatId()).toBe('chat-other');

    deleteChatArchive('chat-other');
    expect(resolveChatRouteAfterDelete()).toBe('/standalone?chat=chat-active');
    expect(getChatArchive('chat-active')).not.toBeNull();
  });
});
