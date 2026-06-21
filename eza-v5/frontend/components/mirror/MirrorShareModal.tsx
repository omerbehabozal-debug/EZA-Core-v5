'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Share2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MIRROR_SHARE_EXPORT_PRIVACY,
  MIRROR_SHARE_LABEL,
  MIRROR_SHARE_MODAL_TITLE,
} from '@/lib/eza/mirror/copy';
import { canShareFiles } from '@/lib/eza/mirror/shareExport';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const sh = standaloneSkin.share;

export interface MirrorShareModalProps {
  open: boolean;
  onClose: () => void;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  onCapture: () => Promise<void>;
  onShare: () => Promise<void>;
  onCopyText: () => Promise<boolean>;
}

export default function MirrorShareModal({
  open,
  onClose,
  previewUrl,
  loading,
  error,
  onCapture,
  onShare,
  onCopyText,
}: MirrorShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'share' | null>(null);
  const fileShareAvailable = canShareFiles();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setBusy(null);
      return;
    }
    void onCapture();
  }, [open, onCapture]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    const ok = await onCopyText();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [onCopyText]);

  const handleShare = useCallback(async () => {
    setBusy('share');
    try {
      await onShare();
    } finally {
      setBusy(null);
    }
  }, [onShare]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={sh.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mirror-share-modal-title"
      onClick={onClose}
    >
      <div
        className={cn(sh.panel, 'max-h-[min(92vh,720px)] w-[min(100%,28rem)]')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={sh.header}>
          <h2 id="mirror-share-modal-title" className={sh.title}>
            {MIRROR_SHARE_MODAL_TITLE}
          </h2>
          <button type="button" onClick={onClose} className={sh.closeBtn} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            sh.previewWrap,
            'flex min-h-[12rem] items-center justify-center bg-stone-100/80'
          )}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" aria-hidden />
              <p className="text-sm">Kart görseli hazırlanıyor…</p>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Günlük Ayna kart önizlemesi"
              className="max-h-[min(50vh,420px)] w-full rounded-xl object-contain shadow-md"
            />
          ) : (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              Önizleme henüz hazır değil.
            </p>
          )}
        </div>

        {error ? <p className={sh.error}>{error}</p> : null}

        <div className={cn(sh.actions, 'flex-col sm:flex-row')}>
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button
              type="button"
              onClick={handleShare}
              disabled={loading || !previewUrl || busy !== null}
              className={cn(sh.primaryBtn, 'inline-flex items-center justify-center gap-2')}
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden />
              )}
              {MIRROR_SHARE_LABEL}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || busy !== null}
            className={cn(sh.secondaryBtn, 'sm:flex-1')}
          >
            {copied ? 'Metin kopyalandı' : 'Metni kopyala'}
          </button>
        </div>

        <p className={sh.hint}>{MIRROR_SHARE_EXPORT_PRIVACY}</p>
        {!fileShareAvailable && typeof navigator !== 'undefined' && 'share' in navigator ? (
          <p className="text-center text-[11px] text-stone-400">
            Bu cihazda görsel doğrudan paylaşılamayabilir; metni kopyalayabilirsin.
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
