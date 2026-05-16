'use client';

import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface StandaloneSessionEndDialogProps {
  open: boolean;
  onKeep: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export default function StandaloneSessionEndDialog({
  open,
  onKeep,
  onDelete,
  onCancel,
}: StandaloneSessionEndDialogProps) {
  if (!open) return null;

  return (
    <div
      className={standaloneSkin.sessionDialogBackdrop}
      role="presentation"
      onClick={onCancel}
    >
      <div
        className={standaloneSkin.sessionDialogPanel}
        role="dialog"
        aria-labelledby="session-end-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="session-end-title" className={standaloneSkin.sessionDialogTitle}>
          Sohbet kaydedildi
        </h2>
        <p className={standaloneSkin.sessionDialogBody}>
          Bu oturum tarayıcınızda otomatik saklandı. Sayfayı kapatsanız bile geri dönebilirsiniz.
          Arşivde tutmak istemiyorsanız silebilirsiniz.
        </p>
        <div className={standaloneSkin.sessionDialogActions}>
          <button type="button" className={standaloneSkin.sessionDialogPrimary} onClick={onKeep}>
            Arşivde tut
          </button>
          <button type="button" className={standaloneSkin.sessionDialogDanger} onClick={onDelete}>
            Sil ve yeni sohbet
          </button>
          <button type="button" className={standaloneSkin.sessionDialogGhost} onClick={onCancel}>
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
