import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';
import * as archive from '@/lib/standaloneChatArchive';
import {
  createStandaloneChat,
  getChatArchive,
  renameChat,
  saveStandaloneChat,
} from '@/lib/standaloneChatArchive';

const SAMPLE_CONV: SainaConversationItem = {
  id: 'chat-a',
  title: 'Kyoto Akşamları',
  preview: 'İpek Yolu…',
  time: 'Az önce',
  thumbGradient: 'linear-gradient(135deg, #173B45, #0F2B25)',
};

function renderSidebar(
  props: Partial<ComponentProps<typeof SainaConversationSidebar>> = {}
) {
  const onSelectChat = vi.fn();
  const onDeleteChat = vi.fn();
  const view = render(
    <SainaConversationSidebar
      conversations={[SAMPLE_CONV]}
      onSelectChat={onSelectChat}
      onDeleteChat={onDeleteChat}
      {...props}
    />
  );
  return { onSelectChat, onDeleteChat, ...view };
}

async function openMenu(chatId = 'chat-a') {
  fireEvent.click(screen.getByTestId(`saina-conv-menu-${chatId}`));
  await waitFor(() => {
    expect(screen.getByTestId(`saina-conv-menu-dropdown-${chatId}`)).toBeInTheDocument();
  });
}

async function openRenameInput(chatId = 'chat-a') {
  await openMenu(chatId);
  fireEvent.click(screen.getByTestId(`saina-conv-rename-${chatId}`));
  return screen.getByLabelText(/Kyoto Akşamları yeniden adlandır/i);
}

describe('saina sidebar row actions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(archive, 'renameChat');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('overflow menu', () => {
    it('opens below when list has room under the row', async () => {
      const listRect = {
        top: 0,
        bottom: 500,
        left: 0,
        right: 280,
        width: 280,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
      const btnRect = {
        top: 24,
        bottom: 68,
        left: 220,
        right: 264,
        width: 44,
        height: 44,
        x: 220,
        y: 24,
        toJSON: () => ({}),
      };
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.classList.contains('saina-conv-list')) return listRect as DOMRect;
        if (this.classList.contains('saina-conv-menu-btn')) return btnRect as DOMRect;
        return original.call(this);
      };

      renderSidebar();
      await openMenu();

      expect(screen.getByTestId('saina-conv-menu-dropdown-chat-a')).toHaveAttribute(
        'data-placement',
        'below'
      );

      Element.prototype.getBoundingClientRect = original;
    });

    it('opens above when the row is near the list bottom', async () => {
      const listRect = {
        top: 0,
        bottom: 500,
        left: 0,
        right: 280,
        width: 280,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
      const btnRect = {
        top: 452,
        bottom: 496,
        left: 220,
        right: 264,
        width: 44,
        height: 44,
        x: 220,
        y: 452,
        toJSON: () => ({}),
      };
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this.classList.contains('saina-conv-list')) return listRect as DOMRect;
        if (this.classList.contains('saina-conv-menu-btn')) return btnRect as DOMRect;
        return original.call(this);
      };

      renderSidebar();
      await openMenu();

      expect(screen.getByTestId('saina-conv-menu-dropdown-chat-a')).toHaveAttribute(
        'data-placement',
        'above'
      );

      Element.prototype.getBoundingClientRect = original;
    });

    it('closes on Escape', async () => {
      renderSidebar();
      await openMenu();
      expect(screen.getByTestId('saina-conv-menu-dropdown-chat-a')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('saina-conv-menu-dropdown-chat-a')).not.toBeInTheDocument();
    });

    it('does not trigger row navigation when opening rename', async () => {
      const { onSelectChat } = renderSidebar();
      await openMenu();
      fireEvent.click(screen.getByTestId('saina-conv-rename-chat-a'));
      expect(onSelectChat).not.toHaveBeenCalled();
    });

    it('does not trigger row navigation when deleting', async () => {
      const { onSelectChat, onDeleteChat } = renderSidebar();
      await openMenu();
      fireEvent.click(screen.getByTestId('saina-conv-delete-chat-a'));
      expect(onSelectChat).not.toHaveBeenCalled();
      expect(onDeleteChat).toHaveBeenCalledWith('chat-a');
    });

    it('closes when clicking outside the menu', async () => {
      render(
        <>
          <button type="button" data-testid="outside-focus">
            Dış
          </button>
          <SainaConversationSidebar
            conversations={[SAMPLE_CONV]}
            onSelectChat={vi.fn()}
            onDeleteChat={vi.fn()}
          />
        </>
      );

      await openMenu();
      fireEvent.mouseDown(screen.getByTestId('outside-focus'));
      await waitFor(() => {
        expect(screen.queryByTestId('saina-conv-menu-dropdown-chat-a')).not.toBeInTheDocument();
      });
    });

    it('closes when keyboard focus leaves the menu', async () => {
      renderSidebar();
      await openMenu();
      const menuRoot = document.querySelector('[data-conv-menu-root="chat-a"]');
      expect(menuRoot).toBeTruthy();
      fireEvent.blur(menuRoot!, { relatedTarget: document.body });
      await waitFor(() => {
        expect(screen.queryByTestId('saina-conv-menu-dropdown-chat-a')).not.toBeInTheDocument();
      });
    });

    it('calls onDeleteChat from delete action', async () => {
      const { onDeleteChat } = renderSidebar();
      await openMenu();
      fireEvent.click(screen.getByTestId('saina-conv-delete-chat-a'));
      expect(onDeleteChat).toHaveBeenCalledWith('chat-a');
    });
  });

  describe('rename', () => {
    it('saves on Enter', async () => {
      renderSidebar();
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: 'Yeni Başlık' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(archive.renameChat).toHaveBeenCalledWith('chat-a', 'Yeni Başlık');
    });

    it('saves on blur', async () => {
      renderSidebar();
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: 'Blur Başlık' } });
      fireEvent.blur(input);

      expect(archive.renameChat).toHaveBeenCalledWith('chat-a', 'Blur Başlık');
    });

    it('cancels on Escape without saving', async () => {
      renderSidebar();
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: 'İptal edilen' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(archive.renameChat).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/yeniden adlandır/i)).not.toBeInTheDocument();
      expect(screen.getByText('Kyoto Akşamları')).toBeInTheDocument();
    });

    it('does not save empty titles on blur', async () => {
      renderSidebar();
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.blur(input);

      expect(archive.renameChat).not.toHaveBeenCalled();
    });

    it('does not double-commit when Escape unmounts the input', async () => {
      renderSidebar();
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: 'Kaydedilmemeli' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(archive.renameChat).not.toHaveBeenCalled();
    });

    it('shows renamed active chat title after parent refresh', async () => {
      const { rerender } = renderSidebar({ activeChatId: 'chat-a' });
      const input = await openRenameInput();
      fireEvent.change(input, { target: { value: 'Aktif Yeni' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(archive.renameChat).toHaveBeenCalledWith('chat-a', 'Aktif Yeni');

      rerender(
        <SainaConversationSidebar
          activeChatId="chat-a"
          conversations={[{ ...SAMPLE_CONV, title: 'Aktif Yeni' }]}
          onSelectChat={vi.fn()}
          onDeleteChat={vi.fn()}
        />
      );

      expect(screen.getByText('Aktif Yeni')).toBeInTheDocument();
    });

    it('shows renamed non-active chat title after parent refresh', async () => {
      const other: SainaConversationItem = {
        ...SAMPLE_CONV,
        id: 'chat-b',
        title: 'Japonya',
      };
      const { rerender } = render(
        <SainaConversationSidebar
          activeChatId="chat-a"
          conversations={[SAMPLE_CONV, other]}
          onSelectChat={vi.fn()}
          onDeleteChat={vi.fn()}
        />
      );

      await openMenu('chat-b');
      fireEvent.click(screen.getByTestId('saina-conv-rename-chat-b'));
      const input = screen.getByLabelText(/Japonya yeniden adlandır/i);
      fireEvent.change(input, { target: { value: 'Osaka Geceleri' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(archive.renameChat).toHaveBeenCalledWith('chat-b', 'Osaka Geceleri');

      rerender(
        <SainaConversationSidebar
          activeChatId="chat-a"
          conversations={[SAMPLE_CONV, { ...other, title: 'Osaka Geceleri' }]}
          onSelectChat={vi.fn()}
          onDeleteChat={vi.fn()}
        />
      );

      expect(screen.getByText('Osaka Geceleri')).toBeInTheDocument();
    });
  });

  describe('archive integration', () => {
    it('keeps renamed title when autosave runs with new messages', () => {
      vi.restoreAllMocks();
      const id = createStandaloneChat({ title: 'İtalya gezisi' });
      renameChat(id, 'Elle adlandırıldı');

      saveStandaloneChat(id, [
        { id: 'm1', text: 'Roma ve Floransa rotası', isUser: true },
      ]);

      const stored = getChatArchive(id);
      expect(stored?.title).toBe('Elle adlandırıldı');
      expect(stored?.titlePinned).toBe(true);
    });
  });
});
