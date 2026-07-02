'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MirrorPosterLightboxProps = {
  open: boolean;
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
};

/** Full-size poster view — opened from embedded sidebar preview. */
export default function MirrorPosterLightbox({
  open,
  imageUrl,
  title,
  onClose,
}: MirrorPosterLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open || !imageUrl?.trim()) return null;

  return createPortal(
    <div
      className="saina-mirror-poster-lightbox fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title?.trim() || 'Ayna posteri'}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full',
          'border border-white/20 bg-black/50 text-white/90',
          'transition-colors hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60'
        )}
        aria-label="Kapat"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="flex max-h-full max-w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title?.trim() || 'SAINA Ayna posteri'}
          className="max-h-[min(92vh,1350px)] max-w-[min(92vw,1080px)] h-auto w-auto object-contain rounded-xl shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body
  );
}
