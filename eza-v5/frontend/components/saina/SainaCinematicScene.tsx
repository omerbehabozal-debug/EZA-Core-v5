'use client';

import defaultSceneImage from '../../public/saina/default-conversation-scene.png';
import { SCENE_ENTRANCE_LAMPS, SCENE_IMAGE_ASPECT } from '@/lib/eza/sceneLampPositions';

const sceneUrl =
  typeof defaultSceneImage === 'string'
    ? defaultSceneImage
    : (defaultSceneImage as { src: string }).src;

/** Full-width default conversation atmosphere behind chat + mirror columns. */
export default function SainaCinematicScene() {
  return (
    <div className="saina-canvas-bg saina-canvas-bg--default-scene" aria-hidden>
      <div className="saina-scene-fit">
        <div
          className="saina-scene-fit__frame"
          style={{ aspectRatio: `${SCENE_IMAGE_ASPECT}` }}
        >
          <div
            className="saina-canvas-scene-image saina-canvas-scene-image--bundled"
            style={{ backgroundImage: `url('${sceneUrl}')` }}
            data-testid="saina-scene-image-layer"
          />
        </div>
      </div>

      <div className="saina-canvas-overlay saina-canvas-overlay--left" />
      <div className="saina-canvas-overlay saina-canvas-overlay--center" />
      <div className="saina-canvas-overlay saina-canvas-overlay--pattern-dim" />
      <div className="saina-canvas-overlay saina-canvas-overlay--right" />
      <div className="saina-canvas-vignette saina-canvas-vignette--scene" />
      <div className="saina-scene-live" data-testid="saina-scene-live">
        <div className="saina-scene-fit saina-scene-fit--lamps">
          <div
            className="saina-scene-fit__frame"
            style={{ aspectRatio: `${SCENE_IMAGE_ASPECT}` }}
          >
            <div className="saina-scene-live__lamps" data-testid="saina-scene-live-lamps">
              {SCENE_ENTRANCE_LAMPS.map((lamp) => (
                <span
                  key={lamp.id}
                  className="saina-scene-live__lamp"
                  data-lamp-id={lamp.id}
                  style={{
                    left: `${lamp.x}%`,
                    top: `${lamp.y}%`,
                    width: `${lamp.w}%`,
                    height: `${lamp.h}%`,
                    ['--lamp-core' as string]: lamp.color,
                    animationDelay: `${lamp.delay}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
