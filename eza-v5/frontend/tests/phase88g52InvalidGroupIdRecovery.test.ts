/**
 * Phase 8.8G-5 / 2.2 — invalid_group_id content recovery.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  listServerConversationsPage: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
  migrateLegacyServerConversations: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/eza/standaloneConversationsApi')>(
    '@/lib/eza/standaloneConversationsApi'
  );
  return {
    ...actual,
    listServerConversations: (...args: unknown[]) =>
      apiMocks.listServerConversations(...args),
    listServerConversationsPage: (...args: unknown[]) =>
      apiMocks.listServerConversationsPage(...args),
    getServerConversation: (...args: unknown[]) => apiMocks.getServerConversation(...args),
    // Keep real createServerConversation for sanitize-path test — override below when needed.
    createServerConversation: actual.createServerConversation,
    patchServerConversation: (...args: unknown[]) =>
      apiMocks.patchServerConversation(...args),
    deleteServerConversation: (...args: unknown[]) =>
      apiMocks.deleteServerConversation(...args),
    migrateLegacyServerConversations: (...args: unknown[]) =>
      apiMocks.migrateLegacyServerConversations(...args),
  };
});

const apiClientPost = vi.hoisted(() => vi.fn());

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => apiClientPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { createServerConversation } from '@/lib/eza/standaloneConversationsApi';
import {
  bootstrapServerConversations,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  LEGACY_MIGRATION_BATCH_SIZE,
  LEGACY_MIGRATION_VERSION,
  classifyLegacyMigrationCandidates,
  collectLegacyMigrationCandidates,
  getLegacyMigrationMarker,
  isLegacyMigrationComplete,
  isReopenableInvalidGroupIdRejection,
  resetLegacyMigrationMarkersForTests,
  runLegacyConversationMigration,
} from '@/lib/eza/legacyConversationMigration';
import {
  isValidServerGroupUuid,
  sanitizeOptionalServerGroupId,
} from '@/lib/eza/serverGroupId';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  userScope,
} from '@/lib/eza/localIdentityScope';
import {
  STORAGE_KEY,
  readChatArchivesForScope,
  replaceChatArchivesForScope,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';
import { markChatDeleted } from '@/lib/standaloneChatDelete';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const validGroupUuid = '11111111-1111-4111-8111-111111111111';
const MARKER_KEY = 'eza_standalone_legacy_migration_v1';

function authAs(userId: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'token');
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ user_id: userId }));
}

function makeChat(
  id: string,
  opts?: Partial<ArchivedChat> & { text?: string; empty?: boolean }
): ArchivedChat {
  const empty = Boolean(opts?.empty);
  const text = opts?.text ?? `hello ${id}`;
  const messages = empty
    ? []
    : [
        {
          id: `${id}-m1`,
          text,
          isUser: true,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];
  return {
    id,
    title: opts?.title || id,
    preview: text,
    savedAt: opts?.savedAt || '2026-01-01T00:00:00.000Z',
    messageCount: messages.length,
    messages,
    groupId: opts?.groupId ?? null,
    serverConversationId: opts?.serverConversationId,
    ...opts,
    messages: opts?.messages ?? messages,
  };
}

function seedScoped(userId: string, chats: ArchivedChat[]) {
  replaceChatArchivesForScope(userScope(userId), chats);
}

function seedMarker(
  userId: string,
  conversations: Record<
    string,
    { status: string; reason?: string | null; serverConversationId?: string | null }
  >,
  completedAt?: string
) {
  localStorage.setItem(
    MARKER_KEY,
    JSON.stringify({
      [userId]: {
        version: LEGACY_MIGRATION_VERSION,
        ...(completedAt ? { completedAt } : {}),
        conversations,
      },
    })
  );
}

function emptyListPage() {
  return {
    items: [],
    limit: 100,
    offset: 0,
    total: 0,
    hasMore: false,
  };
}

describe('Phase 8.8G-5 / 2.2 invalid_group_id content recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerConversationStoreForTests();
    resetLegacyMigrationMarkersForTests();
    authAs(userA);
    apiMocks.listServerConversations.mockResolvedValue([]);
    apiMocks.listServerConversationsPage.mockResolvedValue(emptyListPage());
    apiMocks.migrateLegacyServerConversations.mockReset();
    apiClientPost.mockReset();
    apiClientPost.mockResolvedValue({
      ok: true,
      data: {
        id: 'srv-new',
        clientConversationId: 'c-new',
        conversationType: 'direct',
        messageCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    });
  });

  it('UUID helpers: valid preserved, legacy group-* omitted', () => {
    expect(isValidServerGroupUuid(validGroupUuid)).toBe(true);
    expect(isValidServerGroupUuid('group-1710000000-abc123')).toBe(false);
    expect(isValidServerGroupUuid('')).toBe(false);
    expect(sanitizeOptionalServerGroupId('group-1710000000-abc123')).toBeUndefined();
    expect(sanitizeOptionalServerGroupId(validGroupUuid)).toBe(validGroupUuid);
  });

  it('1. scoped + non-UUID groupId → payload sanitized → migrates; local groupId intact', async () => {
    const localGroup = 'group-1710000000-abc123';
    seedScoped(userA, [makeChat('c1', { groupId: localGroup })]);

    const { payloads } = classifyLegacyMigrationCandidates(
      collectLegacyMigrationCandidates(userA)
    );
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.groupId).toBeUndefined();
    expect(readChatArchivesForScope(userScope(userA))[0]?.groupId).toBe(localGroup);

    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'c1',
          status: 'migrated',
          serverConversationId: 'srv-c1',
          reason: 'group_id_sanitized',
        },
      ],
    });

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    const posted = apiMocks.migrateLegacyServerConversations.mock.calls[0]?.[0];
    expect(posted?.[0]?.groupId).toBeUndefined();
    expect(getLegacyMigrationMarker(userA)?.conversations.c1?.status).toBe('migrated');
    expect(readChatArchivesForScope(userScope(userA))[0]?.groupId).toBe(localGroup);
    expect(readChatArchivesForScope(userScope(userA))[0]?.serverConversationId).toBe('srv-c1');
  });

  it('2. flat historical + invalid groupId → NEVER candidate', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([makeChat('flat-1', { groupId: 'group-flat-xyz' })])
    );
    seedScoped(userA, []);
    expect(collectLegacyMigrationCandidates(userA).map((c) => c.id)).not.toContain('flat-1');
  });

  it('3. rejected_invalid + invalid_group_id → reopenable', () => {
    seedScoped(userA, [makeChat('r1', { groupId: 'group-x' })]);
    seedMarker(userA, {
      r1: { status: 'rejected_invalid', reason: 'invalid_group_id' },
    });
    expect(
      isReopenableInvalidGroupIdRejection(
        getLegacyMigrationMarker(userA)?.conversations.r1
      )
    ).toBe(true);
    expect(collectLegacyMigrationCandidates(userA).map((c) => c.id)).toEqual(['r1']);
  });

  it('4. rejected_invalid + other reason → remains terminal', () => {
    seedScoped(userA, [makeChat('bad', { groupId: 'group-x' })]);
    seedMarker(userA, {
      bad: { status: 'rejected_invalid', reason: 'unknown_conversation_type' },
    });
    expect(collectLegacyMigrationCandidates(userA)).toHaveLength(0);
  });

  it('5. completedAt + invalid_group_id reopenable → migration still runs', async () => {
    seedScoped(userA, [makeChat('r2', { groupId: 'group-y' })]);
    seedMarker(
      userA,
      { r2: { status: 'rejected_invalid', reason: 'invalid_group_id' } },
      '2026-01-02T00:00:00.000Z'
    );
    expect(isLegacyMigrationComplete(userA)).toBe(true);

    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'r2',
          status: 'migrated',
          serverConversationId: 'srv-r2',
        },
      ],
    });

    await bootstrapServerConversations(userA);
    const run = await runLegacyConversationMigration(userA);
    expect(run.ran).toBe(true);
    expect(apiMocks.migrateLegacyServerConversations).toHaveBeenCalled();
  });

  it('6. successful retry → migrated + serverConversationId + completion restored', async () => {
    seedScoped(userA, [makeChat('r3', { groupId: 'group-z' })]);
    seedMarker(
      userA,
      { r3: { status: 'rejected_invalid', reason: 'invalid_group_id' } },
      '2026-01-02T00:00:00.000Z'
    );

    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'r3',
          status: 'migrated',
          serverConversationId: 'srv-r3',
          reason: 'group_id_sanitized',
        },
      ],
    });

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    expect(getLegacyMigrationMarker(userA)?.conversations.r3?.status).toBe('migrated');
    expect(getLegacyMigrationMarker(userA)?.conversations.r3?.serverConversationId).toBe(
      'srv-r3'
    );
    expect(readChatArchivesForScope(userScope(userA))[0]?.serverConversationId).toBe('srv-r3');
    expect(isLegacyMigrationComplete(userA)).toBe(true);
  });

  it('7. retry twice → one durable conversation (idempotent already_server)', async () => {
    seedScoped(userA, [makeChat('r4', { groupId: 'group-dup' })]);
    seedMarker(userA, {
      r4: { status: 'rejected_invalid', reason: 'invalid_group_id' },
    });

    apiMocks.migrateLegacyServerConversations
      .mockResolvedValueOnce({
        results: [
          {
            clientConversationId: 'r4',
            status: 'migrated',
            serverConversationId: 'srv-r4',
          },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          {
            clientConversationId: 'r4',
            status: 'already_server_authoritative',
            serverConversationId: 'srv-r4',
          },
        ],
      });

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    // Second run: local now has serverConversationId → no candidate
    const second = await runLegacyConversationMigration(userA);
    expect(second.ran).toBe(false);
    expect(apiMocks.migrateLegacyServerConversations).toHaveBeenCalledTimes(1);
  });

  it('8. API failure during retry → local preserved + retryable', async () => {
    seedScoped(userA, [makeChat('r5', { groupId: 'group-fail' })]);
    seedMarker(
      userA,
      { r5: { status: 'rejected_invalid', reason: 'invalid_group_id' } },
      '2026-01-02T00:00:00.000Z'
    );
    apiMocks.migrateLegacyServerConversations.mockRejectedValue(new Error('network'));

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    expect(readChatArchivesForScope(userScope(userA))[0]?.id).toBe('r5');
    expect(readChatArchivesForScope(userScope(userA))[0]?.groupId).toBe('group-fail');
    expect(getLegacyMigrationMarker(userA)?.conversations.r5?.status).toBe('failed_retryable');
    expect(isLegacyMigrationComplete(userA)).toBe(false);
    expect(collectLegacyMigrationCandidates(userA).map((c) => c.id)).toEqual(['r5']);
  });

  it('9. multiple invalid_group_id records drain across batches', async () => {
    const n = LEGACY_MIGRATION_BATCH_SIZE + 5;
    const chats = Array.from({ length: n }, (_, i) =>
      makeChat(`batch-${i}`, { groupId: `group-batch-${i}` })
    );
    seedScoped(userA, chats);
    const convs: Record<string, { status: string; reason: string }> = {};
    for (const c of chats) {
      convs[c.id] = { status: 'rejected_invalid', reason: 'invalid_group_id' };
    }
    seedMarker(userA, convs, '2026-01-02T00:00:00.000Z');

    apiMocks.migrateLegacyServerConversations.mockImplementation(async (batch: { clientConversationId: string }[]) => ({
      results: batch.map((p) => ({
        clientConversationId: p.clientConversationId,
        status: 'migrated' as const,
        serverConversationId: `srv-${p.clientConversationId}`,
      })),
    }));

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    expect(apiMocks.migrateLegacyServerConversations.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(isLegacyMigrationComplete(userA)).toBe(true);
    for (const c of chats) {
      expect(getLegacyMigrationMarker(userA)?.conversations[c.id]?.status).toBe('migrated');
    }
  });

  it('10. tombstoned/deleted → never resurrected', async () => {
    seedScoped(userA, [
      makeChat('tomb', { groupId: 'group-t' }),
      makeChat('del', { groupId: 'group-d' }),
    ]);
    seedMarker(userA, {
      tomb: {
        status: 'tombstoned',
        reason: 'server_deleted',
        serverConversationId: 'srv-tomb',
      },
      del: { status: 'rejected_invalid', reason: 'invalid_group_id' },
    });
    markChatDeleted('del');

    expect(collectLegacyMigrationCandidates(userA).map((c) => c.id)).toEqual([]);

    apiMocks.migrateLegacyServerConversations.mockResolvedValue({ results: [] });
    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
  });

  it('11. valid UUID groupId preserved on payload', () => {
    seedScoped(userA, [makeChat('uuid-g', { groupId: validGroupUuid })]);
    const { payloads } = classifyLegacyMigrationCandidates(
      collectLegacyMigrationCandidates(userA)
    );
    expect(payloads[0]?.groupId).toBe(validGroupUuid);
  });

  it('13. createServerConversation omits invalid local groupId from POST body', async () => {
    await createServerConversation({
      clientConversationId: 'new-1',
      conversationType: 'direct',
      groupId: 'group-1710000000-abc',
    });
    const body = apiClientPost.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(body.groupId).toBeUndefined();
    expect(body.clientConversationId).toBe('new-1');

    apiClientPost.mockClear();
    await createServerConversation({
      clientConversationId: 'new-2',
      conversationType: 'direct',
      groupId: validGroupUuid,
    });
    const body2 = apiClientPost.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(body2.groupId).toBe(validGroupUuid);
  });
});
