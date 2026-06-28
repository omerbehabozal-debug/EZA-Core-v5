'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Share2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { canShareFiles } from '@/lib/eza/mirror/shareExport';
import { resolveMirrorShareCaption } from '@/lib/eza/mirror-share/resolveMirrorShareCaption';
import {
  SHARE_EXPERIENCE_CAPTION_LABEL,
  SHARE_EXPERIENCE_COPY_CTA,
  SHARE_EXPERIENCE_COPY_DONE,
  SHARE_EXPERIENCE_NATIVE_CTA,
  SHARE_EXPERIENCE_PREVIEW_EMPTY,
  SHARE_EXPERIENCE_PREVIEW_LOADING,
  SHARE_EXPERIENCE_PRIVACY,
  SHARE_EXPERIENCE_SUBTITLE,
  SHARE_EXPERIENCE_TITLE,
  SHARE_LINK_PREPARE_FAILED,
  SHARE_LINK_PREPARE_RETRY,
  SHARE_LINK_PREPARING,
} from '@/lib/eza/mirror-share/shareExperienceCopy';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

const sh = standaloneSkin.share;

export type MirrorShareLinkStatus = 'idle' | 'preparing' | 'ready' | 'failed';

export interface MirrorShareExperienceProps {
  open: boolean;
  onClose: () => void;
  card: DailyMirrorCardModel | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  shareLinkStatus?: MirrorShareLinkStatus;
  shareLinkError?: string | null;
  onRetryShareLink?: () => void;
  onCapture: () => Promise<void>;
  onShare: () => Promise<void>;
  onCopyText: () => Promise<boolean>;
}

/**
 * Stage 4B — Share Experience: prepares, never celebrates.
 */
export default function MirrorShareExperience({
  open,
  onClose,
  card,
  previewUrl,
  loading,
  error,
  shareLinkStatus = 'idle',
  shareLinkError = null,
  onRetryShareLink,
  onCapture,
  onShare,
  onCopyText,
}: MirrorShareExperienceProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'share' | null>(null);
  const fileShareAvailable = canShareFiles();

  const captionPreview = card ? resolveMirrorShareCaption(card) : '';
  const hasShareUrl = Boolean(card?.mirrorShare?.shareUrl);
  const shareLinkBusy = shareLinkStatus === 'preparing';
  const shareLinkFailed = shareLinkStatus === 'failed';

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
      aria-labelledby="mirror-share-experience-title"
      data-testid="mirror-share-experience"
      onClick={onClose}
    >
      <div
        className={cn(sh.panel, 'max-h-[min(92vh,760px)] w-[min(100%,28rem)]')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={sh.header}>
          <div>
            <h2 id="mirror-share-experience-title" className={sh.title}>
              {SHARE_EXPERIENCE_TITLE}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">{SHARE_EXPERIENCE_SUBTITLE}</p>
          </div>
          <button type="button" onClick={onClose} className={sh.closeBtn} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            sh.previewWrap,
            'flex min-h-[10rem] items-center justify-center bg-stone-100/80'
          )}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" aria-hidden />
              <p className="text-sm">{SHARE_EXPERIENCE_PREVIEW_LOADING}</p>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="max-h-[min(40vh,360px)] w-full rounded-xl object-contain shadow-md"
            />
          ) : (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              {SHARE_EXPERIENCE_PREVIEW_EMPTY}
            </p>
          )}
        </div>

        <div className="px-5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            {SHARE_EXPERIENCE_CAPTION_LABEL}
          </p>
          <pre
            className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-200/80 bg-stone-50/90 p-3 text-xs leading-relaxed text-stone-700"
            data-testid="mirror-share-caption-preview"
          >
            {captionPreview}
          </pre>
          {!hasShareUrl && shareLinkBusy ? (
            <p className="mt-2 text-[11px] text-stone-400">{SHARE_LINK_PREPARING}</p>
          ) : null}
          {shareLinkFailed ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-stone-500">
                {shareLinkError ?? SHARE_LINK_PREPARE_FAILED}
              </p>
              {onRetryShareLink ? (
                <button
                  type="button"
                  onClick={onRetryShareLink}
                  className="text-[11px] font-medium text-violet-600 hover:text-violet-700"
                  data-testid="mirror-share-link-retry"
                >
                  {SHARE_LINK_PREPARE_RETRY}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? <p className={sh.error}>{error}</p> : null}

        <div className={cn(sh.actions, 'flex-col sm:flex-row')}>
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button
              type="button"
              onClick={handleShare}
              disabled={loading || !previewUrl || busy !== null || !hasShareUrl || shareLinkBusy}
              className={cn(sh.primaryBtn, 'inline-flex items-center justify-center gap-2')}
              data-testid="mirror-share-native"
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden />
              )}
              {SHARE_EXPERIENCE_NATIVE_CTA}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || busy !== null}
            className={cn(sh.secondaryBtn, 'sm:flex-1')}
          >
            {copied ? SHARE_EXPERIENCE_COPY_DONE : SHARE_EXPERIENCE_COPY_CTA}
          </button>
        </div>

        <p className={sh.hint}>{SHARE_EXPERIENCE_PRIVACY}</p>
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
