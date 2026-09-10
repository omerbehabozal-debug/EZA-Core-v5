import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import type { ConversationTreeGroupNode } from '@/lib/eza/conversation-tree/types';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isAuthReady: true,
  }),
}));

vi.mock('@/hooks/useConversationYansiStatusMap', () => ({
  useConversationYansiStatusMap: () => ({}),
}));

const conversation = (patch: Partial<SainaConversationItem> = {}): SainaConversationItem => ({
  id: 'chat-a',
  title: 'Kyoto',
  preview: 'Eski preview',
  time: 'Az önce',
  thumbGradient: 'linear-gradient(135deg, #173B45, #0F2B25)',
  thumbImageUrl: null,
  ...patch,
});

const treeChat = (
  patch: Partial<ConversationTreeGroupNode['conversations'][number]> = {}
): ConversationTreeGroupNode['conversations'][number] => ({
  id: 'chat-a',
  title: 'Kyoto',
  preview: 'Eski preview',
  time: 'Az önce',
  thumbGradient: 'linear-gradient(135deg, #173B45, #0F2B25)',
  thumbImageUrl: null,
  savedAt: '2026-01-01T00:00:00.000Z',
  isMirrorSource: false,
  yansiStatus: 'none',
  ...patch,
});

function group(title: string, patch: Partial<ConversationTreeGroupNode> = {}): ConversationTreeGroupNode {
  return {
    id: 'group-a',
    title,
    source: 'manual',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
    conversations: [treeChat()],
    ...patch,
  };
}

function Harness({
  conversations,
  conversationGroups,
}: {
  conversations: SainaConversationItem[];
  conversationGroups?: ConversationTreeGroupNode[];
}) {
  useSyncSainaChrome({
    activeSection: 'chat',
    conversations,
    conversationGroups,
    activeChatId: 'chat-a',
    safeOnlyMode: false,
    analysisModelId: 'gpt-test',
    onSafeOnlyModeChange: vi.fn(),
    onAnalysisModelChange: vi.fn(),
  });
  return null;
}

describe('Saina chrome sidebar signatures', () => {
  beforeEach(() => {
    useSainaChromeStore.setState({
      activeSection: 'chat',
      conversations: [],
      conversationGroups: undefined,
      activeChatId: null,
      conversationSceneUrl: null,
      safeOnlyMode: false,
      analysisModelId: 'gpt-test',
      onSafeOnlyModeChange: () => {},
      onAnalysisModelChange: () => {},
    });
  });

  it('updates chrome groups when only the group title changes', () => {
    const { rerender } = render(
      <Harness conversations={[conversation()]} conversationGroups={[group('Eski Grup')]} />
    );
    expect(useSainaChromeStore.getState().conversationGroups?.[0]?.title).toBe('Eski Grup');

    rerender(
      <Harness conversations={[conversation()]} conversationGroups={[group('Yeni Grup')]} />
    );

    expect(useSainaChromeStore.getState().conversationGroups?.[0]?.title).toBe('Yeni Grup');
  });

  it('updates chrome conversations when sidebar preview/time/image fields change', () => {
    const { rerender } = render(
      <Harness conversations={[conversation()]} conversationGroups={[group('Grup')]} />
    );
    expect(useSainaChromeStore.getState().conversations[0]?.preview).toBe('Eski preview');

    rerender(
      <Harness
        conversations={[
          conversation({
            preview: 'Yeni preview',
            time: 'Dün',
            thumbImageUrl: '/api/public/mirror-scene-assets/one.png',
          }),
        ]}
        conversationGroups={[group('Grup')]}
      />
    );

    expect(useSainaChromeStore.getState().conversations[0]?.preview).toBe('Yeni preview');
    expect(useSainaChromeStore.getState().conversations[0]?.time).toBe('Dün');
    expect(useSainaChromeStore.getState().conversations[0]?.thumbImageUrl).toBe(
      '/api/public/mirror-scene-assets/one.png'
    );
  });
});
