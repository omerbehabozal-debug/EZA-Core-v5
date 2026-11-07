'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type MediaLightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
};

/** Full-size image view with object-fit: contain. Used by library cards and Yansı chat. */
export default function MediaLightbox({ open, src, alt = '', onClose }: MediaLightboxProps) {
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
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open || !src?.trim()) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={alt.trim() || 'Görsel önizleme'}
      data-testid="media-lightbox"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 inline-flex min-h-10 items-center rounded-full border border-white/20 bg-black/50 px-3 text-sm text-white/90 hover:bg-black/70"
        aria-label="Kapat"
        onClick={onClose}
      >
        Kapat
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[min(92vh,1200px)] max-w-[min(92vw,1200px)] h-auto w-auto rounded-xl object-contain shadow-2xl"
        data-testid="media-lightbox-image"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
