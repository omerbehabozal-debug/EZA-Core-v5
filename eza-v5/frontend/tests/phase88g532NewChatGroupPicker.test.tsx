/**
 * New-chat group picker + empty-group sidebar (post G5.3.2 UX).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewChatGroupPicker from '@/components/saina/NewChatGroupPicker';
import {
  buildConversationTree,
  shouldUseConversationTreeMode,
} from '@/lib/eza/conversation-tree/groupTree';
import { UNGROUPED_CONVERSATION_GROUP_ID } from '@/lib/eza/conversation-tree/types';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isSainaNewChatRequest,
  SAINA_NEW_CHAT_ROUTE,
} from '@/lib/eza/sainaRoutes';

function namedGroup(id: string, title: string): ConversationGroup {
  return {
    id,
    userId: 'user-a',
    title,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 1,
  };
}

describe('New chat group picker UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows destination copy and ungrouped escape', () => {
    render(
      <NewChatGroupPicker
        open
        groups={[]}
        onClose={() => {}}
        onSelectExisting={() => {}}
        onCreateNew={() => {}}
        onContinueUngrouped={() => {}}
      />
    );
    expect(screen.getByText('Bu sohbet nerede ilerlesin?')).toBeInTheDocument();
    expect(screen.getByText(/Bir grup ara veya yeni bir grup adı yaz/i)).toBeInTheDocument();
    expect(screen.getByTestId('new-chat-group-ungrouped')).toHaveTextContent(
      'Grupsuz devam et'
    );
    expect(screen.queryByText(/hangi başlığın altında/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Yeni başlık oluştur/i)).not.toBeInTheDocument();
  });

  it('typeahead matches existing groups without POSTing', () => {
    const onCreate = vi.fn();
    const onSelect = vi.fn();
    render(
      <NewChatGroupPicker
        open
        groups={[namedGroup('g1', 'Mardin'), namedGroup('g2', 'japonya')]}
        onClose={() => {}}
        onSelectExisting={onSelect}
        onCreateNew={onCreate}
        onContinueUngrouped={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'mar' },
    });
    expect(screen.getByTestId('new-chat-group-existing-g1')).toBeInTheDocument();
    expect(screen.queryByTestId('new-chat-group-existing-g2')).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('explicit create only when typed title has no exact match', async () => {
    const onCreate = vi.fn();
    render(
      <NewChatGroupPicker
        open
        groups={[namedGroup('g1', 'Mardin')]}
        onClose={() => {}}
        onSelectExisting={() => {}}
        onCreateNew={onCreate}
        onContinueUngrouped={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Mardin' },
    });
    expect(screen.queryByTestId('new-chat-group-create-submit')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('new-chat-group-search-input'), {
      target: { value: 'Keşiflerim' },
    });
    fireEvent.click(screen.getByTestId('new-chat-group-create-submit'));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith('Keşiflerim');
    });
  });

  it('does not create on each keystroke', () => {
    const onCreate = vi.fn();
    render(
      <NewChatGroupPicker
        open
        groups={[]}
        onClose={() => {}}
        onSelectExisting={() => {}}
        onCreateNew={onCreate}
        onContinueUngrouped={() => {}}
      />
    );
    const input = screen.getByTestId('new-chat-group-search-input');
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.change(input, { target: { value: 'Ab' } });
    fireEvent.change(input, { target: { value: 'Abc' } });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('select existing and ungrouped callbacks', () => {
    const onSelect = vi.fn();
    const onUngrouped = vi.fn();
    render(
      <NewChatGroupPicker
        open
        groups={[namedGroup('g1', 'Mardin')]}
        onClose={() => {}}
        onSelectExisting={onSelect}
        onCreateNew={() => {}}
        onContinueUngrouped={onUngrouped}
      />
    );
    fireEvent.click(screen.getByTestId('new-chat-group-existing-g1'));
    expect(onSelect).toHaveBeenCalledWith('g1');
    fireEvent.click(screen.getByTestId('new-chat-group-ungrouped'));
    expect(onUngrouped).toHaveBeenCalled();
  });

  it('shows create error without inventing a local group', () => {
    render(
      <NewChatGroupPicker
        open
        groups={[]}
        onClose={() => {}}
        onSelectExisting={() => {}}
        onCreateNew={() => {}}
        onContinueUngrouped={() => {}}
        error="Grup oluşturulamadı. Tekrar deneyebilirsin."
      />
    );
    expect(screen.getByTestId('new-chat-group-error')).toBeInTheDocument();
  });
});

describe('Empty named groups in sidebar tree', () => {
  it('renders real empty groups and keeps tree mode', () => {
    const groups = [namedGroup('g-empty', 'Boş Grup')];
    const tree = buildConversationTree([], groups, null);
    expect(tree.some((n) => n.id === 'g-empty')).toBe(true);
    expect(tree.find((n) => n.id === 'g-empty')?.conversations).toEqual([]);
    expect(shouldUseConversationTreeMode(tree)).toBe(true);
  });

  it('still date-falls-back when only synthetic ungrouped exists', () => {
    const tree = buildConversationTree(
      [
        {
          id: 'c1',
          title: 'c1',
          preview: 'p',
          savedAt: '2026-01-01T00:00:00.000Z',
          messageCount: 1,
          groupId: null,
        },
      ],
      [],
      null
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe(UNGROUPED_CONVERSATION_GROUP_ID);
    expect(shouldUseConversationTreeMode(tree)).toBe(false);
  });
});

describe('New chat entry wiring', () => {
  it('Discover/Pattern still route through ?new=1; chat opens picker on that request', () => {
    expect(SAINA_NEW_CHAT_ROUTE).toBe('/standalone?new=1');
    expect(isSainaNewChatRequest('new=1')).toBe(true);
    const chatSrc = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(chatSrc).toContain('setGroupPickerOpen(true)');
    expect(chatSrc).toContain('openDraftInGroup');
    expect(chatSrc).toContain('createAuthenticatedConversationGroup');
    // No immediate empty archive on group create path.
    expect(chatSrc).toMatch(/openDraftInGroup\(group\.id\)/);
    expect(chatSrc).not.toMatch(/createStandaloneChat\(\{\s*groupId\s*\}\)/);
  });
});
