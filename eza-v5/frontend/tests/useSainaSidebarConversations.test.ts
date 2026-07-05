import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { createStandaloneChat, listChatArchives } from '@/lib/standaloneChatArchive';

describe('useSainaSidebarConversations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds conversation tree groups instead of flat time buckets', () => {
    createStandaloneChat({ title: 'İtalya gezisi' });
    createStandaloneChat({ title: 'Japonya yolculuğu' });

    const { result } = renderHook(() =>
      useSainaSidebarConversations(listChatArchives())
    );

    expect(result.current.conversations.length).toBeGreaterThanOrEqual(2);
    expect(result.current.conversationGroups.length).toBeGreaterThan(0);
    expect(result.current.conversationGroups[0]?.title).toBe('Diğer');
  });
});
