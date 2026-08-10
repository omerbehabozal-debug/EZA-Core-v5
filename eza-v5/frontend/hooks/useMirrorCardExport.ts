'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  copyMirrorShareText,
  downloadMirrorCardPng,
  exportMirrorCardToPng,
  resolveMirrorExportCaptureNode,
  getMirrorShareTexts,
  MIRROR_EXPORT_ERROR_MESSAGE,
  resolveMirrorExportFilename,
  resolveMirrorShareText,
  type MirrorExportOptions,
  type MirrorShareResult,
  shareMirrorCardPng,
} from '@/lib/eza/mirror/shareExport';

export function useMirrorCardExport() {
  const cardRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const captureCard = useCallback(
    async (
      options?: MirrorExportOptions & { node?: HTMLElement | null }
    ): Promise<Blob | null> => {
      const target = resolveMirrorExportCaptureNode(
        options?.node ?? cardRef.current
      );
      if (!target) {
        setError(MIRROR_EXPORT_ERROR_MESSAGE);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const blob = await exportMirrorCardToPng(target, options);
        setExportBlob(blob);
        revokePreview();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        return blob;
      } catch {
        setError(MIRROR_EXPORT_ERROR_MESSAGE);
        setExportBlob(null);
        revokePreview();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [revokePreview]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setExportBlob(null);
    revokePreview();
  }, [revokePreview]);

  useEffect(() => () => revokePreview(), [revokePreview]);

  const download = useCallback(
    async (card?: DailyMirrorCardModel | null) => {
      const blob = exportBlob ?? (await captureCard());
      if (!blob) return false;
      const filename = resolveMirrorExportFilename(card, card?.date);
      downloadMirrorCardPng(blob, filename);
      return true;
    },
    [captureCard, exportBlob]
  );

  const share = useCallback(
    async (card?: DailyMirrorCardModel | null): Promise<MirrorShareResult> => {
      const text = resolveMirrorShareText(card);
      const publicUrl = card?.mirrorShare?.shareUrl?.trim() || null;
      const shareTitle =
        card?.mirrorShare?.publicTitle?.trim() ||
        card?.dailyThemeTitle?.trim() ||
        card?.headline?.trim() ||
        'EZA · AI İlişki Aynası';

      const blob = exportBlob ?? (await captureCard());
      if (blob) {
        const filename = resolveMirrorExportFilename(card, card?.date);
        const result = await shareMirrorCardPng(blob, {
          title: shareTitle,
          text,
          filename,
        });
        if (result === 'aborted') return 'aborted';
        if (result === 'shared') return 'shared';
      } else if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: shareTitle,
            text,
            ...(publicUrl ? { url: publicUrl } : {}),
          });
          return 'shared';
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return 'aborted';
          }
        }
      }

      // Fallback: copy public URL (or caption text), never auto-download.
      const copyPayload = publicUrl || text;
      const copied = await copyMirrorShareText(copyPayload);
      return copied ? 'copied' : 'failed';
    },
    [captureCard, exportBlob]
  );

  const copyText = useCallback(async (card?: DailyMirrorCardModel | null): Promise<boolean> => {
    const publicUrl = card?.mirrorShare?.shareUrl?.trim();
    if (publicUrl) {
      return copyMirrorShareText(publicUrl);
    }
    return copyMirrorShareText(resolveMirrorShareText(card));
  }, []);

  return {
    cardRef,
    previewUrl,
    exportBlob,
    loading,
    error,
    captureCard,
    download,
    share,
    copyText,
    reset,
  };
}
