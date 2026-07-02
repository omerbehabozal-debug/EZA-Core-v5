'use client';

import { useCallback, useState } from 'react';
import SainaDeleteChatModal from '@/components/saina/SainaDeleteChatModal';

export type UseSainaDeleteChatModalOptions = {
  onConfirmDelete: (id: string) => void;
};

export function useSainaDeleteChatModal({ onConfirmDelete }: UseSainaDeleteChatModalOptions) {
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  const requestDelete = useCallback((id: string) => {
    setPendingChatId(id);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingChatId(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingChatId) return;
    const id = pendingChatId;
    setPendingChatId(null);
    onConfirmDelete(id);
  }, [onConfirmDelete, pendingChatId]);

  const deleteModal = (
    <SainaDeleteChatModal
      open={pendingChatId != null}
      onCancel={cancelDelete}
      onConfirm={confirmDelete}
    />
  );

  return {
    requestDelete,
    cancelDelete,
    confirmDelete,
    pendingChatId,
    deleteModal,
  };
}
