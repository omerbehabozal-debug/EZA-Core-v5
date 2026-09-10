/**
 * Active delete invariants — harness + unit + ChatInner wiring tests.
 *
 * Full StandaloneChatInner mount currently OOMs under jsdom (archive refresh /
 * plan mock identity churn). These tests still prove the accepted production
 * gaps with a mounted canvas/sidebar harness, then assert ChatInner wires the
 * same invariants.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect, useState } from 'react';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', () => apiMocks);

import {
  isConversationActiveForDelete,
  isRenderedConversationAuthoritativelyGone,
} from '@/lib/eza/activeConversationDelete';
import {
  CHATS_UPDATED_EVENT,
  deleteChatArchive,
  upsertChatArchive,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';
import { isChatDeleted, markChatDeleted } from '@/lib/standaloneChatDelete';
import { SAINA_NEW_CHAT_ROUTE, isSainaNewChatRequest } from '@/lib/eza/sainaRoutes';
import {
  beginAccountSession,
  bootstrapServerConversations,
  hasCompleteServerAuthoritySnapshot,
  resetServerConversationStoreForTests,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';

const CHAT_A = 'chat-a';
const CHAT_B = 'chat-b';
const MESSAGE_A = 'chat-a seeded user message';
const TITLE_A = 'Akşam Rotası';
const USER_A = 'user-a-1111-1111-1111-111111111111';

const chatInnerSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
  'utf8'
);

const summaryA = {
  id: 'srv-a',
  clientConversationId: CHAT_A,
  title: TITLE_A,
  preview: MESSAGE_A,
  conversationType: 'direct' as const,
  messageCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastMessageAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function seedChat(id: string, title: string, text: string) {
  const now = new Date().toISOString();
  upsertChatArchive({
    id,
    title,
    preview: text,
    savedAt: now,
    messageCount: 1,
    messages: [{ id: `${id}-m1`, text, isUser: true, timestamp: now }],
  });
}

/**
 * Canvas owner. Without enableRenderOwnerInvariant it only updates the list
 * store on Sil (production bug). With the flag it leaves on CHATS_UPDATED when
 * the rendered id is authoritatively gone.
 */
function DeleteCanvasHarness({
  enableRenderOwnerInvariant,
  enableNewChatInvariant,
}: {
  enableRenderOwnerInvariant: boolean;
  enableNewChatInvariant?: boolean;
}) {
  const [search, setSearch] = useState(`chat=${CHAT_A}`);
  const [chatId, setChatId] = useState<string | null>(CHAT_A);
  const [messages, setMessages] = useState<string[]>([MESSAGE_A]);
  const [title, setTitle] = useState(TITLE_A);
  const [sceneUrl, setSceneUrl] = useState('https://cdn.example.com/a.png');
  const [mirrorPending, setMirrorPending] = useState(false);
  const [, setListTick] = useState(0);

  const leave = () => {
    setChatId(null);
    setMessages([]);
    setTitle('Yeni Sohbet');
    setSceneUrl('');
    setMirrorPending(true);
    setSearch('new=1');
  };

  useEffect(() => {
    const bump = () => setListTick((n) => n + 1);
    window.addEventListener(CHATS_UPDATED_EVENT, bump);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!enableRenderOwnerInvariant) return;
    const onUpdate = () => {
      if (
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: chatId,
          isServerBacked: false,
        })
      ) {
        leave();
      }
    };
    window.addEventListener(CHATS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, onUpdate);
  }, [enableRenderOwnerInvariant, chatId]);

  useEffect(() => {
    if (!enableNewChatInvariant) return;
    if (!isSainaNewChatRequest(search)) return;
    if (!chatId && messages.length === 0) return;
    leave();
  }, [enableNewChatInvariant, search, chatId, messages.length]);

  return (
    <div>
      <ul data-testid="sidebar">
        {!isChatDeleted(CHAT_A) ? <li data-testid="sidebar-chat-a">{TITLE_A}</li> : null}
        {!isChatDeleted(CHAT_B) ? <li data-testid="sidebar-chat-b">Diğer</li> : null}
      </ul>
      <h1>{title}</h1>
      <div data-testid="messages">{messages.join('|')}</div>
      <div data-testid="active-id">{chatId ?? ''}</div>
      <div data-testid="scene">{sceneUrl}</div>
      <div data-testid="mirror">{mirrorPending ? 'pending' : 'live'}</div>
      <div data-testid="route">
        {search.includes('new=1') ? SAINA_NEW_CHAT_ROUTE : `/standalone?${search}`}
      </div>
      <button
        type="button"
        data-testid="delete-a"
        onClick={() => {
          deleteChatArchive(CHAT_A);
        }}
      >
        Sil A
      </button>
      <button
        type="button"
        data-testid="delete-b"
        onClick={() => {
          deleteChatArchive(CHAT_B);
        }}
      >
        Sil B
      </button>
      <button type="button" data-testid="goto-new" onClick={() => setSearch('new=1')}>
        New
      </button>
    </div>
  );
}

/**
 * Auth/server-backed canvas: hydrated from detail (no local archive) while
 * list bootstrap may still be pending — mirrors deep-link race.
 */
function AuthServerCanvasHarness() {
  const [search, setSearch] = useState(`chat=${CHAT_A}`);
  const [chatId, setChatId] = useState<string | null>(CHAT_A);
  const [messages, setMessages] = useState<string[]>([MESSAGE_A]);
  const [title, setTitle] = useState(TITLE_A);

  const leave = () => {
    setChatId(null);
    setMessages([]);
    setTitle('Yeni Sohbet');
    setSearch('new=1');
  };

  useEffect(() => {
    const leaveIfGone = () => {
      if (
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: chatId,
          isServerBacked: true,
        })
      ) {
        leave();
      }
    };
    leaveIfGone();
    window.addEventListener(CHATS_UPDATED_EVENT, leaveIfGone);
    const unsub = subscribeServerConversations(leaveIfGone);
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, leaveIfGone);
      unsub();
    };
  }, [chatId]);

  return (
    <div>
      <h1>{title}</h1>
      <div data-testid="messages">{messages.join('|')}</div>
      <div data-testid="active-id">{chatId ?? ''}</div>
      <div data-testid="route">
        {search.includes('new=1') ? SAINA_NEW_CHAT_ROUTE : `/standalone?${search}`}
      </div>
    </div>
  );
}

async function expectLeftToNewChat() {
  await waitFor(() => {
    expect(screen.queryByTestId('sidebar-chat-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('messages')).toHaveTextContent('');
    expect(screen.getByTestId('active-id')).toHaveTextContent('');
    expect(screen.getByRole('heading')).toHaveTextContent('Yeni Sohbet');
    expect(screen.getByTestId('scene')).toHaveTextContent('');
    expect(screen.getByTestId('mirror')).toHaveTextContent('pending');
    expect(screen.getByTestId('route')).toHaveTextContent(SAINA_NEW_CHAT_ROUTE);
  });
}

describe('active conversation delete invariants', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('unit: isRenderedConversationAuthoritativelyGone', () => {
    it('A: tombstone => gone', () => {
      seedChat(CHAT_A, TITLE_A, MESSAGE_A);
      expect(
        isRenderedConversationAuthoritativelyGone({ renderedChatId: CHAT_A })
      ).toBe(false);
      markChatDeleted(CHAT_A);
      expect(
        isRenderedConversationAuthoritativelyGone({ renderedChatId: CHAT_A })
      ).toBe(true);
      expect(
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: CHAT_A,
          isServerBacked: true,
        })
      ).toBe(true);
    });

    it('B: guest local missing => gone', () => {
      expect(
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: CHAT_A,
          isServerBacked: false,
        })
      ).toBe(true);
    });

    it('C: auth server snapshot NOT ready + local/server missing => NOT gone', () => {
      beginAccountSession(USER_A);
      expect(hasCompleteServerAuthoritySnapshot()).toBe(false);
      expect(
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: CHAT_A,
          isServerBacked: true,
        })
      ).toBe(false);
    });

    it('D: auth snapshot ready + local/server missing => gone', async () => {
      apiMocks.listServerConversations.mockResolvedValueOnce([]);
      await bootstrapServerConversations(USER_A);
      expect(hasCompleteServerAuthoritySnapshot()).toBe(true);
      expect(
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: CHAT_A,
          isServerBacked: true,
        })
      ).toBe(true);
    });

    it('E: auth snapshot ready + server contains id => NOT gone', async () => {
      apiMocks.listServerConversations.mockResolvedValueOnce([summaryA]);
      await bootstrapServerConversations(USER_A);
      expect(hasCompleteServerAuthoritySnapshot()).toBe(true);
      expect(
        isRenderedConversationAuthoritativelyGone({
          renderedChatId: CHAT_A,
          isServerBacked: true,
        })
      ).toBe(false);
    });
  });

  describe('mounted harness — desired leave behavior', () => {
    it.fails(
      'without render-owner invariant, Sil → store purge should clear canvas (documents gap)',
      async () => {
        seedChat(CHAT_A, TITLE_A, MESSAGE_A);
        writeActiveChatId(CHAT_A);
        render(<DeleteCanvasHarness enableRenderOwnerInvariant={false} />);

        expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);
        fireEvent.click(screen.getByTestId('delete-a'));
        await expectLeftToNewChat();
      }
    );

    it('with render-owner invariant, Sil → store purge clears canvas', async () => {
      seedChat(CHAT_A, TITLE_A, MESSAGE_A);
      writeActiveChatId(CHAT_A);
      render(<DeleteCanvasHarness enableRenderOwnerInvariant />);

      fireEvent.click(screen.getByTestId('delete-a'));
      await expectLeftToNewChat();
    });

    it('non-active delete does not clear the open canvas', async () => {
      seedChat(CHAT_A, TITLE_A, MESSAGE_A);
      seedChat(CHAT_B, 'Diğer', 'b');
      writeActiveChatId(CHAT_A);
      render(<DeleteCanvasHarness enableRenderOwnerInvariant />);

      fireEvent.click(screen.getByTestId('delete-b'));

      await waitFor(() => {
        expect(screen.queryByTestId('sidebar-chat-b')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);
      expect(screen.getByTestId('active-id')).toHaveTextContent(CHAT_A);
      expect(screen.getByRole('heading')).toHaveTextContent(TITLE_A);
    });

    it.fails(
      'without ?new=1 invariant, soft-nav should clear mounted chat (documents gap)',
      async () => {
        seedChat(CHAT_A, TITLE_A, MESSAGE_A);
        render(
          <DeleteCanvasHarness
            enableRenderOwnerInvariant={false}
            enableNewChatInvariant={false}
          />
        );

        fireEvent.click(screen.getByTestId('goto-new'));
        await waitFor(() => {
          expect(screen.getByTestId('messages')).toHaveTextContent('');
          expect(screen.getByTestId('active-id')).toHaveTextContent('');
        });
      }
    );

    it('with ?new=1 invariant, soft-nav clears mounted chat', async () => {
      seedChat(CHAT_A, TITLE_A, MESSAGE_A);
      render(
        <DeleteCanvasHarness
          enableRenderOwnerInvariant={false}
          enableNewChatInvariant
        />
      );

      fireEvent.click(screen.getByTestId('goto-new'));
      await waitFor(() => {
        expect(screen.getByTestId('messages')).toHaveTextContent('');
        expect(screen.getByTestId('active-id')).toHaveTextContent('');
        expect(screen.getByRole('heading')).toHaveTextContent('Yeni Sohbet');
      });
    });
  });

  describe('auth deep-link + server authority gate', () => {
    it('F: deep-link hydrated canvas + server bootstrap pending => canvas korunur', async () => {
      const list = deferred<typeof summaryA[]>();
      apiMocks.listServerConversations.mockImplementationOnce(() => list.promise);

      const pending = bootstrapServerConversations(USER_A);
      expect(hasCompleteServerAuthoritySnapshot()).toBe(false);

      // No local archive — detail hydrate only (canvas already filled).
      render(<AuthServerCanvasHarness />);

      expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);
      expect(screen.getByTestId('active-id')).toHaveTextContent(CHAT_A);
      expect(screen.getByRole('heading')).toHaveTextContent(TITLE_A);

      // Still pending: must not leave.
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);
      expect(screen.getByTestId('active-id')).toHaveTextContent(CHAT_A);

      list.resolve([summaryA]);
      await pending;
      expect(hasCompleteServerAuthoritySnapshot()).toBe(true);
      expect(screen.getByTestId('active-id')).toHaveTextContent(CHAT_A);
    });

    it('G: bootstrap ready + authoritative absence => canvas leave eder', async () => {
      const list = deferred<typeof summaryA[]>();
      apiMocks.listServerConversations.mockImplementationOnce(() => list.promise);

      const pending = bootstrapServerConversations(USER_A);
      render(<AuthServerCanvasHarness />);

      expect(screen.getByTestId('messages')).toHaveTextContent(MESSAGE_A);

      list.resolve([]);
      await pending;
      expect(hasCompleteServerAuthoritySnapshot()).toBe(true);

      await waitFor(() => {
        expect(screen.getByTestId('messages')).toHaveTextContent('');
        expect(screen.getByTestId('active-id')).toHaveTextContent('');
        expect(screen.getByRole('heading')).toHaveTextContent('Yeni Sohbet');
        expect(screen.getByTestId('route')).toHaveTextContent(SAINA_NEW_CHAT_ROUTE);
      });
    });
  });

  describe('StandaloneChatInner wiring', () => {
    it('wires render-owner leave on CHATS_UPDATED / server subscribe', () => {
      expect(chatInnerSrc).toContain('isRenderedConversationAuthoritativelyGone');
      expect(chatInnerSrc).toContain('subscribeServerConversations');
      expect(chatInnerSrc).toContain('leaveActiveConversationAfterDelete');
      expect(chatInnerSrc).toContain('Render-owner deletion invariant');
    });

    it('wires mounted ?new=1 clear via startDraft', () => {
      expect(chatInnerSrc).toContain('Mounted ?new=1 invariant');
      expect(chatInnerSrc).toMatch(/isSainaNewChatRequest[\s\S]*startDraft\(null\)/);
    });

    it('keeps wasActive helper for sidebar callback path', () => {
      expect(isConversationActiveForDelete({ targetId: 'x', chatId: 'x' })).toBe(true);
      expect(chatInnerSrc).toContain('isConversationActiveForDelete');
    });
  });
});
