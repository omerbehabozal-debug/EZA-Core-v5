/**
 * Authenticated New Chat title/group picker — INTENT-DRIVEN (mounted lifecycle).
 *
 * Product invariant: picker opens only from explicit "Yeni Sohbet".
 * Message send / first-message chatId promotion / hydration / remount must never reopen it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useCallback, useEffect, useRef, useState } from 'react';
import NewChatGroupPicker from '@/components/saina/NewChatGroupPicker';
import {
  NEW_CHAT_DRAFT_GROUP_STORAGE_KEY,
  NEW_CHAT_PICKER_INTENT_STORAGE_KEY,
  readStoredNewChatDraftGroupId,
  readStoredNewChatPickerIntent,
  shouldAllowNewChatGroupPicker,
  shouldClearLiveConversationOnNewChatUrl,
  shouldOpenPickerOnNewChatMount,
  writeStoredNewChatDraftGroupId,
  writeStoredNewChatPickerIntent,
} from '@/lib/eza/newChatGroupPickerIntent';
import { isSainaNewChatRequest, SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';

const chatInnerSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
  'utf8'
);

const createGroupSpy = vi.fn(async (title: string) => ({
  id: `group-${title.toLowerCase().replace(/\s+/g, '-')}`,
  title,
}));

function namedGroup(id: string, title: string): ConversationGroup {
  return {
    id,
    userId: 'user-a',
    guestToken: null,
    title,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
  };
}

function clearIntentStorage() {
  writeStoredNewChatPickerIntent(null);
  writeStoredNewChatDraftGroupId(null);
}

/**
 * Mirrors StandaloneChatInner new-chat picker lifecycle (same mounted instance).
 */
function NewChatPickerLifecycleHarness({
  isServerBacked,
  initialSearch = 'new=1',
  initialChatId = null as string | null,
  initialMessages = [] as string[],
  initialDraftGroupId = null as string | null,
  simulateRemountKey = 0,
}: {
  isServerBacked: boolean;
  initialSearch?: string;
  initialChatId?: string | null;
  initialMessages?: string[];
  initialDraftGroupId?: string | null;
  simulateRemountKey?: number;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<string[]>(initialMessages);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [draftGroupId, setDraftGroupId] = useState<string | null>(initialDraftGroupId);
  const [groups, setGroups] = useState<ConversationGroup[]>([]);
  const [groupCreating, setGroupCreating] = useState(false);
  const [hydrateTick, setHydrateTick] = useState(0);
  const intentRef = useRef(false);
  const urlSyncEnabledRef = useRef(true);

  const beginIntent = useCallback(() => {
    if (!shouldAllowNewChatGroupPicker(isServerBacked)) {
      intentRef.current = false;
      writeStoredNewChatPickerIntent(null);
      writeStoredNewChatDraftGroupId(null);
      setGroupPickerOpen(false);
      return;
    }
    intentRef.current = true;
    writeStoredNewChatPickerIntent('pending');
    writeStoredNewChatDraftGroupId(null);
    setGroupPickerOpen(true);
  }, [isServerBacked]);

  const consumeIntent = useCallback((groupId: string | null = null) => {
    intentRef.current = false;
    writeStoredNewChatPickerIntent('consumed');
    writeStoredNewChatDraftGroupId(groupId);
    setGroupPickerOpen(false);
  }, []);

  const startDraft = useCallback((groupId: string | null = null) => {
    setChatId(null);
    setMessages([]);
    setDraftGroupId(groupId);
  }, []);

  // Cold/remount bootstrap for ?new=1 (mirrors StandaloneChatInner).
  useEffect(() => {
    if (!isSainaNewChatRequest(search)) return;
    if (chatId || messages.length > 0) return;
    const storedIntent = readStoredNewChatPickerIntent();
    if (
      shouldOpenPickerOnNewChatMount({
        isServerBacked,
        storedIntent,
      })
    ) {
      startDraft(null);
      beginIntent();
    } else {
      intentRef.current = false;
      startDraft(readStoredNewChatDraftGroupId());
      setGroupPickerOpen(false);
    }
    // Only on remount key / first paint for this harness instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulateRemountKey]);

  // Mounted ?new=1 invariant — same gate as StandaloneChatInner.
  useEffect(() => {
    if (!urlSyncEnabledRef.current) return;
    const isNewChatRequest = isSainaNewChatRequest(search);
    const hasLiveConversation = Boolean(chatId) || messages.length > 0;
    const storedIntent = readStoredNewChatPickerIntent();
    if (storedIntent === 'consumed') {
      intentRef.current = false;
      return;
    }
    const hasPendingNewChatIntent =
      intentRef.current || storedIntent === 'pending';
    if (
      !shouldClearLiveConversationOnNewChatUrl({
        isNewChatRequest,
        hasLiveConversation,
        hasPendingNewChatIntent,
      })
    ) {
      return;
    }
    startDraft(null);
    setGroupPickerOpen(true);
  }, [search, chatId, messages.length, startDraft]);

  const handleNewChat = () => {
    startDraft(null);
    beginIntent();
    setSearch('new=1');
  };

  const openDraftInGroup = (groupId: string | null) => {
    startDraft(groupId);
    consumeIntent(groupId);
    setSearch('new=1');
  };

  const handleCreateGroupAndChat = async (title: string) => {
    setGroupCreating(true);
    try {
      const group = await createGroupSpy(title);
      setGroups((prev) => [...prev, namedGroup(group.id, group.title)]);
      openDraftInGroup(group.id);
    } finally {
      setGroupCreating(false);
    }
  };

  /** Simulates first-message race: chatId/messages update while URL still ?new=1. */
  const handleSend = (text: string) => {
    const newId = chatId ?? `chat-${Date.now()}`;
    setChatId(newId);
    setMessages((prev) => [...prev, text]);
    writeStoredNewChatPickerIntent(null);
    writeStoredNewChatDraftGroupId(null);
    intentRef.current = false;
    window.setTimeout(() => {
      setSearch(`chat=${newId}`);
    }, 0);
  };

  const simulateAssistant = () => {
    setMessages((prev) => [...prev, 'assistant-reply']);
  };

  const simulateHydrateRefresh = () => {
    setHydrateTick((n) => n + 1);
  };

  return (
    <div data-hydrate={hydrateTick}>
      <div data-testid="route">
        {search.includes('new=1') ? SAINA_NEW_CHAT_ROUTE : `/standalone?${search}`}
      </div>
      <div data-testid="chat-id">{chatId ?? ''}</div>
      <div data-testid="draft-group">{draftGroupId ?? ''}</div>
      <div data-testid="messages">{messages.join('|')}</div>
      <div data-testid="create-group-calls">{String(createGroupSpy.mock.calls.length)}</div>
      <div data-testid="stored-intent">{readStoredNewChatPickerIntent() ?? ''}</div>
      <button type="button" data-testid="yeni-sohbet" onClick={handleNewChat}>
        Yeni Sohbet
      </button>
      <button type="button" data-testid="send-merhaba" onClick={() => handleSend('merhaba')}>
        Send merhaba
      </button>
      <button type="button" data-testid="send-ikinci" onClick={() => handleSend('ikinci')}>
        Send ikinci
      </button>
      <button type="button" data-testid="send-ucuncu" onClick={() => handleSend('ucuncu')}>
        Send ucuncu
      </button>
      <button type="button" data-testid="assistant-reply" onClick={simulateAssistant}>
        Assistant
      </button>
      <button type="button" data-testid="hydrate-refresh" onClick={simulateHydrateRefresh}>
        Hydrate
      </button>
      <NewChatGroupPicker
        open={groupPickerOpen}
        groups={groups}
        onClose={() => {
          if (groupCreating) return;
          consumeIntent(null);
        }}
        onSelectExisting={(id) => openDraftInGroup(id)}
        onCreateNew={handleCreateGroupAndChat}
        onContinueUngrouped={() => openDraftInGroup(null)}
        creating={groupCreating}
      />
    </div>
  );
}

describe('newChatGroupPickerIntent helpers', () => {
  beforeEach(() => clearIntentStorage());
  afterEach(() => clearIntentStorage());

  it('never clears/reopens without pending intent (first-message race)', () => {
    expect(
      shouldClearLiveConversationOnNewChatUrl({
        isNewChatRequest: true,
        hasLiveConversation: true,
        hasPendingNewChatIntent: false,
      })
    ).toBe(false);
  });

  it('clears leftover live canvas only while intent pending', () => {
    expect(
      shouldClearLiveConversationOnNewChatUrl({
        isNewChatRequest: true,
        hasLiveConversation: true,
        hasPendingNewChatIntent: true,
      })
    ).toBe(true);
  });

  it('guests never allow picker', () => {
    expect(shouldAllowNewChatGroupPicker(false)).toBe(false);
    expect(shouldAllowNewChatGroupPicker(true)).toBe(true);
  });

  it('consumed intent must not open picker on remount', () => {
    expect(
      shouldOpenPickerOnNewChatMount({ isServerBacked: true, storedIntent: 'consumed' })
    ).toBe(false);
    expect(
      shouldOpenPickerOnNewChatMount({ isServerBacked: true, storedIntent: null })
    ).toBe(true);
    expect(
      shouldOpenPickerOnNewChatMount({ isServerBacked: true, storedIntent: 'pending' })
    ).toBe(true);
    expect(
      shouldOpenPickerOnNewChatMount({ isServerBacked: false, storedIntent: null })
    ).toBe(false);
  });
});

describe('New Chat group picker — mounted intent lifecycle', () => {
  beforeEach(() => {
    createGroupSpy.mockClear();
    clearIntentStorage();
  });

  afterEach(() => {
    clearIntentStorage();
    vi.clearAllMocks();
  });

  it('A) authenticated Yeni Sohbet opens prompt exactly once', () => {
    render(<NewChatPickerLifecycleHarness isServerBacked initialSearch="chat=existing" />);
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    expect(screen.getByTestId('new-chat-group-picker')).toBeInTheDocument();
    expect(screen.getByText('Bu sohbet nerede ilerlesin?')).toBeInTheDocument();
  });

  it('B) select/create group closes prompt', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Akşam Rotası' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-create-submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    });
    expect(readStoredNewChatPickerIntent()).toBe('consumed');
  });

  it('C) first message keeps prompt closed (same mount)', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Akşam Rotası' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-create-submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('send-merhaba'));
    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('merhaba');
    });
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
  });

  it('D) assistant response keeps prompt closed', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.click(screen.getByTestId('new-chat-group-ungrouped'));
    fireEvent.click(screen.getByTestId('send-merhaba'));
    fireEvent.click(screen.getByTestId('assistant-reply'));
    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('merhaba|assistant-reply');
    });
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
  });

  it('E) several messages: prompt closed; create-group once', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Tek Grup' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-create-submit'));
    await waitFor(() => {
      expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('send-merhaba'));
    fireEvent.click(screen.getByTestId('send-ikinci'));
    fireEvent.click(screen.getByTestId('send-ucuncu'));

    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('merhaba|ikinci|ucuncu');
    });
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    expect(createGroupSpy).toHaveBeenCalledTimes(1);
  });

  it('F) hydrate / sidebar refresh does not reopen prompt', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.click(screen.getByTestId('new-chat-group-ungrouped'));
    fireEvent.click(screen.getByTestId('send-merhaba'));
    fireEvent.click(screen.getByTestId('hydrate-refresh'));
    fireEvent.click(screen.getByTestId('hydrate-refresh'));
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
  });

  it('F2) remount after group select keeps picker closed (consumed session intent)', async () => {
    const { unmount } = render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Kalıcı Grup' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-create-submit'));
    await waitFor(() => {
      expect(readStoredNewChatPickerIntent()).toBe('consumed');
    });
    const groupId = readStoredNewChatDraftGroupId();
    expect(groupId).toBeTruthy();
    unmount();

    render(
      <NewChatPickerLifecycleHarness
        isServerBacked
        initialSearch="new=1"
        simulateRemountKey={1}
      />
    );
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('draft-group')).toHaveTextContent(groupId!);
  });

  it('G) Yeni Sohbet again opens prompt exactly once more', async () => {
    render(<NewChatPickerLifecycleHarness isServerBacked />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    fireEvent.click(screen.getByTestId('new-chat-group-ungrouped'));
    fireEvent.click(screen.getByTestId('send-merhaba'));
    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('merhaba');
    });
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    expect(screen.getByTestId('new-chat-group-picker')).toBeInTheDocument();
  });

  it('H) guest Yeni Sohbet never shows title/group prompt', () => {
    render(<NewChatPickerLifecycleHarness isServerBacked={false} />);
    fireEvent.click(screen.getByTestId('yeni-sohbet'));
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
  });

  it('I) existing active grouped conversation send never opens prompt', async () => {
    render(
      <NewChatPickerLifecycleHarness
        isServerBacked
        initialSearch="chat=chat-grouped"
        initialChatId="chat-grouped"
        initialMessages={['önceki']}
        initialDraftGroupId="group-existing"
      />
    );
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('send-merhaba'));
    fireEvent.click(screen.getByTestId('assistant-reply'));
    await waitFor(() => {
      expect(screen.getByTestId('messages')).toHaveTextContent('önceki|merhaba|assistant-reply');
    });
    expect(screen.queryByTestId('new-chat-group-picker')).not.toBeInTheDocument();
    expect(createGroupSpy).not.toHaveBeenCalled();
  });
});

describe('StandaloneChatInner wiring — intent-driven picker', () => {
  it('uses begin/consume intent, session storage, and gates remount reopen', () => {
    expect(chatInnerSrc).toContain('beginAuthenticatedNewChatPickerIntent');
    expect(chatInnerSrc).toContain('consumeAuthenticatedNewChatPickerIntent');
    expect(chatInnerSrc).toContain('shouldClearLiveConversationOnNewChatUrl');
    expect(chatInnerSrc).toContain('shouldOpenPickerOnNewChatMount');
    expect(chatInnerSrc).toContain('writeStoredNewChatPickerIntent');
    expect(chatInnerSrc).toContain('authenticatedNewChatPickerIntentRef');
    expect(chatInnerSrc).toMatch(/storedIntent === 'consumed'/);
  });
});

describe('happy-path storage keys exported', () => {
  it('exposes stable session keys', () => {
    expect(NEW_CHAT_PICKER_INTENT_STORAGE_KEY).toContain('authenticatedNewChatPicker');
    expect(NEW_CHAT_DRAFT_GROUP_STORAGE_KEY).toContain('draftGroupId');
  });
});
