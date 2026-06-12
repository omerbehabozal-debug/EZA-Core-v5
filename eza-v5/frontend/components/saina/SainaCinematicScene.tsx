'use client';

import type { CSSProperties } from 'react';
import { DEFAULT_SAINA_CONVERSATION_SCENE } from '@/lib/eza/sainaSkin';

/** Full-width default conversation atmosphere behind chat + mirror columns. */
export default function SainaCinematicScene() {
  const sceneStyle = {
    '--saina-default-scene': `url('${DEFAULT_SAINA_CONVERSATION_SCENE}')`,
  } as CSSProperties;

  return (
    <div
      className="saina-canvas-bg saina-canvas-bg--default-scene"
      style={sceneStyle}
      aria-hidden
    >
      <div className="saina-canvas-scene-image" />
      <div className="saina-canvas-overlay saina-canvas-overlay--left" />
      <div className="saina-canvas-overlay saina-canvas-overlay--center" />
      <div className="saina-canvas-overlay saina-canvas-overlay--pattern-dim" />
      <div className="saina-canvas-overlay saina-canvas-overlay--right" />
      <div className="saina-canvas-vignette saina-canvas-vignette--scene" />
    </div>
  );
}
