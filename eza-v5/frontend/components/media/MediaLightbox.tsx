'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MediaLightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  /** Defaults to image. Video keeps native controls inside a contain-fit viewport shell. */
  kind?: 'image' | 'video';
  onClose: () => void;
  /**
   * Optional stream reauthorization for ticketed library videos.
   * Called on media error or shortly before streamExpiresAt so pause/seek/resume
   * can continue without permanent public URLs.
   */
  renewVideoSrc?: () => Promise<string | null>;
  /** Unix epoch seconds when the current ticketed stream URL expires. */
  streamExpiresAt?: number | null;
};

function bufferedAhead(video: HTMLVideoElement): boolean {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return true;
  try {
    const { buffered, currentTime } = video;
    for (let i = 0; i < buffered.length; i += 1) {
      if (buffered.start(i) <= currentTime + 0.25 && buffered.end(i) > currentTime + 1) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Full-size media view with object-fit: contain. Used by library cards and Yansı chat. */
export default function MediaLightbox({
  open,
  src,
  alt = '',
  kind = 'image',
  onClose,
  renewVideoSrc,
  streamExpiresAt = null,
}: MediaLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const renewInFlight = useRef(false);
  const pendingSrcRef = useRef<string | null>(null);
  const renewVideoSrcRef = useRef(renewVideoSrc);
  renewVideoSrcRef.current = renewVideoSrc;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveSrc(src);
    pendingSrcRef.current = null;
  }, [src]);

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

  async function applyRenewedSrc(next: string) {
    const video = videoRef.current;
    const resumeAt = video?.currentTime || 0;
    const wasPaused = video ? video.paused : true;
    pendingSrcRef.current = null;
    setActiveSrc(next);
    requestAnimationFrame(() => {
      const node = videoRef.current;
      if (!node) return;
      const restore = () => {
        try {
          if (Number.isFinite(resumeAt) && resumeAt > 0) node.currentTime = resumeAt;
        } catch {
          /* ignore seek races while metadata loads */
        }
        if (!wasPaused) {
          void node.play().catch(() => undefined);
        }
      };
      if (node.readyState >= 1) restore();
      else node.addEventListener('loadedmetadata', restore, { once: true });
    });
  }

  async function renewStream(reason: 'error' | 'expiry' | 'resume') {
    const renew = renewVideoSrcRef.current;
    if (!renew || renewInFlight.current) return false;
    renewInFlight.current = true;
    try {
      const next = await renew();
      if (!next?.trim()) return false;
      if (next === activeSrc) return false;
      const video = videoRef.current;
      // Keep an already-buffered playback on the old URL; stash the fresh ticket
      // until seek/resume/error actually needs a new Range request.
      if (reason === 'expiry' && video && !video.paused && !video.seeking && bufferedAhead(video)) {
        pendingSrcRef.current = next;
        return true;
      }
      await applyRenewedSrc(next);
      return true;
    } catch {
      return false;
    } finally {
      renewInFlight.current = false;
    }
  }

  function adoptPendingOrRenew(reason: 'error' | 'resume') {
    const pending = pendingSrcRef.current;
    if (pending && pending !== activeSrc) {
      void applyRenewedSrc(pending);
      return;
    }
    void renewStream(reason);
  }

  useEffect(() => {
    if (!open || kind !== 'video' || !renewVideoSrc || !streamExpiresAt) return;
    const msUntilExpiry = streamExpiresAt * 1000 - Date.now();
    const delay = Math.max(5_000, msUntilExpiry - 30_000);
    const timer = window.setTimeout(() => {
      void renewStream('expiry');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [open, kind, renewVideoSrc, streamExpiresAt, activeSrc]);

  if (!mounted || !open || !src?.trim()) return null;

  const label = alt.trim() || (kind === 'video' ? 'Video önizleme' : 'Görsel önizleme');
  const videoSrc = activeSrc?.trim() || src.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
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
      {kind === 'video' ? (
        <div
          className="flex max-h-[min(92vh,1200px)] max-w-[min(92vw,1200px)] items-center justify-center bg-black"
          data-testid="media-lightbox-video-shell"
          onClick={(event) => event.stopPropagation()}
        >
          <video
            ref={videoRef}
            key={videoSrc}
            src={videoSrc}
            controls
            playsInline
            autoPlay
            preload="metadata"
            className="max-h-[min(92vh,1200px)] max-w-[min(92vw,1200px)] h-auto w-auto object-contain"
            data-testid="media-lightbox-video"
            aria-label={label}
            onError={() => adoptPendingOrRenew('error')}
            onWaiting={() => {
              if (pendingSrcRef.current) adoptPendingOrRenew('resume');
            }}
            onPlay={() => {
              if (pendingSrcRef.current) adoptPendingOrRenew('resume');
            }}
            onSeeking={() => {
              if (pendingSrcRef.current) adoptPendingOrRenew('resume');
            }}
          />
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          className="max-h-[min(92vh,1200px)] max-w-[min(92vw,1200px)] h-auto w-auto rounded-xl object-contain shadow-2xl"
          data-testid="media-lightbox-image"
          onClick={(event) => event.stopPropagation()}
        />
      )}
    </div>,
    document.body,
  );
}
