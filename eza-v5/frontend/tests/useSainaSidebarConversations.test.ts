import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { createStandaloneChat, listChatArchives } from '@/lib/standaloneChatArchive';
import { shouldUseConversationTreeMode } from '@/lib/eza/conversation-tree/groupTree';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isAuthReady: true,
    user: null,
    token: null,
    role: null,
    setAuth: () => undefined,
    patchAuthUser: () => undefined,
    logout: () => undefined,
  }),
}));

describe('useSainaSidebarConversations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds conversation tree groups including synthetic ungrouped', () => {
    createStandaloneChat({ title: 'İtalya gezisi' });
    createStandaloneChat({ title: 'Japonya yolculuğu' });

    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives())
    );

    expect(result.current.conversations.length).toBeGreaterThanOrEqual(2);
    expect(result.current.conversationGroups.length).toBeGreaterThan(0);
    expect(result.current.conversationGroups[0]?.title).toBe('Diğer');
    // Sidebar must not treat synthetic-only tree as tree mode (8.8G-5 / 1.2).
    expect(shouldUseConversationTreeMode(result.current.conversationGroups)).toBe(false);
  });
});
