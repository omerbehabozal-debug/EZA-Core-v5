'use client';

import { useEffect, useId, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import {
  SAINA_DELETE_CHAT_CANCEL,
  SAINA_DELETE_CHAT_CONFIRM,
  SAINA_DELETE_CHAT_DESCRIPTION,
  SAINA_DELETE_CHAT_TITLE,
} from '@/lib/eza/sainaCopy';

export type SainaDeleteChatModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SainaDeleteChatModal({
  open,
  onCancel,
  onConfirm,
}: SainaDeleteChatModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="saina-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="saina-delete-chat-modal"
      onClick={onCancel}
    >
      <div
        className="saina-modal-card saina-delete-chat-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="saina-modal-head saina-delete-chat-modal__head">
          <div className="saina-delete-chat-modal__icon" aria-hidden>
            <Trash2 size={20} strokeWidth={1.75} />
          </div>
          <h2 id={titleId} className="saina-modal-title saina-serif saina-delete-chat-modal__title">
            {SAINA_DELETE_CHAT_TITLE}
          </h2>
          <p id={descriptionId} className="saina-mirror-subtitle saina-delete-chat-modal__body">
            {SAINA_DELETE_CHAT_DESCRIPTION}
          </p>
        </div>

        <div className="saina-btn-row saina-modal-actions saina-delete-chat-modal__actions">
          <button
            ref={cancelRef}
            type="button"
            className="saina-secondary-btn saina-secondary-btn--full"
            onClick={onCancel}
            data-testid="saina-delete-chat-cancel"
          >
            {SAINA_DELETE_CHAT_CANCEL}
          </button>
          <button
            type="button"
            className="saina-danger-btn saina-danger-btn--full"
            onClick={onConfirm}
            data-testid="saina-delete-chat-confirm"
          >
            {SAINA_DELETE_CHAT_CONFIRM}
          </button>
        </div>
      </div>
    </div>
  );
}
