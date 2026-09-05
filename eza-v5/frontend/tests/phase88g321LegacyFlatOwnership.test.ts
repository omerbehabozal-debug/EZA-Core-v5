import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
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
    getServerConversation: (...args: unknown[]) => apiMocks.getServerConversation(...args),
    createServerConversation: (...args: unknown[]) =>
      apiMocks.createServerConversation(...args),
    patchServerConversation: (...args: unknown[]) =>
      apiMocks.patchServerConversation(...args),
    deleteServerConversation: (...args: unknown[]) =>
      apiMocks.deleteServerConversation(...args),
    migrateLegacyServerConversations: (...args: unknown[]) =>
      apiMocks.migrateLegacyServerConversations(...args),
  };
});

import {
  bootstrapServerConversations,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  LEGACY_MIGRATION_BATCH_SIZE,
  collectLegacyMigrationCandidates,
  getLegacyMigrationMarker,
  isLegacyMigrationComplete,
  resetLegacyMigrationMarkersForTests,
  runLegacyConversationMigration,
} from '@/lib/eza/legacyConversationMigration';
import { reconcileAuthenticatedConversationSidebar } from '@/lib/eza/reconcileAuthenticatedConversationSidebar';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  guestScope,
  userScope,
} from '@/lib/eza/localIdentityScope';
import {
  STORAGE_KEY,
  readChatArchivesForScope,
  replaceChatArchivesForScope,
  upsertChatArchive,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';
import { markChatDeleted } from '@/lib/standaloneChatDelete';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const guestToken = 'guest-token-xyz';

function authAs(userId: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'token');
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ user_id: userId }));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

function makeChat(
  id: string,
  opts?: Partial<ArchivedChat> & { empty?: boolean }
): ArchivedChat {
  const empty = Boolean(opts?.empty);
  const messages = empty
    ? []
    : [
        {
          id: `${id}-m1`,
          text: opts?.preview || `hello ${id}`,
          isUser: true,
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];
  return {
    id,
    title: opts?.title || id,
    preview: opts?.preview || `hello ${id}`,
    savedAt: opts?.savedAt || '2026-01-01T00:00:00.000Z',
    messageCount: messages.length,
    messages,
    groupId: opts?.groupId ?? null,
    serverConversationId: opts?.serverConversationId,
  };
}

function seedFlat(chats: ArchivedChat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function readFlatRaw(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function parseFlat(): ArchivedChat[] {
  const raw = readFlatRaw();
  if (!raw) return [];
  return JSON.parse(raw) as ArchivedChat[];
}

beforeEach(() => {
  resetServerConversationStoreForTests();
  resetLegacyMigrationMarkersForTests();
  localStorage.clear();
  vi.clearAllMocks();
  apiMocks.listServerConversations.mockResolvedValue([]);
  apiMocks.migrateLegacyServerConversations.mockResolvedValue({ results: [] });
});

describe('Phase 8.8G-3.2.1 legacy flat ownership', () => {
  it('A. flat exists + authenticated A → flat NOT copied into user:A', async () => {
    seedFlat([makeChat('F1'), makeChat('F2')]);
    authAs(userA);

    await bootstrapServerConversations(userA);
    readChatArchivesForScope(userScope(userA));

    const scoped = readChatArchivesForScope(userScope(userA));
    expect(scoped.map((c) => c.id)).not.toContain('F1');
    expect(scoped.map((c) => c.id)).not.toContain('F2');
    expect(parseFlat().map((c) => c.id).sort()).toEqual(['F1', 'F2']);
  });

  it('B. flat exists + authenticated A → flat chat NOT in migration payload', async () => {
    seedFlat([makeChat('F1'), makeChat('F2')]);
    authAs(userA);
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);

    apiMocks.migrateLegacyServerConversations.mockImplementation(async (batch) => ({
      results: batch.map((p: { clientConversationId: string }) => ({
        clientConversationId: p.clientConversationId,
        status: 'migrated',
        serverConversationId: `srv-${p.clientConversationId}`,
      })),
    }));

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    const submittedIds = apiMocks.migrateLegacyServerConversations.mock.calls.flatMap(
      (call) => (call[0] as Array<{ clientConversationId: string }>).map((p) => p.clientConversationId)
    );
    expect(submittedIds).toContain('A1');
    expect(submittedIds).not.toContain('F1');
    expect(submittedIds).not.toContain('F2');
  });

  it('C. flat exists + authenticated A → flat NOT in authenticated sidebar fallback', async () => {
    seedFlat([makeChat('F1', { empty: true })]);
    authAs(userA);
    replaceChatArchivesForScope(userScope(userA), [makeChat('A-empty', { empty: true })]);

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    const rows = reconcileAuthenticatedConversationSidebar({
      ownerId: userA,
      serverSummaries: [],
      ownerLocalArchives: readChatArchivesForScope(userScope(userA)),
      migrationMarker: getLegacyMigrationMarker(userA),
    });
    expect(rows.map((r) => r.id)).toContain('A-empty');
    expect(rows.map((r) => r.id)).not.toContain('F1');
  });

  it('D. flat exists + A then B → neither claims flat', async () => {
    seedFlat([makeChat('F1')]);

    authAs(userA);
    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    expect(readChatArchivesForScope(userScope(userA)).map((c) => c.id)).not.toContain('F1');

    clearAuth();
    resetServerConversationStoreForTests();
    authAs(userB);
    await bootstrapServerConversations(userB);
    await runLegacyConversationMigration(userB);
    expect(readChatArchivesForScope(userScope(userB)).map((c) => c.id)).not.toContain('F1');

    expect(parseFlat().map((c) => c.id)).toEqual(['F1']);
  });

  it('E. flat exists + guest:G → flat not silently claimed by guest:G', () => {
    seedFlat([makeChat('F1')]);
    replaceChatArchivesForScope(guestScope(guestToken), [makeChat('G1')]);

    const guestRows = readChatArchivesForScope(guestScope(guestToken));
    expect(guestRows.map((c) => c.id)).toEqual(['G1']);
    expect(guestRows.map((c) => c.id)).not.toContain('F1');
    expect(parseFlat().map((c) => c.id)).toEqual(['F1']);
  });

  it('F. flat remains physically preserved after reads/bootstrap', async () => {
    const flatPayload = [makeChat('F1'), makeChat('F2')];
    seedFlat(flatPayload);
    authAs(userA);
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    readChatArchivesForScope(userScope(userA));
    upsertChatArchive(makeChat('A2'));

    expect(readFlatRaw()).toBeTruthy();
    expect(parseFlat().map((c) => c.id).sort()).toEqual(['F1', 'F2']);
  });

  it('G/H. user:A scoped still migrates; completedAt ignores ambiguous flat', async () => {
    seedFlat([makeChat('F1')]);
    authAs(userA);
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);

    apiMocks.migrateLegacyServerConversations.mockResolvedValue({
      results: [
        {
          clientConversationId: 'A1',
          status: 'migrated',
          serverConversationId: 'srv-A1',
        },
      ],
    });

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    expect(isLegacyMigrationComplete(userA)).toBe(true);
    expect(getLegacyMigrationMarker(userA)?.conversations['A1']?.status).toBe('migrated');
    expect(getLegacyMigrationMarker(userA)?.conversations['F1']).toBeUndefined();
    expect(collectLegacyMigrationCandidates(userA).map((c) => c.id)).not.toContain('F1');
  });

  it('I. 35 scoped user chats still batch correctly with flat present', async () => {
    seedFlat([makeChat('F1')]);
    authAs(userA);
    const chats = Array.from({ length: 35 }, (_, i) =>
      makeChat(`c${String(i + 1).padStart(2, '0')}`)
    );
    replaceChatArchivesForScope(userScope(userA), chats);

    apiMocks.migrateLegacyServerConversations.mockImplementation(async (batch) => {
      expect(batch.length).toBeLessThanOrEqual(LEGACY_MIGRATION_BATCH_SIZE);
      return {
        results: batch.map((p: { clientConversationId: string }) => ({
          clientConversationId: p.clientConversationId,
          status: 'migrated',
          serverConversationId: `srv-${p.clientConversationId}`,
        })),
      };
    });

    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);

    expect(apiMocks.migrateLegacyServerConversations.mock.calls.length).toBeGreaterThanOrEqual(2);
    const submitted = apiMocks.migrateLegacyServerConversations.mock.calls.flatMap(
      (call) => (call[0] as Array<{ clientConversationId: string }>).map((p) => p.clientConversationId)
    );
    expect(submitted).toHaveLength(35);
    expect(submitted).not.toContain('F1');
    expect(isLegacyMigrationComplete(userA)).toBe(true);
  });

  it('J. 31st authenticated scoped save does not delete first', () => {
    authAs(userA);
    const chats = Array.from({ length: 30 }, (_, i) =>
      makeChat(`chat-${i + 1}`, {
        savedAt: `2026-01-01T${String(i).padStart(2, '0')}:00:00.000Z`,
      })
    );
    replaceChatArchivesForScope(userScope(userA), chats);
    upsertChatArchive(makeChat('chat-31', { savedAt: '2026-01-02T00:00:00.000Z' }));
    const after = readChatArchivesForScope(userScope(userA));
    expect(after.some((c) => c.id === 'chat-1')).toBe(true);
    expect(after.some((c) => c.id === 'chat-31')).toBe(true);
    expect(after.length).toBe(31);
  });

  it('K/L. server tombstone and delete still suppress scoped local fallback', () => {
    authAs(userA);
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('tomb-1'),
      makeChat('del-1'),
    ]);
    markChatDeleted('del-1');

    const rows = reconcileAuthenticatedConversationSidebar({
      ownerId: userA,
      serverSummaries: [],
      ownerLocalArchives: readChatArchivesForScope(userScope(userA)),
      migrationMarker: {
        version: 'standalone-conversations-v1',
        conversations: {
          'tomb-1': { status: 'tombstoned' },
          'del-1': { status: 'empty_transcript' },
        },
      },
    });
    expect(rows.map((r) => r.id)).not.toContain('tomb-1');
    expect(rows.map((r) => r.id)).not.toContain('del-1');
  });

  it('multi-account: A and B process only own scoped; never flat', async () => {
    seedFlat([makeChat('F1')]);
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);
    replaceChatArchivesForScope(userScope(userB), [makeChat('B1')]);

    apiMocks.migrateLegacyServerConversations.mockImplementation(async (batch) => ({
      results: batch.map((p: { clientConversationId: string }) => ({
        clientConversationId: p.clientConversationId,
        status: 'migrated',
        serverConversationId: `srv-${p.clientConversationId}`,
      })),
    }));

    authAs(userA);
    await bootstrapServerConversations(userA);
    await runLegacyConversationMigration(userA);
    let submitted = apiMocks.migrateLegacyServerConversations.mock.calls.flatMap(
      (call) => (call[0] as Array<{ clientConversationId: string }>).map((p) => p.clientConversationId)
    );
    expect(submitted).toEqual(['A1']);

    apiMocks.migrateLegacyServerConversations.mockClear();
    clearAuth();
    resetServerConversationStoreForTests();
    authAs(userB);
    await bootstrapServerConversations(userB);
    await runLegacyConversationMigration(userB);
    submitted = apiMocks.migrateLegacyServerConversations.mock.calls.flatMap(
      (call) => (call[0] as Array<{ clientConversationId: string }>).map((p) => p.clientConversationId)
    );
    expect(submitted).toEqual(['B1']);
    expect(parseFlat().map((c) => c.id)).toEqual(['F1']);
  });
});
