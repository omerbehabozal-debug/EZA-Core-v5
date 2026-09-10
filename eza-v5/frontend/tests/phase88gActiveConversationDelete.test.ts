/**
 * Active conversation delete — leave to canonical new-chat; block deleted hydrate races.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isConversationActiveForDelete } from '@/lib/eza/activeConversationDelete';
import {
  DELETED_CHAT_IDS_STORAGE_KEY,
  isChatDeleted,
  markChatDeleted,
} from '@/lib/standaloneChatDelete';
import {
  deleteChatArchive,
  getChatArchive,
  readActiveChatId,
  upsertChatArchive,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';
import { SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';

const chatSrc = () =>
  readFileSync(
    join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
    'utf8'
  );

describe('Active conversation delete leave path', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('B: active when React chatId, URL, or readActiveChatId matches', () => {
    expect(
      isConversationActiveForDelete({
        targetId: 'chat-a',
        chatId: 'chat-a',
        chatIdFromUrl: null,
        activeChatId: null,
      })
    ).toBe(true);

    expect(
      isConversationActiveForDelete({
        targetId: 'chat-a',
        chatId: null,
        chatIdFromUrl: 'chat-a',
        activeChatId: null,
      })
    ).toBe(true);

    expect(
      isConversationActiveForDelete({
        targetId: 'chat-a',
        chatId: 'other',
        chatIdFromUrl: 'other',
        activeChatId: 'chat-a',
      })
    ).toBe(true);

    expect(
      isConversationActiveForDelete({
        targetId: 'chat-a',
        chatId: 'other',
        chatIdFromUrl: 'other',
        activeChatId: 'other',
      })
    ).toBe(false);
  });

  it('A/D: deleted/tombstoned chat is not hydratable from archive or active id', () => {
    upsertChatArchive({
      id: 'chat-del',
      title: 'Silinecek',
      preview: 'x',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'hello', isUser: true }],
    });
    writeActiveChatId('chat-del');
    expect(readActiveChatId()).toBe('chat-del');

    deleteChatArchive('chat-del');
    expect(isChatDeleted('chat-del')).toBe(true);
    expect(getChatArchive('chat-del')).toBeNull();
    expect(readActiveChatId()).toBeNull();
  });

  it('E: URL sync / load must refuse tombstoned ids (source)', () => {
    const src = chatSrc();
    expect(src).toContain('isChatDeleted(id)');
    expect(src).toContain('isChatDeleted(chatIdFromUrl)');
    // Early guard before generation bump in loadChatIntoState
    const loadIdx = src.indexOf('const loadChatIntoState = useCallback');
    const guardIdx = src.indexOf('if (isChatDeleted(id))', loadIdx);
    const genIdx = src.indexOf('chatLoadGenerationRef.current += 1', loadIdx);
    // First isChatDeleted in load is the early return; generation bump for load uses ++
    const loadGenIdx = src.indexOf('++chatLoadGenerationRef.current', loadIdx);
    expect(guardIdx).toBeGreaterThan(loadIdx);
    expect(loadGenIdx).toBeGreaterThan(guardIdx);
    expect(genIdx).toBeGreaterThan(-1);
  });

  it('C: active delete bumps load generation before leave (source)', () => {
    const src = chatSrc();
    const execIdx = src.indexOf('const executeDeleteChat = useCallback');
    const bumpIdx = src.indexOf('chatLoadGenerationRef.current += 1', execIdx);
    const leaveIdx = src.indexOf('leaveActiveConversationAfterDelete()', execIdx);
    expect(bumpIdx).toBeGreaterThan(execIdx);
    expect(leaveIdx).toBeGreaterThan(bumpIdx);
  });

  it('A: active delete routes to SAINA_NEW_CHAT_ROUTE via replace (source)', () => {
    const src = chatSrc();
    expect(src).toContain('isConversationActiveForDelete');
    expect(src).toContain('leaveActiveConversationAfterDelete');
    expect(src).toContain('SAINA_NEW_CHAT_ROUTE');
    const execIdx = src.indexOf('const executeDeleteChat = useCallback');
    const replaceIdx = src.indexOf('router.replace(SAINA_NEW_CHAT_ROUTE', execIdx);
    expect(replaceIdx).toBeGreaterThan(execIdx);
    // Must not use resolveChatRouteAfterDelete for active leave
    const execEnd = src.indexOf('const { requestDelete, deleteModal }', execIdx);
    const execBlock = src.slice(execIdx, execEnd);
    expect(execBlock).not.toContain('resolveChatRouteAfterDelete');
    expect(execBlock).not.toContain('router.push(');
  });

  it('F: non-active delete leaves wasActive false (unit)', () => {
    expect(
      isConversationActiveForDelete({
        targetId: 'chat-b',
        chatId: 'chat-a',
        chatIdFromUrl: 'chat-a',
        activeChatId: 'chat-a',
      })
    ).toBe(false);
  });

  it('G: durable tombstone key retained for hard-refresh filter', () => {
    markChatDeleted('chat-gone');
    const raw = localStorage.getItem(DELETED_CHAT_IDS_STORAGE_KEY);
    expect(raw).toContain('chat-gone');
    expect(isChatDeleted('chat-gone')).toBe(true);
  });

  it('source: leave clears mirror/journey and opens new-chat composer path', () => {
    const src = chatSrc();
    const leaveIdx = src.indexOf('const leaveActiveConversationAfterDelete');
    const leaveEnd = src.indexOf('}, [cancelPendingAutosave, resetStream, setConversationMirrorEntries]);', leaveIdx);
    const block = src.slice(leaveIdx, leaveEnd);
    expect(block).toContain('setChatId(null)');
    expect(block).toContain('setMessages([])');
    expect(block).toContain('PENDING_CONVERSATION_MIRROR_ID');
    expect(block).toContain('setJourneyState(null)');
    expect(block).toContain('setGroupPickerOpen(true)');
    expect(SAINA_NEW_CHAT_ROUTE).toContain('new=');
  });
});
