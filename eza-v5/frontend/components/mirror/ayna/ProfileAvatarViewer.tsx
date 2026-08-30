'use client';

import { useCallback, useEffect, useId, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { buildProfileAvatarDisplaySrc } from '@/lib/eza/profile/avatarDisplayUrl';

export type ProfileAvatarViewerProps = {
  open: boolean;
  displayName: string;
  avatarUrl: string;
  cacheBust?: number | string;
  onClose: () => void;
  onChangePhoto?: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export default function ProfileAvatarViewer({
  open,
  displayName,
  avatarUrl,
  cacheBust,
  onClose,
  onChangePhoto,
  returnFocusRef,
}: ProfileAvatarViewerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const src =
    avatarUrl.startsWith('blob:') || avatarUrl.startsWith('data:')
      ? avatarUrl
      : buildProfileAvatarDisplaySrc(avatarUrl, cacheBust);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useModalFocusTrap({
    open,
    onClose: handleClose,
    containerRef: dialogRef,
    initialFocusRef: closeRef,
    returnFocusRef,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="bilign-avatar-viewer-backdrop"
      data-testid="profile-avatar-viewer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
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
          onClick={handleClose}
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
              handleClose();
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
