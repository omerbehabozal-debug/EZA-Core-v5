/**
 * Same-tab delete sync — mounted harnesses (no remount/reload).
 *
 * Production bug: FastAPI DELETE 204 No Content was treated as INVALID_RESPONSE,
 * so store reconcile / canvas leave never ran until full page refresh.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  deleteRenderedConversationGroup,
} from '@/lib/eza/conversation-tree/deleteRenderedConversationGroup';
import {
  GROUPS_UPDATED_EVENT,
  peekScopedConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { TOKEN_STORAGE_KEY, userScope } from '@/lib/eza/localIdentityScope';
import {
  getGroupsForAuthenticatedSidebar,
  installGroupAuthorityForTests,
  resetServerConversationGroupStoreForTests,
  subscribeServerConversationGroups,
} from '@/lib/eza/serverConversationGroupStore';
import {
  deleteServerBackedConversation,
  getServerConversationSummaries,
  resetServerConversationStoreForTests,
  seedServerConversationIdForTests,
  beginAccountSession,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';
import {
  CHATS_UPDATED_EVENT,
  deleteChatArchive,
  getChatArchive,
  upsertChatArchive,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';
import { isChatDeleted } from '@/lib/standaloneChatDelete';
import { isConversationActiveForDelete } from '@/lib/eza/activeConversationDelete';
import { SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';

const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CHAT_A = 'chat-a-same-tab';
const SERVER_A = 'srv-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROUP_G = '0d5c367a-46ba-4875-a38b-621c8aa9da40';
const MESSAGE_A = 'same-tab seeded message';
const TITLE_A = 'Akşam Rotası';

function mock204Delete() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        // undici/Fetch forbids a body with 204 — use null like FastAPI empty Response.
        new Response(null, {
          status: 204,
          headers: {},
        })
      )
    )
  );
}

function seedLocalChat() {
  const now = new Date().toISOString();
  upsertChatArchive({
    id: CHAT_A,
    title: TITLE_A,
    preview: MESSAGE_A,
    savedAt: now,
    messageCount: 1,
    messages: [{ id: `${CHAT_A}-m1`, text: MESSAGE_A, isUser: true, timestamp: now }],
    serverConversationId: SERVER_A,
  });
  writeActiveChatId(CHAT_A);
}

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

/**
 * Mirrors StandaloneChatInner.executeDeleteChat same-tab path:
 * server delete → on failure abort (no leave) → on success local purge + leave.
 */
function ActiveConversationDeleteHarness() {
  const [chatId, setChatId] = useState<string | null>(CHAT_A);
  const [messages, setMessages] = useState<string[]>([MESSAGE_A]);
  const [title, setTitle] = useState(TITLE_A);
  const [sceneUrl, setSceneUrl] = useState('https://cdn.example.com/a.png');
  const [route, setRoute] = useState(`/standalone?chat=${CHAT_A}`);
  const [listTick, setListTick] = useState(0);

  const leave = () => {
    setChatId(null);
    setMessages([]);
    setTitle('');
    setSceneUrl('');
    setRoute(SAINA_NEW_CHAT_ROUTE);
  };

  useEffect(() => {
    const bump = () => setListTick((n) => n + 1);
    window.addEventListener(CHATS_UPDATED_EVENT, bump);
    const unsub = subscribeServerConversations(bump);
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, bump);
      unsub();
    };
  }, []);

  return (
    <div>
      <div data-testid="messages">{messages.join('|')}</div>
      <div data-testid="title">{title}</div>
      <div data-testid="active-id">{chatId ?? ''}</div>
      <div data-testid="scene">{sceneUrl}</div>
      <div data-testid="route">{route}</div>
      <div data-testid="sidebar-count">{getServerConversationSummaries().length}</div>
      <div data-testid="list-tick">{listTick}</div>
      <div data-testid="tombstone">{isChatDeleted(CHAT_A) ? 'yes' : 'no'}</div>
      <button
        type="button"
        data-testid="delete-active"
        onClick={() => {
          void (async () => {
            const wasActive = isConversationActiveForDelete({
              targetId: CHAT_A,
              chatId,
              chatIdFromUrl: CHAT_A,
              activeChatId: CHAT_A,
            });
            try {
              await deleteServerBackedConversation(CHAT_A);
            } catch {
              // Production StandaloneChatInner: abort before leave/purge.
              return;
            }
            deleteChatArchive(CHAT_A);
            if (wasActive) leave();
          })();
        }}
      >
        Sil
      </button>
    </div>
  );
}

/**
 * Persistent chrome/sidebar chain: authority store → subscribe → sidebar list.
 * No remount after delete.
 */
function PersistentGroupSidebarHarness() {
  const [groups, setGroups] = useState(() => getGroupsForAuthenticatedSidebar(userA));

  useEffect(() => {
    const refresh = () => setGroups(getGroupsForAuthenticatedSidebar(userA));
    window.addEventListener(GROUPS_UPDATED_EVENT, refresh);
    const unsub = subscribeServerConversationGroups(refresh);
    refresh();
    return () => {
      window.removeEventListener(GROUPS_UPDATED_EVENT, refresh);
      unsub();
    };
  }, []);

  return (
    <div>
      <ul data-testid="sidebar-groups">
        {groups.map((g) => (
          <li key={g.id} data-testid={`group-${g.id}`}>
            {g.title}
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="delete-group"
        onClick={() => {
          void (async () => {
            await deleteRenderedConversationGroup({
              id: GROUP_G,
              title: 'Ghost Empty',
              source: 'manual',
              clientGroupId: null,
              conversationCount: 0,
            });
          })();
        }}
      >
        Grubu sil
      </button>
    </div>
  );
}

describe('same-tab delete sync (mounted, no reload)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token');
    resetServerConversationStoreForTests();
    resetServerConversationGroupStoreForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('TEST1: active conversation DELETE 204 clears canvas without remount', async () => {
    seedLocalChat();
    beginAccountSession(userA);
    seedServerConversationIdForTests(CHAT_A, SERVER_A);
    mock204Delete();

    render(<ActiveConversationDeleteHarness />);
    expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);
    expect(screen.getByTestId('active-id')).toHaveTextContent(CHAT_A);

    fireEvent.click(screen.getByTestId('delete-active'));

    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('');
      expect(screen.getByTestId('active-id')).toHaveTextContent('');
      expect(screen.getByTestId('title')).toHaveTextContent('');
      expect(screen.getByTestId('scene')).toHaveTextContent('');
      expect(screen.getByTestId('route')).toHaveTextContent(SAINA_NEW_CHAT_ROUTE);
      expect(screen.getByTestId('tombstone')).toHaveTextContent('yes');
    });
    expect(getChatArchive(CHAT_A)).toBeNull();
  });

  it('TEST2: empty group DELETE 204 removes sidebar row without remount', async () => {
    installGroupAuthorityForTests(userA, [namedGroup(GROUP_G, 'Ghost Empty')], 'ready');
    mock204Delete();

    render(<PersistentGroupSidebarHarness />);
    expect(screen.getByTestId(`group-${GROUP_G}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-group'));

    await waitFor(() => {
      expect(screen.queryByTestId(`group-${GROUP_G}`)).not.toBeInTheDocument();
    });
    expect(getGroupsForAuthenticatedSidebar(userA)).toEqual([]);
    expect(peekScopedConversationGroupsForScope(userScope(userA))).toEqual([]);
  });

  it('apiClient: bare 204 No Content is success (not INVALID_RESPONSE)', async () => {
    mock204Delete();
    const res = await apiClient.delete(`/api/conversation-groups/${GROUP_G}`, { auth: true });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(204);
    expect(res.error?.error_code).not.toBe('INVALID_RESPONSE');
  });
});
