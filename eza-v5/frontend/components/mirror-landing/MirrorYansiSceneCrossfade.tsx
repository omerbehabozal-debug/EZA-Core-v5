'use client';

/**
 * Phase 5.1 — soft scene crossfade between stored Yansı backgrounds.
 * Uses two layers; never regenerates images.
 *
 * Desktop immersive: environment + focus field from the same cover crop.
 * Layers stay spatially locked; chat changes depth, not composition.
 */

import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type MirrorYansiScenePresentation = 'mobile-fullscreen' | 'desktop-immersive';

export type MirrorYansiSceneCrossfadeProps = {
  sceneImageUrl: string | null | undefined;
  className?: string;
  /** mobile-fullscreen = cover; desktop-immersive = shared-crop focus field. */
  presentation?: MirrorYansiScenePresentation;
  /** Active Yansı identity — must match title/author/meta after navigation commit. */
  activeIdentity?: string | null;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

function ScenePlate({
  src,
  layer,
  testId,
  presentation,
}: {
  src: string;
  layer: 'outgoing' | 'current';
  testId?: string;
  presentation: MirrorYansiScenePresentation;
}) {
  const immersive = presentation === 'desktop-immersive';
  return (
    <div
      className={cn('absolute inset-0', immersive && 'yansi-desktop-scene-stack')}
      data-scene-layer={layer}
    >
      {immersive ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="yansi-desktop-scene-bleed"
            data-yansi-layer="atmosphere"
            aria-hidden
          />
          <div className="yansi-desktop-scene-bleed-dim" aria-hidden />
        </>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        data-testid={testId}
        data-yansi-plate={immersive ? 'sharp' : undefined}
        data-yansi-scene-src={src}
        className={
          immersive
            ? 'yansi-desktop-scene-image'
            : 'absolute inset-0 h-full w-full object-cover'
        }
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}

export default function MirrorYansiSceneCrossfade({
  sceneImageUrl,
  className,
  presentation = 'mobile-fullscreen',
  activeIdentity = null,
}: MirrorYansiSceneCrossfadeProps) {
  const nextUrl = (sceneImageUrl || '').trim() || null;
  const nextIdentity = (activeIdentity || '').trim().toLowerCase() || null;
  const [front, setFront] = useState<string | null>(nextUrl);
  const [frontIdentity, setFrontIdentity] = useState<string | null>(nextIdentity);
  const [back, setBack] = useState<string | null>(null);
  const [frontOpacity, setFrontOpacity] = useState(1);
  const immersive = presentation === 'desktop-immersive';

  useLayoutEffect(() => {
    const identityChanged = nextIdentity !== frontIdentity;
    if (!identityChanged && nextUrl === front) return;
    // After an identity commit, the current plate may only show that identity's URL.
    if (identityChanged || prefersReducedMotion() || !front) {
      setFront(nextUrl);
      setFrontIdentity(nextIdentity);
      setBack(identityChanged && front && front !== nextUrl ? front : null);
      setFrontOpacity(1);
      if (identityChanged && front && front !== nextUrl && !prefersReducedMotion()) {
        const clear = window.setTimeout(() => setBack(null), 700);
        return () => window.clearTimeout(clear);
      }
      setBack(null);
      return;
    }
    setBack(front);
    setFront(nextUrl);
    setFrontIdentity(nextIdentity);
    setFrontOpacity(0);
    const id = window.setTimeout(() => {
      setFrontOpacity(1);
    }, 20);
    const clear = window.setTimeout(() => setBack(null), 700);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(clear);
    };
  }, [nextUrl, nextIdentity, front, frontIdentity]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        immersive && 'yansi-desktop-scene-canvas',
        className
      )}
      data-testid="mirror-yansi-scene-crossfade"
      data-yansi-scene-presentation={presentation}
      data-yansi-scene-crop={immersive ? 'shared-cover' : undefined}
      data-yansi-scene-slug={activeIdentity || undefined}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#0c0b0a]" />
      {back ? (
        <ScenePlate src={back} layer="outgoing" presentation={presentation} />
      ) : null}
      {front ? (
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-500 ease-out',
            immersive && 'yansi-desktop-scene-stack'
          )}
          style={{ opacity: frontOpacity }}
        >
          <ScenePlate
            src={front}
            layer="current"
            testId="mirror-yansi-scene-current"
            presentation={presentation}
          />
        </div>
      ) : null}
      <div
        className={cn(
          'absolute inset-0',
          immersive ? 'yansi-desktop-scene-blend' : 'bg-gradient-to-b from-[#0c0b0a]/55 via-[#0c0b0a]/35 to-[#0c0b0a]/85'
        )}
      />
    </div>
  );
}
