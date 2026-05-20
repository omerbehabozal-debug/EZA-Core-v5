'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  copyMirrorShareText,
  downloadMirrorCardPng,
  exportMirrorCardToPng,
  getMirrorShareTexts,
  MIRROR_EXPORT_ERROR_MESSAGE,
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
    async (dateIso?: string) => {
      const blob = exportBlob ?? (await captureCard());
      if (!blob) return false;
      downloadMirrorCardPng(blob, dateIso ? `eza-mirror-${dateIso.slice(0, 10)}.png` : undefined);
      return true;
    },
    [captureCard, exportBlob]
  );

  const share = useCallback(
    async (dateIso?: string): Promise<MirrorShareResult> => {
      const blob = exportBlob ?? (await captureCard());
      if (!blob) return 'failed';

      const texts = getMirrorShareTexts();
      const result = await shareMirrorCardPng(blob, {
        title: 'EZA Mirror',
        text: texts.short,
        filename: dateIso ? `eza-mirror-${dateIso.slice(0, 10)}.png` : undefined,
      });

      if (result === 'unsupported' || result === 'failed') {
        downloadMirrorCardPng(blob);
        return 'downloaded';
      }
      return result;
    },
    [captureCard, exportBlob]
  );

  const copyText = useCallback(async (): Promise<boolean> => {
    const texts = getMirrorShareTexts();
    return copyMirrorShareText(texts.short);
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
