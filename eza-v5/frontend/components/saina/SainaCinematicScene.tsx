'use client';

import defaultSceneImage from '../../public/saina/default-conversation-scene.png';

const sceneUrl =
  typeof defaultSceneImage === 'string'
    ? defaultSceneImage
    : (defaultSceneImage as { src: string }).src;

/** Full-width default conversation atmosphere behind chat + mirror columns. */
export default function SainaCinematicScene() {
  return (
    <div className="saina-canvas-bg saina-canvas-bg--default-scene" aria-hidden>
      <div
        className="saina-canvas-scene-image saina-canvas-scene-image--bundled"
        style={{ backgroundImage: `url('${sceneUrl}')` }}
        data-testid="saina-scene-image-layer"
      />
      <div className="saina-canvas-overlay saina-canvas-overlay--left" />
      <div className="saina-canvas-overlay saina-canvas-overlay--center" />
      <div className="saina-canvas-overlay saina-canvas-overlay--pattern-dim" />
      <div className="saina-canvas-overlay saina-canvas-overlay--right" />
      <div className="saina-canvas-vignette saina-canvas-vignette--scene" />
    </div>
  );
}
