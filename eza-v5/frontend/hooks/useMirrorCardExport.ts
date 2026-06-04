'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  copyMirrorShareText,
  downloadMirrorCardPng,
  exportMirrorCardToPng,
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
    async (options?: MirrorExportOptions): Promise<Blob | null> => {
      const node = cardRef.current?.querySelector<HTMLElement>('[data-mirror-card-root]');
      const target = node ?? cardRef.current;
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
      const blob = exportBlob ?? (await captureCard());
      if (!blob) return 'failed';

      const text = resolveMirrorShareText(card);
      const filename = resolveMirrorExportFilename(card, card?.date);
      const result = await shareMirrorCardPng(blob, {
        title: 'EZA · AI İlişki Aynası',
        text,
        filename,
      });

      if (result === 'unsupported' || result === 'failed') {
        downloadMirrorCardPng(blob, filename);
        return 'downloaded';
      }
      return result;
    },
    [captureCard, exportBlob]
  );

  const copyText = useCallback(async (card?: DailyMirrorCardModel | null): Promise<boolean> => {
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
