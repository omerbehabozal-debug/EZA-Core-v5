import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
  migrateLegacyServerConversations: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', () => apiMocks);

import {
  bootstrapServerConversations,
  clearServerConversationState,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  classifyLegacyMigrationCandidates,
  collectLegacyMigrationCandidates,
  getLegacyMigrationMarker,
  isEmptyLegacyTranscript,
  isLegacyMigrationComplete,
  resetLegacyMigrationMarkersForTests,
  runLegacyConversationMigration,
} from '@/lib/eza/legacyConversationMigration';
import {
  readChatArchivesForScope,
  replaceChatArchivesForScope,
} from '@/lib/standaloneChatArchive';
import { userScope } from '@/lib/eza/localIdentityScope';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function seedUserChat(
  userId: string,
  chat: {
    id: string;
    title?: string;
    messages: Array<{ id?: string; text: string; isUser: boolean }>;
    serverConversationId?: string;
  }
) {
  replaceChatArchivesForScope(userScope(userId), [
    {
      id: chat.id,
      title: chat.title || 'Legacy',
      preview: chat.messages[0]?.text || '',
      savedAt: '2026-01-01T00:00:00.000Z',
      messageCount: chat.messages.length,
      messages: chat.messages.map((m, i) => ({
        id: m.id ?? `m-${i}`,
        text: m.text,
        isUser: m.isUser,
        timestamp: '2026-01-01T00:00:00.000Z',
      })),
      serverConversationId: chat.serverConversationId,
    },
  ]);
}

beforeEach(() => {
  resetServerConversationStoreForTests();
  resetLegacyMigrationMarkersForTests();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Phase 8.8G-3.1 migration integrity', () => {
  it('zero messages → empty_transcript terminal; source retained; completedAt', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    seedUserChat(userA, { id: 'chat-zero', messages: [] });

    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);

    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
    expect(result.results[0]?.status).toBe('empty_transcript');
    expect(isLegacyMigrationComplete(userA)).toBe(true);
    const local = readChatArchivesForScope(userScope(userA));
    expect(local[0]?.id).toBe('chat-zero');
    expect(local[0]?.serverConversationId).toBeUndefined();
  });

  it('all whitespace → empty_transcript; no endless retry', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    seedUserChat(userA, {
      id: 'chat-ws',
      messages: [
        { text: '', isUser: true },
        { text: '   ', isUser: false },
        { text: '\n\t', isUser: true },
      ],
    });
    expect(isEmptyLegacyTranscript(readChatArchivesForScope(userScope(userA))[0]!)).toBe(
      true
    );

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
    expect(getLegacyMigrationMarker(userA)?.conversations['chat-ws']?.status).toBe(
      'empty_transcript'
    );
    expect(isLegacyMigrationComplete(userA)).toBe(true);

    // Second run does not re-send
    await runLegacyConversationMigration(userA);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
  });

  it('all payloads filtered still reaches completedAt', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    replaceChatArchivesForScope(userScope(userA), [
      {
        id: 'a',
        title: 'A',
        preview: '',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 0,
        messages: [],
      },
      {
        id: 'b',
        title: 'B',
        preview: '',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 1,
        messages: [{ id: '1', text: '  ', isUser: true }],
      },
    ]);

    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);
    expect(result.results.every((r) => r.status === 'empty_transcript')).toBe(true);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
    expect(isLegacyMigrationComplete(userA)).toBe(true);
  });

  it('mixed empty_transcript + migratable → both terminal + completedAt', async () => {
    apiMocks.listServerConversations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'srv-b',
          clientConversationId: 'chat-valid',
          title: 'Valid',
          preview: 'hi',
          conversationType: 'direct',
          messageCount: 1,
          createdAt: '2026-01-01T00:00:00Z',
          archived: false,
          pinned: false,
          titlePinned: false,
        },
      ]);
    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'chat-valid',
          status: 'migrated',
          serverConversationId: 'srv-b',
          messageCount: 1,
        },
      ],
    });

    replaceChatArchivesForScope(userScope(userA), [
      {
        id: 'chat-empty',
        title: 'Empty',
        preview: '',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 0,
        messages: [],
      },
      {
        id: 'chat-valid',
        title: 'Valid',
        preview: 'hi',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 1,
        messages: [{ id: 'u1', text: 'hi', isUser: true }],
      },
    ]);

    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);
    const byId = Object.fromEntries(result.results.map((r) => [r.clientConversationId, r]));
    expect(byId['chat-empty']?.status).toBe('empty_transcript');
    expect(byId['chat-valid']?.status).toBe('migrated');
    expect(isLegacyMigrationComplete(userA)).toBe(true);
    expect(
      readChatArchivesForScope(userScope(userA)).find((c) => c.id === 'chat-empty')
        ?.serverConversationId
    ).toBeUndefined();
  });

  it('retryable still blocks completion when empty sibling is terminal', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    apiMocks.migrateLegacyServerConversations.mockRejectedValue(new Error('network'));

    replaceChatArchivesForScope(userScope(userA), [
      {
        id: 'chat-empty',
        title: 'Empty',
        preview: '',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 0,
        messages: [],
      },
      {
        id: 'chat-fail',
        title: 'Fail',
        preview: 'x',
        savedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 1,
        messages: [{ id: 'u1', text: 'x', isUser: true }],
      },
    ]);

    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);
    expect(result.results.find((r) => r.clientConversationId === 'chat-empty')?.status).toBe(
      'empty_transcript'
    );
    expect(result.results.find((r) => r.clientConversationId === 'chat-fail')?.status).toBe(
      'failed_retryable'
    );
    expect(isLegacyMigrationComplete(userA)).toBe(false);
  });

  it('rejected/empty local source retained; no fake serverConversationId', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    seedUserChat(userA, {
      id: 'chat-ws-keep',
      messages: [{ text: '   ', isUser: true }],
    });
    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    const local = readChatArchivesForScope(userScope(userA))[0]!;
    expect(local.messages[0]?.text).toBe('   ');
    expect(local.serverConversationId).toBeUndefined();
  });

  it('owner guard: late A empty classification does not mutate B marker', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    seedUserChat(userA, { id: 'chat-a-empty', messages: [] });
    await bootstrapServerConversations(userA);

    // Simulate mid-flight: clear A, switch to B before marker write path completes
    // by running classification then switching authority.
    const candidates = collectLegacyMigrationCandidates(userA);
    const classified = classifyLegacyMigrationCandidates(candidates);
    expect(classified.localTerminal[0]?.status).toBe('empty_transcript');

    clearServerConversationState();
    await bootstrapServerConversations(userB);

    // Late A-style marker update must not apply under B ownership — run A migration now fails authority
    const late = await runLegacyConversationMigration(userA);
    expect(late.ran).toBe(false);
    expect(getLegacyMigrationMarker(userB)).toBeNull();
  });

  it('mixed empty+valid preserves original ordinals in payload', () => {
    const chat = {
      id: 'chat-ord',
      title: 'O',
      preview: 'Hello',
      savedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 3,
      messages: [
        { id: 'u0', text: 'Hello', isUser: true },
        { id: 'e1', text: '  ', isUser: false },
        { id: 'u2', text: 'Question', isUser: true },
      ],
    };
    replaceChatArchivesForScope(userScope(userA), [chat]);
    const { payloads } = classifyLegacyMigrationCandidates(
      collectLegacyMigrationCandidates(userA)
    );
    expect(payloads[0]?.messages.map((m) => m.ordinal)).toEqual([0, 2]);
    expect(payloads[0]?.messages.map((m) => m.content)).toEqual(['Hello', 'Question']);
  });
});
