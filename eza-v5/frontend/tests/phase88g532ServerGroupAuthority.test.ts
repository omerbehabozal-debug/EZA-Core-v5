/**
 * Phase 8.8G-5.3.2 — authenticated server group bootstrap + authority.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientGet = vi.hoisted(() => vi.fn());
const apiClientPost = vi.hoisted(() => vi.fn());
const apiClientPatch = vi.hoisted(() => vi.fn());
const apiClientDelete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGet(...args),
    post: (...args: unknown[]) => apiClientPost(...args),
    patch: (...args: unknown[]) => apiClientPatch(...args),
    delete: (...args: unknown[]) => apiClientDelete(...args),
  },
}));

import {
  GROUPS_STORAGE_KEY,
  createConversationGroup,
  deleteConversationGroup,
  listConversationGroups,
  peekScopedConversationGroupsForScope,
  replaceConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import {
  buildConversationTree,
  shouldUseConversationTreeMode,
} from '@/lib/eza/conversation-tree/groupTree';
import { UNGROUPED_CONVERSATION_GROUP_ID } from '@/lib/eza/conversation-tree/types';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  userScope,
} from '@/lib/eza/localIdentityScope';
import {
  assignAuthenticatedConversationGroup,
  bootstrapServerConversationGroups,
  clearServerConversationGroupState,
  createAuthenticatedConversationGroup,
  deleteAuthenticatedConversationGroup,
  getActiveGroupOwnerForTests,
  getGroupAuthorityPhase,
  getGroupsForAuthenticatedSidebar,
  getServerAuthorityGroups,
  installGroupAuthorityForTests,
  renameAuthenticatedConversationGroup,
  resetServerConversationGroupStoreForTests,
} from '@/lib/eza/serverConversationGroupStore';
import {
  resetServerConversationStoreForTests,
  seedServerConversationIdForTests,
} from '@/lib/eza/serverConversationStore';
import {
  createStandaloneChat,
  getChatArchive,
  listChatArchives,
  replaceChatArchivesForScope,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const groupUuidMardin = '11111111-1111-4111-8111-111111111111';
const groupUuidJapan = '22222222-2222-4222-8222-222222222222';

function authAs(userId: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, `token-${userId}`);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ user_id: userId }));
}

function namedGroup(
  id: string,
  title: string,
  ownerId: string = userA
): ConversationGroup {
  return {
    id,
    userId: ownerId,
    guestToken: null,
    title,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
  };
}

function serverRow(id: string, title: string) {
  return {
    id,
    title,
    source: 'manual',
    parentGroupId: null,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clientGroupId: null,
  };
}

function makeChat(
  id: string,
  opts?: Partial<ArchivedChat> & { groupId?: string | null }
): ArchivedChat {
  return {
    id,
    title: opts?.title || id,
    preview: 'p',
    savedAt: opts?.savedAt || '2026-01-01T00:00:00.000Z',
    messageCount: 1,
    messages: [
      {
        id: `${id}-m1`,
        text: 'hi',
        isUser: true,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ],
    groupId: opts?.groupId ?? null,
    ...opts,
  };
}

describe('Phase 8.8G-5.3.2 server group authority', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerConversationGroupStoreForTests();
    resetServerConversationStoreForTests();
    authAs(userA);
    apiClientGet.mockReset();
    apiClientPost.mockReset();
    apiClientPatch.mockReset();
    apiClientDelete.mockReset();
  });

  it('1. authenticated bootstrap success non-empty → server tree', async () => {
    apiClientGet.mockResolvedValue({
      ok: true,
      data: [serverRow(groupUuidMardin, 'Mardin')],
    });
    const ok = await bootstrapServerConversationGroups(userA);
    expect(ok).toBe(true);
    expect(getGroupAuthorityPhase()).toBe('ready');
    const groups = getGroupsForAuthenticatedSidebar(userA);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe(groupUuidMardin);
    const tree = buildConversationTree(
      [makeChat('c1', { groupId: groupUuidMardin })],
      groups
    );
    expect(shouldUseConversationTreeMode(tree)).toBe(true);
    expect(tree.some((n) => n.id === groupUuidMardin)).toBe(true);
  });

  it('2. authenticated bootstrap success [] → date fallback', async () => {
    apiClientGet.mockResolvedValue({ ok: true, data: [] });
    await bootstrapServerConversationGroups(userA);
    expect(getGroupAuthorityPhase()).toBe('ready');
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    const tree = buildConversationTree(
      [makeChat('c1'), makeChat('c2')],
      getGroupsForAuthenticatedSidebar(userA)
    );
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
    expect(tree[0]?.id).toBe(UNGROUPED_CONVERSATION_GROUP_ID);
  });

  it('3. server [] overrides stale current-user local named groups', async () => {
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-local-mardin', 'Mardin'),
      namedGroup('group-local-japan', 'japonya'),
    ]);
    apiClientGet.mockResolvedValue({ ok: true, data: [] });
    await bootstrapServerConversationGroups(userA);
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    expect(peekScopedConversationGroupsForScope(userScope(userA))).toEqual([]);
  });

  it('4. server failure preserves safe current-user local cache', async () => {
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-local-mardin', 'Mardin'),
    ]);
    apiClientGet.mockResolvedValue({ ok: false, status: 500 });
    const ok = await bootstrapServerConversationGroups(userA);
    expect(ok).toBe(false);
    expect(getGroupAuthorityPhase()).toBe('failed');
    expect(getGroupsForAuthenticatedSidebar(userA).map((g) => g.title)).toEqual([
      'Mardin',
    ]);
  });

  it('5. loading does not install stale cross-owner groups', async () => {
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-a', 'A only', userA),
    ]);
    replaceConversationGroupsForScope(userScope(userB), [
      namedGroup('group-b', 'B only', userB),
    ]);
    let resolveList!: (v: unknown) => void;
    apiClientGet.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    const bootA = bootstrapServerConversationGroups(userA);
    expect(getGroupAuthorityPhase()).toBe('loading');
    // While A loading, B must not see A's authority or A's local via wrong owner.
    expect(getGroupsForAuthenticatedSidebar(userB)).toEqual([]);
    resolveList({ ok: true, data: [serverRow(groupUuidMardin, 'Mardin')] });
    await bootA;
    expect(getGroupsForAuthenticatedSidebar(userB)).toEqual([]);
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(groupUuidMardin);
  });

  it('6. account switch A→B isolation', async () => {
    apiClientGet.mockResolvedValueOnce({
      ok: true,
      data: [serverRow(groupUuidMardin, 'Mardin')],
    });
    await bootstrapServerConversationGroups(userA);
    authAs(userB);
    apiClientGet.mockResolvedValueOnce({
      ok: true,
      data: [serverRow(groupUuidJapan, 'japonya')],
    });
    await bootstrapServerConversationGroups(userB);
    expect(getActiveGroupOwnerForTests()).toBe(userB);
    expect(getGroupsForAuthenticatedSidebar(userB).map((g) => g.title)).toEqual([
      'japonya',
    ]);
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
  });

  it('7. delayed A response ignored after B switch', async () => {
    let resolveA!: (v: unknown) => void;
    apiClientGet.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveA = resolve;
        })
    );
    const bootA = bootstrapServerConversationGroups(userA);
    authAs(userB);
    apiClientGet.mockResolvedValueOnce({
      ok: true,
      data: [serverRow(groupUuidJapan, 'japonya')],
    });
    await bootstrapServerConversationGroups(userB);
    resolveA({ ok: true, data: [serverRow(groupUuidMardin, 'Mardin')] });
    await bootA;
    expect(getActiveGroupOwnerForTests()).toBe(userB);
    expect(getGroupAuthorityPhase()).toBe('ready');
    expect(getServerAuthorityGroups().map((g) => g.id)).toEqual([groupUuidJapan]);
    expect(getGroupsForAuthenticatedSidebar(userB)[0]?.id).toBe(groupUuidJapan);
  });

  it('8. authenticated create returns server UUID and updates state', async () => {
    installGroupAuthorityForTests(userA, [], 'ready');
    apiClientPost.mockResolvedValue({
      ok: true,
      data: serverRow(groupUuidMardin, 'Yeni grup'),
    });
    const created = await createAuthenticatedConversationGroup({
      title: 'Yeni grup',
      source: 'manual',
    });
    expect(created.id).toBe(groupUuidMardin);
    expect(created.id.startsWith('group-')).toBe(false);
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(groupUuidMardin);
  });

  it('9. authenticated rename updates server-backed state', async () => {
    installGroupAuthorityForTests(
      userA,
      [namedGroup(groupUuidMardin, 'Old')],
      'ready'
    );
    apiClientPatch.mockResolvedValue({
      ok: true,
      data: serverRow(groupUuidMardin, 'Renamed'),
    });
    const updated = await renameAuthenticatedConversationGroup(
      groupUuidMardin,
      'Renamed'
    );
    expect(updated.title).toBe('Renamed');
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.title).toBe('Renamed');
  });

  it('10. authenticated delete removes group but keeps conversations visible ungrouped', async () => {
    installGroupAuthorityForTests(
      userA,
      [namedGroup(groupUuidMardin, 'Mardin')],
      'ready'
    );
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('c1', { groupId: groupUuidMardin }),
    ]);
    apiClientDelete.mockResolvedValue({ ok: true });
    await deleteAuthenticatedConversationGroup(groupUuidMardin);
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    expect(getChatArchive('c1')?.groupId).toBeNull();
    const tree = buildConversationTree(listChatArchives(), []);
    expect(tree.some((n) => n.conversations.some((c) => c.id === 'c1'))).toBe(true);
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
  });

  it('11. authenticated assign conversation updates groupId', async () => {
    installGroupAuthorityForTests(
      userA,
      [namedGroup(groupUuidMardin, 'Mardin')],
      'ready'
    );
    replaceChatArchivesForScope(userScope(userA), [makeChat('c1', { groupId: null })]);
    seedServerConversationIdForTests('c1', 'srv-c1');
    apiClientPatch.mockResolvedValue({ ok: true, data: {} });
    await assignAuthenticatedConversationGroup('c1', groupUuidMardin);
    expect(getChatArchive('c1')?.groupId).toBe(groupUuidMardin);
    expect(apiClientPatch).toHaveBeenCalledWith(
      '/api/standalone/conversations/srv-c1',
      expect.objectContaining({ body: { groupId: groupUuidMardin } })
    );
  });

  it('12. authenticated ungroup sets null', async () => {
    installGroupAuthorityForTests(
      userA,
      [namedGroup(groupUuidMardin, 'Mardin')],
      'ready'
    );
    replaceChatArchivesForScope(userScope(userA), [
      makeChat('c1', { groupId: groupUuidMardin }),
    ]);
    seedServerConversationIdForTests('c1', 'srv-c1');
    apiClientPatch.mockResolvedValue({ ok: true, data: {} });
    await assignAuthenticatedConversationGroup('c1', null);
    expect(getChatArchive('c1')?.groupId).toBeNull();
    expect(apiClientPatch).toHaveBeenCalledWith(
      '/api/standalone/conversations/srv-c1',
      expect.objectContaining({ body: { groupId: null } })
    );
  });

  it('13. unknown server groupId on conversation → visible ungrouped', () => {
    const unknown = '99999999-9999-4999-8999-999999999999';
    const groups = [namedGroup(groupUuidMardin, 'Mardin')];
    const tree = buildConversationTree(
      [makeChat('orphan', { groupId: unknown })],
      groups
    );
    const ungrouped = tree.find((n) => n.id === UNGROUPED_CONVERSATION_GROUP_ID);
    expect(ungrouped?.conversations.some((c) => c.id === 'orphan')).toBe(true);
    expect(tree.some((n) => n.id === unknown)).toBe(false);
  });

  it('14. synthetic __ungrouped__ alone → date mode', () => {
    const tree = buildConversationTree([makeChat('a'), makeChat('b')], []);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe(UNGROUPED_CONVERSATION_GROUP_ID);
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
  });

  it('15. guest group behavior unchanged/local', () => {
    clearServerConversationGroupState();
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    const g = createConversationGroup({ title: 'Guest Trip', source: 'manual' });
    expect(g.id.startsWith('group-')).toBe(true);
    expect(listConversationGroups().some((x) => x.id === g.id)).toBe(true);
  });

  it('16. flat legacy group key not promoted to auth authority', async () => {
    localStorage.setItem(
      GROUPS_STORAGE_KEY,
      JSON.stringify([namedGroup('group-flat', 'Flat Legacy')])
    );
    apiClientGet.mockResolvedValue({ ok: false, status: 500 });
    await bootstrapServerConversationGroups(userA);
    expect(getGroupAuthorityPhase()).toBe('failed');
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    expect(peekScopedConversationGroupsForScope(userScope(userA))).toEqual([]);
  });

  it('17. bad group API response → failed/degraded, not ready-empty', async () => {
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-local', 'Cache'),
    ]);
    apiClientGet.mockResolvedValue({ ok: true, data: { not: 'array' } });
    const ok = await bootstrapServerConversationGroups(userA);
    expect(ok).toBe(false);
    expect(getGroupAuthorityPhase()).toBe('failed');
    expect(getGroupsForAuthenticatedSidebar(userA).map((g) => g.title)).toEqual([
      'Cache',
    ]);
  });

  it('18. 401/403/network → failed/degraded', async () => {
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-local', 'Keep'),
    ]);
    apiClientGet.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await bootstrapServerConversationGroups(userA)).toBe(false);
    expect(getGroupAuthorityPhase()).toBe('failed');

    resetServerConversationGroupStoreForTests();
    authAs(userA);
    replaceConversationGroupsForScope(userScope(userA), [
      namedGroup('group-local', 'Keep'),
    ]);
    apiClientGet.mockRejectedValueOnce(new Error('network'));
    expect(await bootstrapServerConversationGroups(userA)).toBe(false);
    expect(getGroupAuthorityPhase()).toBe('failed');
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.title).toBe('Keep');
  });

  it('rename failure does not mutate local authority', async () => {
    installGroupAuthorityForTests(
      userA,
      [namedGroup(groupUuidMardin, 'Keep')],
      'ready'
    );
    apiClientPatch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      renameAuthenticatedConversationGroup(groupUuidMardin, 'Nope')
    ).rejects.toThrow();
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.title).toBe('Keep');
  });

  it('guest delete clears membership so chat stays visible', () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    const g = createConversationGroup({ title: 'Temp', source: 'manual' });
    const chatId = createStandaloneChat({ title: 'In group', groupId: g.id });
    deleteConversationGroup(g.id);
    expect(listConversationGroups().find((x) => x.id === g.id)).toBeUndefined();
    expect(getChatArchive(chatId)?.groupId).toBeNull();
  });
});
