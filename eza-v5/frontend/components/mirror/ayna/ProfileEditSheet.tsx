'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useAuth } from '@/context/AuthContext';
import { patchPublicIdentity } from '@/lib/eza/plan/fetchAuthMe';
import {
  PUBLIC_DISPLAY_NAME_FALLBACK,
  PUBLIC_DISPLAY_NAME_MAX_LEN,
} from '@/lib/eza/mirror/publicIdentity';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

type Props = {
  open: boolean;
  onClose: () => void;
  initialName: string;
  onSaved: (resolvedName: string) => void;
  /** Phase 8.5B.1 — restore focus to Profili düzenle (or caller trigger). */
  returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Phase 8.5B — minimal public display-name editor (sheet / modal).
 * Name only — no avatar upload, bio, or interests.
 * Phase 8.5B.1 — focus trap + focus return via useModalFocusTrap.
 */
export default function ProfileEditSheet({
  open,
  onClose,
  initialName,
  onSaved,
  returnFocusRef,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { token, user, setAuth } = useAuth();
  const [draft, setDraft] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      initialName === PUBLIC_DISPLAY_NAME_FALLBACK ? '' : initialName.trim()
    );
    setError(null);
    setBusy(false);
  }, [open, initialName]);

  useModalFocusTrap({
    open,
    onClose,
    containerRef: panelRef,
    initialFocusRef: inputRef,
    returnFocusRef,
  });

  if (!open) return null;

  const save = async () => {
    if (!token || !user) return;
    setBusy(true);
    setError(null);
    const result = await patchPublicIdentity(draft);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.code === 'display_name_looks_like_email'
          ? 'E-posta adresi kullanılamaz.'
          : result.code === 'display_name_too_short'
            ? 'En az 2 karakter girin.'
            : result.code === 'display_name_too_long'
              ? 'En fazla 48 karakter.'
              : result.code === 'display_name_reserved'
                ? 'Bu ad kullanılamaz.'
                : 'Kaydedilemedi. Tekrar deneyin.'
      );
      return;
    }
    setAuth(token, {
      ...user,
      public_display_name: result.public_display_name,
      full_name: result.public_display_name,
    });
    onSaved(result.resolved_public_display_name);
    onClose();
  };

  return (
    <div
      className="bilign-profile-edit-backdrop"
      role="presentation"
      onClick={onClose}
      data-testid="bilign-profile-edit-backdrop"
    >
      <div
        ref={panelRef}
        className="bilign-profile-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        data-testid="bilign-profile-edit-sheet"
      >
        <h2 id={titleId} className="bilign-profile-edit-title">
          Profili düzenle
        </h2>
        <label className="bilign-profile-edit-label" htmlFor="bilign-public-name">
          Görünen ad
        </label>
        <input
          ref={inputRef}
          id="bilign-public-name"
          type="text"
          className="bilign-profile-edit-input"
          value={draft}
          maxLength={PUBLIC_DISPLAY_NAME_MAX_LEN}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={PUBLIC_DISPLAY_NAME_FALLBACK}
          autoComplete="nickname"
          data-testid="bilign-profile-edit-input"
        />
        <p className="bilign-profile-edit-note">
          Başkaları profilinizde bu adı görür. E-posta asla isim olarak yayınlanmaz.
        </p>
        {error ? (
          <p className="bilign-profile-edit-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="bilign-profile-edit-actions">
          <button
            type="button"
            className="bilign-profile-edit-btn bilign-profile-edit-btn--ghost"
            onClick={onClose}
            disabled={busy}
            data-testid="bilign-profile-edit-cancel"
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="bilign-profile-edit-btn bilign-profile-edit-btn--primary"
            onClick={() => void save()}
            disabled={busy}
            data-testid="bilign-profile-edit-save"
          >
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
