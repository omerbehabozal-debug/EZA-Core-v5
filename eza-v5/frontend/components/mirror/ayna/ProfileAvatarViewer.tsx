'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { buildProfileAvatarDisplaySrc } from '@/lib/eza/profile/avatarDisplayUrl';

export type ProfileAvatarViewerProps = {
  open: boolean;
  displayName: string;
  avatarUrl: string;
  cacheBust?: number | string;
  onClose: () => void;
  onChangePhoto?: () => void;
};

export default function ProfileAvatarViewer({
  open,
  displayName,
  avatarUrl,
  cacheBust,
  onClose,
  onChangePhoto,
}: ProfileAvatarViewerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const src =
    avatarUrl.startsWith('blob:') || avatarUrl.startsWith('data:')
      ? avatarUrl
      : buildProfileAvatarDisplaySrc(avatarUrl, cacheBust);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="bilign-avatar-viewer-backdrop"
      data-testid="profile-avatar-viewer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bilign-avatar-viewer-dialog"
        data-testid="profile-avatar-viewer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="bilign-avatar-viewer-close"
          aria-label="Kapat"
          data-testid="profile-avatar-viewer-close"
          onClick={onClose}
        >
          ×
        </button>
        <h2 id={titleId} className="sr-only">
          {displayName} profil fotoğrafı
        </h2>
        <div className="bilign-avatar-viewer-frame">
          <img
            src={src}
            alt={displayName}
            className="bilign-avatar-viewer-photo"
            data-testid="profile-avatar-viewer-photo"
          />
        </div>
        {onChangePhoto ? (
          <button
            type="button"
            className="bilign-avatar-viewer-change"
            data-testid="profile-avatar-viewer-change"
            onClick={() => {
              onClose();
              onChangePhoto();
            }}
          >
            Fotoğrafı değiştir
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
