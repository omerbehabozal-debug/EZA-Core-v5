'use client';

import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  copyShareText,
  nativeShareIfAvailable,
} from '@/lib/eza/standaloneShare';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const sh = standaloneSkin.share;

interface StandaloneShareModalProps {
  open: boolean;
  onClose: () => void;
  shareTitle: string;
  clipboardText: string;
  children: React.ReactNode;
}

export default function StandaloneShareModal({
  open,
  onClose,
  shareTitle,
  clipboardText,
  children,
}: StandaloneShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setShareError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    const ok = await copyShareText(clipboardText);
    if (ok) {
      setCopied(true);
      setShareError(null);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setShareError('Kopyalanamadı. Metni önizlemeden seçip kopyalayabilirsin.');
    }
  }, [clipboardText]);

  const handleNativeShare = useCallback(async () => {
    const ok = await nativeShareIfAvailable(shareTitle, clipboardText);
    if (!ok) await handleCopy();
  }, [shareTitle, clipboardText, handleCopy]);

  if (!open) return null;

  return (
    <div
      className={sh.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div className={sh.panel} onClick={(e) => e.stopPropagation()}>
        <div className={sh.header}>
          <h2 id="share-modal-title" className={sh.title}>
            Paylaşım önizlemesi
          </h2>
          <button type="button" onClick={onClose} className={sh.closeBtn} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={sh.previewWrap}>{children}</div>

        <div className={sh.actions}>
          <button type="button" onClick={handleCopy} className={sh.primaryBtn}>
            {copied ? 'Kopyalandı' : 'Metni kopyala'}
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button type="button" onClick={handleNativeShare} className={sh.secondaryBtn}>
              Paylaş
            </button>
          ) : null}
        </div>

        {shareError ? <p className={sh.error}>{shareError}</p> : null}
        <p className={sh.hint}>Görsel dışa aktarma bu sürümde yok; metin paylaşımı desteklenir.</p>
      </div>
    </div>
  );
}
