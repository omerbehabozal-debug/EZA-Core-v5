/**
 * Fetch-level normalization for conversation-group DELETE.
 * Exercises real apiClient.request (not a mocked apiClient.delete).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/apiClient';
import { deleteServerConversationGroup } from '@/lib/eza/serverConversationGroupsApi';
import {
  deleteAuthenticatedConversationGroup,
  getGroupsForAuthenticatedSidebar,
  getServerAuthorityGroups,
  installGroupAuthorityForTests,
  resetServerConversationGroupStoreForTests,
} from '@/lib/eza/serverConversationGroupStore';
import { peekScopedConversationGroupsForScope } from '@/lib/eza/conversation-tree/conversationGroups';
import { TOKEN_STORAGE_KEY, userScope } from '@/lib/eza/localIdentityScope';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const staleUuid = '0d5c367a-46ba-4875-a38b-621c8aa9da40';
const deletePath = `/api/conversation-groups/${staleUuid}`;

function namedGroup(id: string, title: string): ConversationGroup {
  return {
    id,
    userId: userA,
    guestToken: null,
    title,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  contentType = 'application/json'
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  });
}

describe('apiClient DELETE normalization → group delete reconcile', () => {
  const fetchMock = vi.fn();

  function mockFetchJson(
    status: number,
    body: unknown,
    contentType = 'application/json'
  ) {
    // Fresh Response per call — body streams are single-use.
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(status, body, contentType))
    );
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token');
    resetServerConversationGroupStoreForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ideal FastAPI 404 conversation_group_not_found → already_absent + prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Ghost')], 'ready');
    mockFetchJson(404, { detail: { code: 'conversation_group_not_found' } });

    const normalized = await apiClient.delete(deletePath, { auth: true });
    expect(normalized.ok).toBe(false);
    expect(normalized.status).toBe(404);
    expect(normalized.error?.error_code).toBe('conversation_group_not_found');
    expect(
      normalized.detail &&
        typeof normalized.detail === 'object' &&
        (normalized.detail as { code?: string }).code
    ).toBe('conversation_group_not_found');

    await expect(deleteServerConversationGroup(staleUuid)).resolves.toBe('already_absent');

    await deleteAuthenticatedConversationGroup(staleUuid);

    expect(getServerAuthorityGroups().find((g) => g.id === staleUuid)).toBeUndefined();
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    expect(peekScopedConversationGroupsForScope(userScope(userA))).toEqual([]);
  });

  it('accepts application/json; charset=utf-8 for semantic 404', async () => {
    mockFetchJson(
      404,
      { detail: { code: 'conversation_group_not_found' } },
      'application/json; charset=utf-8'
    );
    const normalized = await apiClient.delete(deletePath, { auth: true });
    expect(normalized.status).toBe(404);
    expect(normalized.error?.error_code).toBe('conversation_group_not_found');
    await expect(deleteServerConversationGroup(staleUuid)).resolves.toBe('already_absent');
  });

  it('A: 404 string detail Not Found → NO prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Keep')], 'ready');
    mockFetchJson(404, { detail: 'Not Found' });

    const normalized = await apiClient.delete(deletePath, { auth: true });
    expect(normalized.status).toBe(404);
    expect(normalized.error?.error_code).not.toBe('conversation_group_not_found');
    expect(normalized.error?.error_code).toBe('HTTP_404');

    await expect(deleteServerConversationGroup(staleUuid)).rejects.toThrow(
      'conversation_group_delete_failed'
    );
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(staleUuid);
  });

  it('B: 404 text/html → INVALID_RESPONSE, NO prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Keep')], 'ready');
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response('<html>404</html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        })
      )
    );

    const normalized = await apiClient.delete(deletePath, { auth: true });
    expect(normalized.status).toBe(404);
    expect(normalized.error?.error_code).toBe('INVALID_RESPONSE');

    await expect(deleteServerConversationGroup(staleUuid)).rejects.toThrow(
      'conversation_group_delete_failed'
    );
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(staleUuid);
  });

  it('C: 404 JSON unrelated code → NO prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Keep')], 'ready');
    mockFetchJson(404, { detail: { code: 'other_not_found' } });

    await expect(deleteServerConversationGroup(staleUuid)).rejects.toThrow(
      'conversation_group_delete_failed'
    );
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(staleUuid);
  });

  it('D: 500 JSON → NO prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Keep')], 'ready');
    mockFetchJson(500, { detail: { code: 'conversation_group_not_found' } });

    // Semantic code alone must not prune when status is not 404.
    await expect(deleteServerConversationGroup(staleUuid)).rejects.toThrow(
      'conversation_group_delete_failed'
    );
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(staleUuid);
  });

  it('E: 401 → NO prune', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Keep')], 'ready');
    mockFetchJson(401, { detail: 'Authentication required' });

    await expect(deleteServerConversationGroup(staleUuid)).rejects.toThrow(
      'conversation_group_delete_failed'
    );
    expect(getGroupsForAuthenticatedSidebar(userA)[0]?.id).toBe(staleUuid);
  });

  it('temporary diagnostic logs status/errorCode/detail without secrets', async () => {
    const warn = vi.mocked(console.warn);
    mockFetchJson(404, { detail: { code: 'conversation_group_not_found' } });
    await deleteServerConversationGroup(staleUuid);
    expect(warn).toHaveBeenCalledWith(
      '[conversation-group-delete]',
      expect.objectContaining({
        groupId: staleUuid,
        status: 404,
        errorCode: 'conversation_group_not_found',
        detail: { code: 'conversation_group_not_found' },
      })
    );
    const logged = warn.mock.calls.find((c) => c[0] === '[conversation-group-delete]')?.[1] as
      | Record<string, unknown>
      | undefined;
    expect(logged).toBeDefined();
    expect(logged).not.toHaveProperty('token');
    expect(logged).not.toHaveProperty('Authorization');
    expect(logged).not.toHaveProperty('headers');
  });

  it('DELETE 204 empty body (FastAPI No Content) → ok + already reconciles as deleted', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(staleUuid, 'Empty')], 'ready');
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(null, {
          status: 204,
          // FastAPI Response() often omits Content-Type for empty body
          headers: {},
        })
      )
    );

    const normalized = await apiClient.delete(deletePath, { auth: true });
    expect(normalized.ok).toBe(true);
    expect(normalized.status).toBe(204);

    await expect(deleteServerConversationGroup(staleUuid)).resolves.toBe('deleted');
    await deleteAuthenticatedConversationGroup(staleUuid);

    expect(getServerAuthorityGroups().find((g) => g.id === staleUuid)).toBeUndefined();
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
  });
});
