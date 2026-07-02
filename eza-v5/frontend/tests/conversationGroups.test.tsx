import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NewChatGroupPicker from '@/components/saina/NewChatGroupPicker';
import {
  createConversationGroup,
  listConversationGroups,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { inferMirrorGroupTitle } from '@/lib/eza/conversation-tree/inferMirrorGroupTitle';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import {
  createStandaloneChat,
  listChatArchives,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';

const MIRROR_SESSION: MirrorSohbetSession = {
  sessionId: 'sess-1',
  guestToken: 'guest-token-abcdefghijklmnop',
  mirrorSlug: 'sokak-lambalari-test',
  cardTitle: 'Sokak Lambaları',
  openingMessage: 'Bu Ayna, Kyoto merakından doğdu.',
  thoughtCards: [],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  parentMirrorId: 'sokak-lambalari-test',
  rootMirrorId: 'sokak-lambalari-test',
  seedTopic: 'Sokak Lambaları',
  seedCategory: 'travel',
  seedMood: 'discovery',
};

describe('conversation groups (Stage 3 commit 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('creates conversation group and assigns chat via groupId', () => {
    const group = createConversationGroup({ title: 'Japonya', source: 'manual' });
    const chatId = createStandaloneChat({ groupId: group.id });
    const archives = listChatArchives();
    const chat = archives.find((a) => a.id === chatId);
    expect(chat?.groupId).toBe(group.id);
  });

  it('builds grouped sidebar tree under Sohbetlerim headings', () => {
    const japan = createConversationGroup({ title: 'Japonya', source: 'manual' });
    const cars = createConversationGroup({ title: 'Otomobiller', source: 'manual' });
    createStandaloneChat({ groupId: japan.id, title: 'Kyoto Akşamları' });
    createStandaloneChat({ groupId: cars.id, title: 'Mercedes W124' });

    const tree = buildConversationTree(listChatArchives(), listConversationGroups());
    const titles = tree.map((g) => g.title);
    expect(titles).toContain('Japonya');
    expect(titles).toContain('Otomobiller');
    expect(tree.find((g) => g.title === 'Japonya')?.conversations.length).toBe(1);
  });

  it('infers mirror group title without seed UI language', () => {
    expect(inferMirrorGroupTitle(MIRROR_SESSION)).toBe('Japonya');
    const uiBlob = JSON.stringify({ title: inferMirrorGroupTitle(MIRROR_SESSION) }).toLowerCase();
    expect(uiBlob).not.toContain('seed');
    expect(uiBlob).not.toContain('branch');
  });

  it('marks mirror-source chats for ✦ display metadata', () => {
    const group = createConversationGroup({ title: 'Japonya', source: 'mirror' });
    const chatId = createStandaloneChat({
      groupId: group.id,
      treeMetadata: {
        groupId: group.id,
        sourceType: 'mirror',
        startedFromMirrorId: 'slug-1',
        isGuestSession: true,
      },
    });
    const summary = listChatArchives().find((a) => a.id === chatId) as ArchivedChatSummary;
    expect(summary.isMirrorSource).toBe(true);
  });

  it('new chat group picker offers create and existing headings', () => {
    const group = createConversationGroup({ title: 'Mimarlık', source: 'manual' });
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <NewChatGroupPicker
        open
        groups={[group]}
        onClose={() => {}}
        onSelectExisting={onSelect}
        onCreateNew={onCreate}
      />
    );

    expect(screen.getByText(/hangi başlığın altında/i)).toBeInTheDocument();
    expect(screen.queryByText(/Araştırmalarım/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('new-chat-group-existing-' + group.id));
    expect(onSelect).toHaveBeenCalledWith(group.id);

    fireEvent.click(screen.getByTestId('new-chat-group-create'));
    fireEvent.change(screen.getByTestId('new-chat-group-title-input'), {
      target: { value: 'Otomobiller' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-submit'));
    expect(onCreate).toHaveBeenCalledWith('Otomobiller');
  });
});
