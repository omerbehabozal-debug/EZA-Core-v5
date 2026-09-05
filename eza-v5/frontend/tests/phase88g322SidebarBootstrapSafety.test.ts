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
  getServerAuthorityPhase,
  getServerConversationSummaries,
  getSidebarAuthorityMode,
  hasCompleteServerAuthoritySnapshot,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import {
  getLegacyMigrationMarker,
  resetLegacyMigrationMarkersForTests,
  runLegacyConversationMigration,
} from '@/lib/eza/legacyConversationMigration';
import { reconcileAuthenticatedConversationSidebar } from '@/lib/eza/reconcileAuthenticatedConversationSidebar';
import {
  STORAGE_KEY,
  readChatArchivesForScope,
  replaceChatArchivesForScope,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';
import { userScope } from '@/lib/eza/localIdentityScope';
import { markChatDeleted } from '@/lib/standaloneChatDelete';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeChat(
  id: string,
  opts?: Partial<ArchivedChat> & { migrated?: boolean }
): ArchivedChat {
  return {
    id,
    title: opts?.title || id,
    preview: opts?.preview || `p-${id}`,
    savedAt: opts?.savedAt || '2026-01-01T00:00:00.000Z',
    messageCount: 1,
    messages: [
      {
        id: `${id}-m1`,
        text: `hello ${id}`,
        isUser: true,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ],
    serverConversationId: opts?.serverConversationId,
    ...opts,
  };
}

function serverItem(n: number | string) {
  const id = typeof n === 'number' ? `srv-${n}` : n;
  const client = typeof n === 'number' ? `c-${n}` : String(n).replace(/^srv-/, 'c-');
  return {
    id,
    clientConversationId: client,
    title: `T${n}`,
    preview: '',
    messageCount: 1,
    pinned: false,
    titlePinned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastMessageAt: '2026-01-01T00:00:00.000Z',
    hasReadyYansi: false,
    publishedYansiSlug: null,
  };
}

function sidebarFor(userId: string) {
  return reconcileAuthenticatedConversationSidebar({
    ownerId: userId,
    serverSummaries: getServerConversationSummaries(),
    ownerLocalArchives: readChatArchivesForScope(userScope(userId)),
    migrationMarker: getLegacyMigrationMarker(userId),
    unsyncedClientIds: new Set(),
    mode: getSidebarAuthorityMode(),
  });
}

beforeEach(() => {
  resetServerConversationStoreForTests();
  resetLegacyMigrationMarkersForTests();
  localStorage.clear();
  vi.clearAllMocks();
  apiMocks.migrateLegacyServerConversations.mockResolvedValue({ results: [] });
});

describe('Phase 8.8G-3.2.2 sidebar bootstrap safety', () => {
  it('exact real bug: no flash-to-zero while loading or on fetch failure', async () => {
    const locals = Array.from({ length: 5 }, (_, i) => makeChat(`A${i + 1}`));
    replaceChatArchivesForScope(userScope(userA), locals);

    // Pre-auth local visibility
    expect(readChatArchivesForScope(userScope(userA))).toHaveLength(5);

    let rejectList!: (err: Error) => void;
    apiMocks.listServerConversations.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectList = reject;
        })
    );

    const pending = bootstrapServerConversations(userA);
    expect(getServerAuthorityPhase()).toBe('loading');
    expect(getSidebarAuthorityMode()).toBe('degraded');
    expect(sidebarFor(userA).map((r) => r.id).sort()).toEqual(
      ['A1', 'A2', 'A3', 'A4', 'A5'].sort()
    );

    rejectList(new Error('bootstrap_failed'));
    await expect(pending).resolves.toBe(false);
    expect(getServerAuthorityPhase()).toBe('failed');
    expect(hasCompleteServerAuthoritySnapshot()).toBe(false);
    expect(sidebarFor(userA)).toHaveLength(5);
  });

  it('mapped/migrated locals remain visible when bootstrap fails', async () => {
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('m1', { serverConversationId: 'srv-m1' }),
      makeChat('m2', { serverConversationId: 'srv-m2' }),
      makeChat('m3', { serverConversationId: 'srv-m3' }),
      makeChat('m4', { serverConversationId: 'srv-m4' }),
      makeChat('m5', { serverConversationId: 'srv-m5' }),
    ]);
    // Seed migrated markers
    localStorage.setItem(
      'eza_standalone_legacy_migration_v1',
      JSON.stringify({
        [userA]: {
          version: 'standalone-conversations-v1',
          conversations: {
            m1: { status: 'migrated', serverConversationId: 'srv-m1' },
            m2: { status: 'migrated', serverConversationId: 'srv-m2' },
            m3: { status: 'migrated', serverConversationId: 'srv-m3' },
            m4: { status: 'migrated', serverConversationId: 'srv-m4' },
            m5: { status: 'migrated', serverConversationId: 'srv-m5' },
          },
        },
      })
    );

    apiMocks.listServerConversations.mockRejectedValue(new Error('500'));
    await bootstrapServerConversations(userA);
    expect(getSidebarAuthorityMode()).toBe('degraded');
    expect(sidebarFor(userA).map((r) => r.id).sort()).toEqual(
      ['m1', 'm2', 'm3', 'm4', 'm5'].sort()
    );
  });

  it('mapped locals hidden after successful authoritative empty list', async () => {
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('gone', { serverConversationId: 'srv-gone' }),
    ]);
    apiMocks.listServerConversations.mockResolvedValue([]);
    await bootstrapServerConversations(userA);
    expect(getServerAuthorityPhase()).toBe('ready');
    expect(getSidebarAuthorityMode()).toBe('authoritative');
    expect(sidebarFor(userA).map((r) => r.id)).not.toContain('gone');
  });

  it('tombstone hidden during failure; normal mapped remains', async () => {
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('X', { serverConversationId: 'srv-x' }),
      makeChat('Y', { serverConversationId: 'srv-y' }),
    ]);
    localStorage.setItem(
      'eza_standalone_legacy_migration_v1',
      JSON.stringify({
        [userA]: {
          version: 'standalone-conversations-v1',
          conversations: {
            X: { status: 'migrated', serverConversationId: 'srv-x' },
            Y: { status: 'tombstoned', serverConversationId: 'srv-y' },
          },
        },
      })
    );
    apiMocks.listServerConversations.mockRejectedValue(new Error('fail'));
    await bootstrapServerConversations(userA);
    const ids = sidebarFor(userA).map((r) => r.id);
    expect(ids).toContain('X');
    expect(ids).not.toContain('Y');
  });

  it('local delete tombstone hidden during failure', async () => {
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('keep', { serverConversationId: 'srv-k' }),
      makeChat('del', { serverConversationId: 'srv-d' }),
    ]);
    markChatDeleted('del');
    apiMocks.listServerConversations.mockRejectedValue(new Error('fail'));
    await bootstrapServerConversations(userA);
    const ids = sidebarFor(userA).map((r) => r.id);
    expect(ids).toContain('keep');
    expect(ids).not.toContain('del');
  });

  it('partial page failure retains last-good 135', async () => {
    const good = Array.from({ length: 135 }, (_, i) => serverItem(i));
    apiMocks.listServerConversations.mockResolvedValueOnce(good);
    await bootstrapServerConversations(userA);
    expect(getServerConversationSummaries()).toHaveLength(135);

    apiMocks.listServerConversations.mockRejectedValueOnce(new Error('page2'));
    const ok = await bootstrapServerConversations(userA);
    expect(ok).toBe(false);
    expect(getServerConversationSummaries()).toHaveLength(135);
    expect(hasCompleteServerAuthoritySnapshot()).toBe(true);
    expect(getSidebarAuthorityMode()).toBe('authoritative');
  });

  it('first-boot partial failure does not install incomplete page; shows local 20', async () => {
    replaceChatArchivesForScope(
      userScope(userA),
      Array.from({ length: 20 }, (_, i) => makeChat(`L${i}`))
    );
    apiMocks.listServerConversations.mockRejectedValue(new Error('page2'));
    await bootstrapServerConversations(userA);
    expect(getServerConversationSummaries()).toHaveLength(0);
    expect(hasCompleteServerAuthoritySnapshot()).toBe(false);
    expect(sidebarFor(userA)).toHaveLength(20);
  });

  it('owner switch: A last-good never leaks to B; B degraded locals visible', async () => {
    apiMocks.listServerConversations.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => serverItem(i))
    );
    await bootstrapServerConversations(userA);
    expect(getServerConversationSummaries()).toHaveLength(50);

    replaceChatArchivesForScope(userScope(userB), [
      makeChat('B1'),
      makeChat('B2'),
      makeChat('B3'),
    ]);
    apiMocks.listServerConversations.mockRejectedValue(new Error('B fail'));
    await bootstrapServerConversations(userB);

    expect(getServerConversationSummaries().map((s) => s.id)).not.toContain('c-0');
    expect(sidebarFor(userB).map((r) => r.id).sort()).toEqual(['B1', 'B2', 'B3']);
    expect(sidebarFor(userA).map((r) => r.id)).not.toEqual(
      expect.arrayContaining(['c-0'])
    );
    // A store is no longer active owner — sidebar helper for A uses empty server + A's locals
    // but mode is B's degraded; calling sidebarFor(A) uses getSidebarAuthorityMode() which is
    // degraded for B session. A's locals should not appear when building for B.
    expect(sidebarFor(userB).some((r) => r.id.startsWith('c-'))).toBe(false);
  });

  it('flat archive excluded from degraded fallback (G88321 preserved)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([makeChat('F1')])
    );
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);
    apiMocks.listServerConversations.mockRejectedValue(new Error('fail'));
    await bootstrapServerConversations(userA);
    const ids = sidebarFor(userA).map((r) => r.id);
    expect(ids).toContain('A1');
    expect(ids).not.toContain('F1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).map((c: { id: string }) => c.id)).toEqual([
      'F1',
    ]);
  });

  it('success path uses authoritative reconciliation', async () => {
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);
    apiMocks.listServerConversations.mockResolvedValue([
      serverItem('srv-s1'),
      { ...serverItem('srv-s2'), clientConversationId: 'S2', id: 'srv-s2' },
    ]);
    // Fix client ids
    apiMocks.listServerConversations.mockResolvedValue([
      {
        ...serverItem(1),
        id: 'srv-s1',
        clientConversationId: 'S1',
      },
      {
        ...serverItem(2),
        id: 'srv-s2',
        clientConversationId: 'S2',
      },
    ]);
    await bootstrapServerConversations(userA);
    expect(getSidebarAuthorityMode()).toBe('authoritative');
    const ids = sidebarFor(userA).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['S1', 'S2', 'A1']));
  });

  it('FAILED is not SUCCESS_EMPTY: migration does not run on bootstrap failure', async () => {
    replaceChatArchivesForScope(userScope(userA), [makeChat('A1')]);
    apiMocks.listServerConversations.mockRejectedValue(new Error('fail'));
    const ok = await bootstrapServerConversations(userA);
    expect(ok).toBe(false);
    await runLegacyConversationMigration(userA);
    expect(apiMocks.migrateLegacyServerConversations).not.toHaveBeenCalled();
  });

  it('unsynced local survives authoritative empty success', async () => {
    replaceChatArchivesForScope(userScope(userA), [makeChat('draft')]);
    apiMocks.listServerConversations.mockResolvedValue([]);
    await bootstrapServerConversations(userA);
    const rows = reconcileAuthenticatedConversationSidebar({
      ownerId: userA,
      serverSummaries: getServerConversationSummaries(),
      ownerLocalArchives: readChatArchivesForScope(userScope(userA)),
      migrationMarker: null,
      unsyncedClientIds: new Set(['draft']),
      mode: 'authoritative',
    });
    expect(rows.map((r) => r.id)).toContain('draft');
  });
});
