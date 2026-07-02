import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SainaDeleteChatModal from '@/components/saina/SainaDeleteChatModal';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import {
  SAINA_DELETE_CHAT_CANCEL,
  SAINA_DELETE_CHAT_CONFIRM,
  SAINA_DELETE_CHAT_DESCRIPTION,
  SAINA_DELETE_CHAT_TITLE,
} from '@/lib/eza/sainaCopy';

function DeleteChatHarness({ onConfirmDelete }: { onConfirmDelete: (id: string) => void }) {
  const { requestDelete, deleteModal } = useSainaDeleteChatModal({ onConfirmDelete });
  return (
    <>
      <button type="button" data-testid="trigger-delete" onClick={() => requestDelete('chat-1')}>
        Sil
      </button>
      {deleteModal}
    </>
  );
}

describe('SainaDeleteChatModal', () => {
  const confirmSpy = vi.fn();
  const cancelSpy = vi.fn();

  beforeEach(() => {
    confirmSpy.mockReset();
    cancelSpy.mockReset();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('window.confirm must not be called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens when trash flow requests delete', () => {
    const onConfirmDelete = vi.fn();
    render(<DeleteChatHarness onConfirmDelete={onConfirmDelete} />);

    expect(screen.queryByTestId('saina-delete-chat-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('trigger-delete'));

    expect(screen.getByTestId('saina-delete-chat-modal')).toBeInTheDocument();
    expect(screen.getByText(SAINA_DELETE_CHAT_TITLE)).toBeInTheDocument();
    expect(screen.getByText(SAINA_DELETE_CHAT_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAINA_DELETE_CHAT_CANCEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SAINA_DELETE_CHAT_CONFIRM })).toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it('Vazgeç closes modal without deleting', () => {
    const onConfirmDelete = vi.fn();
    render(<DeleteChatHarness onConfirmDelete={onConfirmDelete} />);

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.click(screen.getByTestId('saina-delete-chat-cancel'));

    expect(screen.queryByTestId('saina-delete-chat-modal')).not.toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it('ESC closes modal without deleting', () => {
    const onConfirmDelete = vi.fn();
    render(<DeleteChatHarness onConfirmDelete={onConfirmDelete} />);

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('saina-delete-chat-modal')).not.toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it('overlay click closes modal without deleting', () => {
    const onConfirmDelete = vi.fn();
    render(<DeleteChatHarness onConfirmDelete={onConfirmDelete} />);

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.click(screen.getByTestId('saina-delete-chat-modal'));

    expect(screen.queryByTestId('saina-delete-chat-modal')).not.toBeInTheDocument();
    expect(onConfirmDelete).not.toHaveBeenCalled();
  });

  it('Sohbeti sil runs delete flow', () => {
    const onConfirmDelete = vi.fn();
    render(<DeleteChatHarness onConfirmDelete={onConfirmDelete} />);

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.click(screen.getByTestId('saina-delete-chat-confirm'));

    expect(screen.queryByTestId('saina-delete-chat-modal')).not.toBeInTheDocument();
    expect(onConfirmDelete).toHaveBeenCalledWith('chat-1');
  });

  it('does not call window.confirm', () => {
    render(
      <SainaDeleteChatModal open onCancel={cancelSpy} onConfirm={confirmSpy} />
    );

    fireEvent.click(screen.getByTestId('saina-delete-chat-confirm'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
