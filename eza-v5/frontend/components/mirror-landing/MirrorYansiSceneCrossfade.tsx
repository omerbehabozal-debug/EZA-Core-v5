'use client';

/**
 * Phase 5.1 — soft scene crossfade between stored Yansı backgrounds.
 * Uses two layers; never regenerates images.
 */

import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type MirrorYansiSceneCrossfadeProps = {
  sceneImageUrl: string | null | undefined;
  className?: string;
  /** mobile-fullscreen = cover; desktop-stage = contain (protect composition). */
  presentation?: 'mobile-fullscreen' | 'desktop-stage';
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export default function MirrorYansiSceneCrossfade({
  sceneImageUrl,
  className,
  presentation = 'mobile-fullscreen',
}: MirrorYansiSceneCrossfadeProps) {
  const nextUrl = (sceneImageUrl || '').trim() || null;
  const [front, setFront] = useState<string | null>(nextUrl);
  const [back, setBack] = useState<string | null>(null);
  const [frontOpacity, setFrontOpacity] = useState(1);
  const isDesktopStage = presentation === 'desktop-stage';
  const imagePositionClass = isDesktopStage
    ? 'yansi-desktop-scene-image object-contain'
    : 'inset-0 h-full w-full object-cover';

  // Layout effect: keep data-testid current layer aligned with active slug in the
  // same commit as Discover ↑/↓ (useEffect left one paint on the previous scene).
  useLayoutEffect(() => {
    if (nextUrl === front) return;
    if (prefersReducedMotion() || !front) {
      setFront(nextUrl);
      setBack(null);
      setFrontOpacity(1);
      return;
    }
    setBack(front);
    setFront(nextUrl);
    setFrontOpacity(0);
    const id = window.setTimeout(() => {
      setFrontOpacity(1);
    }, 20);
    const clear = window.setTimeout(() => setBack(null), 700);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(clear);
    };
  }, [nextUrl, front]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        isDesktopStage && 'yansi-desktop-scene-canvas',
        className
      )}
      data-testid="mirror-yansi-scene-crossfade"
      data-yansi-scene-presentation={presentation}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#0c0b0a]" />
      {back ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={back}
          alt=""
          data-scene-layer="outgoing"
          className={cn('absolute opacity-100', imagePositionClass)}
        />
      ) : null}
      {front ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={front}
          alt=""
          data-scene-layer="current"
          data-testid="mirror-yansi-scene-current"
          className={cn(
            'absolute transition-opacity duration-500 ease-out',
            imagePositionClass
          )}
          style={{ opacity: frontOpacity }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div
        className={cn(
          'absolute inset-0',
          isDesktopStage
            ? 'bg-gradient-to-b from-[#0c0b0a]/40 via-transparent to-[#0c0b0a]/75'
            : 'bg-gradient-to-b from-[#0c0b0a]/55 via-[#0c0b0a]/35 to-[#0c0b0a]/85'
        )}
      />
    </div>
  );
}
