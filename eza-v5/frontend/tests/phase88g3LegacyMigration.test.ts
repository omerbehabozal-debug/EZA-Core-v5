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
  getServerConversationSummaries,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  collectLegacyMigrationCandidates,
  getLegacyMigrationMarker,
  isLegacyMigrationComplete,
  resetLegacyMigrationMarkersForTests,
  runLegacyConversationMigration,
  sanitizeTreeMetadataForMigration,
} from '@/lib/eza/legacyConversationMigration';
import {
  readChatArchivesForScope,
  replaceChatArchivesForScope,
} from '@/lib/standaloneChatArchive';
import { guestScope, userScope } from '@/lib/eza/localIdentityScope';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function seedUserChat(
  userId: string,
  chat: {
    id: string;
    title?: string;
    messages: Array<{ id: string; text: string; isUser: boolean }>;
    serverConversationId?: string;
    treeMetadata?: Record<string, unknown>;
  }
) {
  replaceChatArchivesForScope(userScope(userId), [
    {
      id: chat.id,
      title: chat.title || 'Legacy',
      preview: chat.messages[0]?.text || '',
      savedAt: '2026-01-01T00:00:00.000Z',
      messageCount: chat.messages.length,
      messages: chat.messages.map((m) => ({
        id: m.id,
        text: m.text,
        isUser: m.isUser,
        timestamp: '2026-01-01T00:00:00.000Z',
      })),
      serverConversationId: chat.serverConversationId,
      treeMetadata: chat.treeMetadata as never,
    },
  ]);
}

function seedGuestChat() {
  replaceChatArchivesForScope(guestScope('guest-token-xyz'), [
    {
      id: 'guest-chat-1',
      title: 'Guest only',
      preview: 'g',
      savedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 1,
      messages: [{ id: 'g1', text: 'guest msg', isUser: true }],
    },
  ]);
}

beforeEach(() => {
  resetServerConversationStoreForTests();
  resetLegacyMigrationMarkersForTests();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Phase 8.8G-3 legacy migration frontend', () => {
  it('A/B: only current user bucket inspected; guest ignored', () => {
    seedUserChat(userA, {
      id: 'chat-a',
      messages: [
        { id: 'u1', text: 'A user', isUser: true },
        { id: 'e1', text: 'A asst', isUser: false },
      ],
    });
    seedGuestChat();

    const candidates = collectLegacyMigrationCandidates(userA);
    expect(candidates.map((c) => c.id)).toEqual(['chat-a']);
    expect(candidates.some((c) => c.id === 'guest-chat-1')).toBe(false);
  });

  it('D: already server-backed local chat not uploaded', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-1',
        clientConversationId: 'chat-linked',
        title: 'Server',
        preview: 'p',
        conversationType: 'direct',
        messageCount: 1,
        createdAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    ]);
    seedUserChat(userA, {
      id: 'chat-linked',
      serverConversationId: 'srv-1',
      messages: [{ id: 'u1', text: 'hi', isUser: true }],
    });

    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);

    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it('E/F: local-only chat migrated and summaries refreshed', async () => {
    apiMocks.listServerConversations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'srv-new',
          clientConversationId: 'chat-local',
          title: 'Legacy title',
          preview: 'hello',
          conversationType: 'direct',
          messageCount: 2,
          createdAt: '2026-01-01T00:00:00Z',
          archived: false,
          pinned: false,
          titlePinned: false,
        },
      ]);
    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'chat-local',
          status: 'migrated',
          serverConversationId: 'srv-new',
          messageCount: 2,
        },
      ],
    });

    seedUserChat(userA, {
      id: 'chat-local',
      title: 'Legacy title',
      messages: [
        { id: 'u1', text: 'hello', isUser: true },
        { id: 'e1', text: 'world', isUser: false },
      ],
    });

    const ok = await bootstrapServerConversations(userA);
    expect(ok).toBe(true);
    const result = await runLegacyConversationMigration(userA);

    expect(apiMocks.migrateLegacyServerConversations).toHaveBeenCalledTimes(1);
    const payload = apiMocks.migrateLegacyServerConversations.mock.calls[0]![0] as Array<{
      clientConversationId: string;
      messages: Array<{ role: string }>;
    }>;
    expect(payload[0]!.clientConversationId).toBe('chat-local');
    expect(payload[0]!.messages.some((m) => m.role === 'assistant')).toBe(true);
    expect(result.ran).toBe(true);
    expect(result.refreshed).toBe(true);
    expect(getServerConversationSummaries()[0]?.title).toBe('Legacy title');

    const local = readChatArchivesForScope(userScope(userA));
    expect(local[0]?.serverConversationId).toBe('srv-new');
    expect(local[0]?.messages).toHaveLength(2);
  });

  it('I: local source transcript retained after migration', async () => {
    apiMocks.listServerConversations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'srv-k',
          clientConversationId: 'chat-keep',
          title: 'Keep',
          preview: 'x',
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
          clientConversationId: 'chat-keep',
          status: 'migrated',
          serverConversationId: 'srv-k',
          messageCount: 1,
        },
      ],
    });

    seedUserChat(userA, {
      id: 'chat-keep',
      messages: [{ id: 'u1', text: 'keep me', isUser: true }],
    });
    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    const local = readChatArchivesForScope(userScope(userA));
    expect(local[0]?.messages[0]?.text).toBe('keep me');
    expect(localStorage.getItem('eza_standalone_chat_archive_scoped_v1')).toBeTruthy();
  });

  it('G/H: retryable failure does not mark complete', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    apiMocks.migrateLegacyServerConversations.mockRejectedValue(new Error('network'));

    seedUserChat(userA, {
      id: 'chat-fail',
      messages: [{ id: 'u1', text: 'x', isUser: true }],
    });
    await bootstrapServerConversations(userA);
    const result = await runLegacyConversationMigration(userA);

    expect(result.results[0]?.status).toBe('failed_retryable');
    expect(isLegacyMigrationComplete(userA)).toBe(false);
    const marker = getLegacyMigrationMarker(userA);
    expect(marker?.conversations['chat-fail']?.status).toBe('failed_retryable');
    expect(marker?.completedAt).toBeUndefined();
  });

  it('J: A→B switch ignores late A migration response', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    let resolveMig!: (v: unknown) => void;
    apiMocks.migrateLegacyServerConversations.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMig = resolve;
        })
    );

    seedUserChat(userA, {
      id: 'chat-a-late',
      messages: [{ id: 'u1', text: 'A', isUser: true }],
    });
    await bootstrapServerConversations(userA);
    const pending = runLegacyConversationMigration(userA);

    clearServerConversationState();
    await bootstrapServerConversations(userB);

    resolveMig({
      results: [
        {
          clientConversationId: 'chat-a-late',
          status: 'migrated',
          serverConversationId: 'srv-a',
        },
      ],
    });
    const result = await pending;
    expect(result.ran).toBe(false);
    expect(getLegacyMigrationMarker(userB)).toBeNull();
    expect(getServerConversationSummaries()).toEqual([]);
  });

  it('K: Device B with empty local only needs bootstrap', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-b',
        clientConversationId: 'chat-from-a',
        title: 'From A migration',
        preview: 'hi',
        conversationType: 'direct',
        messageCount: 2,
        createdAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    ]);

    await bootstrapServerConversations(userB);
    const mig = await runLegacyConversationMigration(userB);

    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
    expect(mig.ran).toBe(false);
    expect(getServerConversationSummaries()[0]?.title).toBe('From A migration');
  });

  it('L: strips continuation proof; does not invent Yansı migration', () => {
    const cleaned = sanitizeTreeMetadataForMigration({
      sourceType: 'mirror',
      startedFromMirrorId: 'slug-1',
      lineageProofToken: 'PROOF',
    });
    expect(cleaned?.lineageProofToken).toBeUndefined();
    expect(cleaned?.startedFromMirrorId).toBe('slug-1');
    expect(cleaned).not.toHaveProperty('readyYansi');
  });

  it('C: migration requires successful bootstrap first', async () => {
    apiMocks.listServerConversations.mockRejectedValue(new Error('bootstrap failed'));
    seedUserChat(userA, {
      id: 'chat-x',
      messages: [{ id: 'u1', text: 'x', isUser: true }],
    });
    const ok = await bootstrapServerConversations(userA);
    expect(ok).toBe(false);
    const mig = await runLegacyConversationMigration(userA);
    expect(mig.ran).toBe(false);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
  });
});
