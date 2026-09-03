import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canApplySessionBoundResult,
  canPersistOwnerBoundAutosave,
  resolveAuthOwnerKey,
  shouldInvalidateAuthenticatedChatSession,
} from '@/lib/eza/authenticatedChatOwnerGuard';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', () => apiMocks);

import {
  bootstrapServerConversations,
  clearServerConversationState,
  fetchServerConversationDetail,
  getServerConversationSummaries,
  persistServerConversationTitleIfNeeded,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type SimulatedChatSession = {
  authOwner: string | null | undefined;
  persistEpoch: number;
  sessionGeneration: number;
  loadGeneration: number;
  activeLoadTarget: string | null;
  skipAutosave: boolean;
  chatId: string | null;
  messages: Array<{ id: string; text: string; isUser: boolean }>;
  loading: boolean;
  typing: boolean;
  appliedStreamChunks: string[];
  archivesWritten: Array<{ owner: string | null; chatId: string; text: string }>;
};

function createSession(owner: string | null): SimulatedChatSession {
  return {
    authOwner: owner,
    persistEpoch: 0,
    sessionGeneration: 0,
    loadGeneration: 0,
    activeLoadTarget: null,
    skipAutosave: false,
    chatId: null,
    messages: [],
    loading: false,
    typing: false,
    appliedStreamChunks: [],
    archivesWritten: [],
  };
}

/** Mirrors StandaloneChatInner owner-invalidation order. */
function invalidateOnOwnerChange(
  session: SimulatedChatSession,
  nextOwner: string | null
): void {
  const previous = session.authOwner;
  if (!shouldInvalidateAuthenticatedChatSession(previous, nextOwner)) {
    session.authOwner = nextOwner;
    return;
  }
  session.skipAutosave = true;
  session.persistEpoch += 1;
  session.sessionGeneration += 1;
  session.loadGeneration += 1;
  session.activeLoadTarget = null;
  session.authOwner = nextOwner;
  session.chatId = null;
  session.messages = [];
  session.loading = false;
  session.typing = false;
}

function flushSave(
  session: SimulatedChatSession,
  chatId: string,
  messages: SimulatedChatSession['messages'],
  epochAtSchedule: number,
  boundOwner: string | null | undefined
): void {
  if (
    !canPersistOwnerBoundAutosave({
      skipAutosave: session.skipAutosave,
      persistEpochAtSchedule: epochAtSchedule,
      persistEpochNow: session.persistEpoch,
      boundOwner,
      ownerNow: session.authOwner,
    })
  ) {
    return;
  }
  session.archivesWritten.push({
    owner: session.authOwner ?? null,
    chatId,
    text: messages.map((m) => m.text).join('|'),
  });
}

describe('Phase 8.8G-2.2 auth owner resolution', () => {
  it('does not treat auth hydration as logout', () => {
    expect(
      resolveAuthOwnerKey({
        isAuthReady: false,
        isAuthenticated: false,
        userId: null,
      })
    ).toBeUndefined();
    expect(shouldInvalidateAuthenticatedChatSession(undefined, null)).toBe(false);
    expect(shouldInvalidateAuthenticatedChatSession(undefined, 'user-a')).toBe(false);
  });

  it('invalidates only authenticated logout/switch; preserves guest→auth', () => {
    expect(shouldInvalidateAuthenticatedChatSession('user-a', null)).toBe(true);
    expect(shouldInvalidateAuthenticatedChatSession('user-a', 'user-b')).toBe(true);
    expect(shouldInvalidateAuthenticatedChatSession(null, 'user-a')).toBe(false);
    expect(shouldInvalidateAuthenticatedChatSession('user-a', 'user-a')).toBe(false);
    expect(shouldInvalidateAuthenticatedChatSession(null, null)).toBe(false);
  });

  it('guest→auth does not clear active guest chat state', () => {
    const session = createSession(null);
    session.chatId = 'guest-chat';
    session.messages = [{ id: 'g1', text: 'guest msg', isUser: true }];
    invalidateOnOwnerChange(session, 'user-a');
    expect(session.chatId).toBe('guest-chat');
    expect(session.messages).toEqual([{ id: 'g1', text: 'guest msg', isUser: true }]);
    expect(session.authOwner).toBe('user-a');
  });
});

describe('Phase 8.8G-2.2 active chat logout / account switch', () => {
  it('invalidates A active UI on logout and ignores late A detail', async () => {
    const session = createSession('user-a');
    session.chatId = 'chat-a';
    session.messages = [{ id: 'm1', text: 'A secret', isUser: true }];
    session.activeLoadTarget = 'chat-a';
    session.loadGeneration = 1;

    const detailA = deferred<{ id: string; messages: typeof session.messages }>();
    const loadGen = session.loadGeneration;
    const loadSession = session.sessionGeneration;
    const loadTarget = 'chat-a';
    const pending = (async () => {
      const detail = await detailA.promise;
      if (!canApplySessionBoundResult(loadSession, session.sessionGeneration)) return;
      if (session.loadGeneration !== loadGen || session.activeLoadTarget !== loadTarget) return;
      session.chatId = detail.id;
      session.messages = detail.messages;
    })();

    invalidateOnOwnerChange(session, null);

    expect(session.chatId).toBeNull();
    expect(session.messages).toEqual([]);
    expect(session.activeLoadTarget).toBeNull();

    detailA.resolve({
      id: 'chat-a',
      messages: [{ id: 'm1', text: 'A secret', isUser: true }],
    });
    await pending;

    expect(session.chatId).toBeNull();
    expect(session.messages).toEqual([]);
  });

  it('A → B switch: late A cannot reappear after B is owner', async () => {
    const session = createSession('user-a');
    session.chatId = 'chat-a';
    session.messages = [{ id: 'a1', text: 'from A', isUser: true }];

    invalidateOnOwnerChange(session, 'user-b');
    expect(session.chatId).toBeNull();
    expect(session.messages).toEqual([]);

    session.chatId = 'chat-b';
    session.messages = [{ id: 'b1', text: 'from B', isUser: true }];
    session.skipAutosave = false;

    const lateA = deferred<string>();
    const started = session.sessionGeneration - 1;
    const applyLate = (async () => {
      const text = await lateA.promise;
      if (!canApplySessionBoundResult(started, session.sessionGeneration)) return;
      session.messages = [{ id: 'a-late', text, isUser: true }];
    })();

    lateA.resolve('from A late');
    await applyLate;

    expect(session.messages).toEqual([{ id: 'b1', text: 'from B', isUser: true }]);
    expect(session.authOwner).toBe('user-b');
  });
});

describe('Phase 8.8G-2.2 stream after logout', () => {
  it('late A stream chunks do not mutate UI after owner invalidation', async () => {
    const session = createSession('user-a');
    session.messages = [{ id: 'eza-1', text: '', isUser: false }];
    const streamGeneration = session.sessionGeneration;

    const chunk = deferred<string>();
    const applyChunk = (async () => {
      const token = await chunk.promise;
      if (!canApplySessionBoundResult(streamGeneration, session.sessionGeneration)) return;
      session.appliedStreamChunks.push(token);
      session.messages = [{ id: 'eza-1', text: token, isUser: false }];
    })();

    invalidateOnOwnerChange(session, null);
    chunk.resolve('A-token');
    await applyChunk;

    expect(session.appliedStreamChunks).toEqual([]);
    expect(session.messages).toEqual([]);
  });
});

describe('Phase 8.8G-2.2 autosave account isolation', () => {
  it('scheduled A autosave cannot write into B or guest bucket after switch', () => {
    const session = createSession('user-a');
    session.chatId = 'chat-a';
    session.messages = [{ id: 'm1', text: 'A only', isUser: true }];
    const epochAtSchedule = session.persistEpoch;
    const boundOwner = session.authOwner;

    invalidateOnOwnerChange(session, 'user-b');
    session.skipAutosave = false;
    session.chatId = 'chat-b';
    session.messages = [{ id: 'm2', text: 'B only', isUser: true }];

    flushSave(session, 'chat-a', [{ id: 'm1', text: 'A only', isUser: true }], epochAtSchedule, boundOwner);

    expect(session.archivesWritten).toEqual([]);
  });

  it('logout cannot autosave A messages into guest bucket', () => {
    const session = createSession('user-a');
    const epochAtSchedule = session.persistEpoch;
    const boundOwner = session.authOwner;
    const aMessages = [{ id: 'm1', text: 'A only', isUser: true }];

    invalidateOnOwnerChange(session, null);

    flushSave(session, 'chat-a', aMessages, epochAtSchedule, boundOwner);
    expect(session.archivesWritten).toEqual([]);
  });
});

describe('Phase 8.8G-2.2 store title initializeTitleOnly', () => {
  beforeEach(() => {
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
  });

  it('sends initializeTitleOnly on first-title persistence', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-a',
        clientConversationId: 'chat-a',
        title: 'Yeni sohbet',
        preview: '',
        conversationType: 'direct',
        messageCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    ]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      id: 'srv-a',
      clientConversationId: 'chat-a',
      title: 'Merhaba',
      preview: '',
      conversationType: 'direct',
      messageCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      archived: false,
      pinned: false,
      titlePinned: false,
    });

    await persistServerConversationTitleIfNeeded('chat-a', 'Merhaba');

    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith('srv-a', {
      title: 'Merhaba',
      initializeTitleOnly: true,
    });
  });

  it('keeps server-returned title when CAS no-ops after manual rename', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-a',
        clientConversationId: 'chat-a',
        title: 'Yeni sohbet',
        preview: '',
        conversationType: 'direct',
        messageCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    ]);
    await bootstrapServerConversations('user-a');
    apiMocks.patchServerConversation.mockResolvedValue({
      id: 'srv-a',
      clientConversationId: 'chat-a',
      title: 'Kadıköy zemin taşlarının değerlendirilmesi',
      preview: '',
      conversationType: 'direct',
      messageCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      archived: false,
      pinned: false,
      titlePinned: true,
    });

    await persistServerConversationTitleIfNeeded('chat-a', 'Otomatik başlık adayı');

    expect(getServerConversationSummaries()[0]?.title).toBe(
      'Kadıköy zemin taşlarının değerlendirilmesi'
    );
  });
});

describe('Phase 8.8G-2.2 late detail after logout store authority', () => {
  beforeEach(() => {
    resetServerConversationStoreForTests();
    vi.clearAllMocks();
  });

  it('discards late A detail after logout clears store', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-a',
        clientConversationId: 'chat-a',
        title: 'A',
        preview: 'p',
        conversationType: 'direct',
        messageCount: 1,
        createdAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
      },
    ]);
    await bootstrapServerConversations('user-a');

    const detailA = deferred<{
      id: string;
      clientConversationId: string;
      title: string;
      preview: string;
      conversationType: 'direct';
      messageCount: number;
      createdAt: string;
      archived: boolean;
      pinned: boolean;
      titlePinned: boolean;
      messages: [];
    }>();
    apiMocks.getServerConversation.mockImplementationOnce(() => detailA.promise);

    const pending = fetchServerConversationDetail('chat-a');
    clearServerConversationState();
    detailA.resolve({
      id: 'srv-a',
      clientConversationId: 'chat-a',
      title: 'A',
      preview: 'p',
      conversationType: 'direct',
      messageCount: 1,
      createdAt: '2026-01-01T00:00:00Z',
      archived: false,
      pinned: false,
      titlePinned: false,
      messages: [],
    });
    expect(await pending).toBeNull();
    expect(getServerConversationSummaries()).toEqual([]);
  });
});
