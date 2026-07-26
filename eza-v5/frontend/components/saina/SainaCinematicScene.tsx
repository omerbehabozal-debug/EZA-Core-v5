'use client';

import { useEffect, useState } from 'react';
import defaultSceneImage from '../../public/saina/default-conversation-scene.png';
import analysisAtmosphereImage from '../../public/saina/analysis-atmosphere.png';
import { SCENE_ENTRANCE_LAMPS, SCENE_IMAGE_ASPECT } from '@/lib/eza/sceneLampPositions';
import {
  mirrorFocalCssVars,
  type MirrorSceneFocalPoint,
} from '@/lib/eza/mirror/mirrorSceneFocal';
import { cn } from '@/lib/utils';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';

const defaultSceneUrl =
  typeof defaultSceneImage === 'string'
    ? defaultSceneImage
    : (defaultSceneImage as { src: string }).src;

const analysisAtmosphereUrl =
  typeof analysisAtmosphereImage === 'string'
    ? analysisAtmosphereImage
    : (analysisAtmosphereImage as { src: string }).src;

const IDENTITY_FADE_MS = 420;

export type SainaSceneAtmosphere = 'conversation' | 'analysis';

type SainaCinematicSceneProps = {
  sceneImageUrl?: string | null;
  /** Optional 0–1 focal; omitted → safe center (legacy images). */
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Fixed surface atmosphere. `analysis` locks Keşfet / EZA to a static architectural
   * backdrop — chat/mirror identity scenes never appear.
   */
  atmosphere?: SainaSceneAtmosphere;
};

/** Full-width conversation atmosphere — default scene with optional Ayna identity crossfade. */
export default function SainaCinematicScene({
  sceneImageUrl,
  focalX,
  focalY,
  atmosphere = 'conversation',
}: SainaCinematicSceneProps) {
  const lockedAnalysis = atmosphere === 'analysis';
  const bundledSceneUrl = lockedAnalysis ? analysisAtmosphereUrl : defaultSceneUrl;

  const identityUrl =
    !lockedAnalysis && sceneImageUrl && isPersistableConversationSceneUrl(sceneImageUrl)
      ? sceneImageUrl.trim()
      : null;
  const focal: Partial<MirrorSceneFocalPoint> | null =
    !lockedAnalysis && (focalX != null || focalY != null)
      ? {
          ...(typeof focalX === 'number' ? { focalX } : {}),
          ...(typeof focalY === 'number' ? { focalY } : {}),
        }
      : null;
  const focalStyle = mirrorFocalCssVars(focal);

  const [activeIdentityUrl, setActiveIdentityUrl] = useState<string | null>(null);
  const [identityVisible, setIdentityVisible] = useState(false);

  useEffect(() => {
    if (!identityUrl) {
      setIdentityVisible(false);
      const timer = window.setTimeout(() => setActiveIdentityUrl(null), IDENTITY_FADE_MS);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    setIdentityVisible(false);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setActiveIdentityUrl(identityUrl);
      requestAnimationFrame(() => {
        if (!cancelled) setIdentityVisible(true);
      });
    };
    img.onerror = () => {
      if (cancelled) return;
      setIdentityVisible(false);
      setActiveIdentityUrl(null);
    };
    img.src = identityUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [identityUrl]);

  return (
    <div
      className={cn(
        'saina-canvas-bg saina-canvas-bg--default-scene',
        lockedAnalysis && 'saina-canvas-bg--analysis-atmosphere'
      )}
      aria-hidden
      data-saina-atmosphere={atmosphere}
    >
      <div className="saina-scene-fit">
        <div
          className="saina-scene-fit__frame"
          style={{ aspectRatio: lockedAnalysis ? '16 / 9' : `${SCENE_IMAGE_ASPECT}` }}
        >
          <div
            className="saina-canvas-scene-image saina-canvas-scene-image--bundled"
            style={{ backgroundImage: `url('${bundledSceneUrl}')`, ...focalStyle }}
            data-testid={
              lockedAnalysis ? 'saina-scene-analysis-layer' : 'saina-scene-image-layer'
            }
          />
          {activeIdentityUrl ? (
            <div
              className={cn(
                'saina-canvas-scene-image saina-canvas-scene-image--identity',
                identityVisible && 'saina-canvas-scene-image--identity-visible'
              )}
              style={{ backgroundImage: `url('${activeIdentityUrl}')`, ...focalStyle }}
              data-testid="saina-scene-identity-layer"
            />
          ) : null}
        </div>
      </div>

      <div className="saina-canvas-overlay saina-canvas-overlay--left" />
      <div className="saina-canvas-overlay saina-canvas-overlay--center" />
      <div className="saina-canvas-overlay saina-canvas-overlay--pattern-dim" />
      <div className="saina-canvas-overlay saina-canvas-overlay--right" />
      <div className="saina-canvas-vignette saina-canvas-vignette--scene" />
      {!lockedAnalysis ? (
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
      ) : null}
    </div>
  );
}
