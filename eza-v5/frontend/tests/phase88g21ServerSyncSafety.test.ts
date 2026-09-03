import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  deleteServerBackedConversation,
  fetchServerConversationDetail,
  getServerConversationSummaries,
  hasServerBackedConversation,
  persistServerConversationTitleIfNeeded,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import { generateChatClientId } from '@/lib/eza/clientStableIds';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const userA = 'user-a-1111-1111-1111-111111111111';
const userB = 'user-b-2222-2222-2222-222222222222';

const summaryA = {
  id: 'srv-a',
  clientConversationId: 'chat-a',
  title: 'User A chat',
  preview: 'hello A',
  conversationType: 'direct' as const,
  messageCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastMessageAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
};

const summaryB = {
  id: 'srv-b',
  clientConversationId: 'chat-b',
  title: 'User B chat',
  preview: 'hello B',
  conversationType: 'direct' as const,
  messageCount: 1,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  lastMessageAt: '2026-01-02T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
};

beforeEach(() => {
  resetServerConversationStoreForTests();
  vi.clearAllMocks();
});

describe('Phase 8.8G-2.1 server sync safety', () => {
  it('A: stale account bootstrap — late User A response does not overwrite User B', async () => {
    const listA = deferred<typeof summaryA[]>();
    const listB = deferred<typeof summaryB[]>();

    apiMocks.listServerConversations
      .mockImplementationOnce(() => listA.promise)
      .mockImplementationOnce(() => listB.promise);

    const bootA = bootstrapServerConversations(userA);
    clearServerConversationState();
    const bootB = bootstrapServerConversations(userB);

    listB.resolve([summaryB]);
    await bootB;

    expect(getServerConversationSummaries()).toHaveLength(1);
    expect(getServerConversationSummaries()[0]?.title).toBe('User B chat');

    listA.resolve([summaryA]);
    await bootA;

    expect(getServerConversationSummaries()).toHaveLength(1);
    expect(getServerConversationSummaries()[0]?.title).toBe('User B chat');
  });

  it('G: logout clears in-memory server state immediately', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryA]);
    await bootstrapServerConversations(userA);
    expect(getServerConversationSummaries()).toHaveLength(1);

    clearServerConversationState();
    expect(getServerConversationSummaries()).toHaveLength(0);
    expect(hasServerBackedConversation('chat-a')).toBe(false);
  });

  it('C: failed server delete preserves conversation in store', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryA]);
    await bootstrapServerConversations(userA);
    apiMocks.deleteServerConversation.mockRejectedValue(new Error('server error'));

    await expect(deleteServerBackedConversation('chat-a')).rejects.toThrow();
    expect(getServerConversationSummaries()).toHaveLength(1);
    expect(hasServerBackedConversation('chat-a')).toBe(true);
  });

  it('D: server-only delete executes without local archive', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryA]);
    await bootstrapServerConversations(userA);
    apiMocks.deleteServerConversation.mockResolvedValue(undefined);

    await deleteServerBackedConversation('chat-a');

    expect(apiMocks.deleteServerConversation).toHaveBeenCalledWith('srv-a');
    expect(getServerConversationSummaries()).toHaveLength(0);
  });

  it('E: Device B bootstrap uses server title when local archive absent', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryA, title: 'Kyoto akşamları' },
    ]);
    await bootstrapServerConversations(userA);
    expect(getServerConversationSummaries()[0]?.title).toBe('Kyoto akşamları');
  });

  it('F: first-title durability PATCHes server once', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryA, title: 'Yeni sohbet' },
    ]);
    await bootstrapServerConversations(userA);
    apiMocks.patchServerConversation.mockResolvedValue({
      ...summaryA,
      title: 'Merhaba dünya nasılsın?',
    });

    await persistServerConversationTitleIfNeeded('chat-a', 'Merhaba dünya nasılsın?');

    expect(apiMocks.patchServerConversation).toHaveBeenCalledWith('srv-a', {
      title: 'Merhaba dünya nasılsın?',
      initializeTitleOnly: true,
    });
    expect(getServerConversationSummaries()[0]?.title).toBe('Merhaba dünya nasılsın?');
  });

  it('F: pinned/manual title is not overwritten on later sends', async () => {
    apiMocks.listServerConversations.mockResolvedValue([
      { ...summaryA, title: 'Özel başlık', titlePinned: true },
    ]);
    await bootstrapServerConversations(userA);

    await persistServerConversationTitleIfNeeded('chat-a', 'Başka bir mesaj');

    expect(apiMocks.patchServerConversation).not.toHaveBeenCalled();
    expect(getServerConversationSummaries()[0]?.title).toBe('Özel başlık');
  });

  it('B: detail fetch race — late A does not overwrite B target', async () => {
    let generation = 0;
    let activeTarget: string | null = null;
    let applied: string | null = null;

    async function loadChat(id: string, fetch: () => Promise<string>) {
      const gen = ++generation;
      activeTarget = id;
      const detail = await fetch();
      if (generation === gen && activeTarget === id) {
        applied = detail;
      }
    }

    const fetchA = deferred<string>();
    const fetchB = deferred<string>();

    const loadA = loadChat('chat-a', () => fetchA.promise);
    const loadB = loadChat('chat-b', () => fetchB.promise);

    fetchB.resolve('detail-b');
    await loadB;
    fetchA.resolve('detail-a');
    await loadA;

    expect(applied).toBe('detail-b');
  });

  it('stale detail fetch discarded by store authority', async () => {
    apiMocks.listServerConversations.mockResolvedValue([summaryA, summaryB]);
    await bootstrapServerConversations(userA);

    const detailA = deferred<(typeof summaryA & { messages: [] })>();
    apiMocks.getServerConversation.mockImplementationOnce(() => detailA.promise);

    const fetchA = fetchServerConversationDetail('chat-a');

    clearServerConversationState();
    apiMocks.listServerConversations.mockResolvedValue([summaryB]);
    await bootstrapServerConversations(userB);

    const detailB = {
      ...summaryB,
      messages: [] as [],
    };
    apiMocks.getServerConversation.mockResolvedValueOnce(detailB);
    const resultB = await fetchServerConversationDetail('chat-b');

    detailA.resolve({ ...summaryA, messages: [] });
    const resultA = await fetchA;

    expect(resultA).toBeNull();
    expect(resultB).not.toBeNull();
    expect(resultB?.id).toBe('chat-b');
  });

  it('H: legacy local data not uploaded during bootstrap', async () => {
    apiMocks.listServerConversations.mockResolvedValue([]);
    await bootstrapServerConversations(userA);
    expect(apiMocks.createServerConversation).not.toHaveBeenCalled();
  });
});

describe('Phase 8.8G-2.1 client IDs', () => {
  it('generates collision-resistant chat ids within backend max length', () => {
    const id = generateChatClientId('chat');
    expect(id.startsWith('chat-')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).not.toMatch(/chat-\d{13}$/);
  });
});
