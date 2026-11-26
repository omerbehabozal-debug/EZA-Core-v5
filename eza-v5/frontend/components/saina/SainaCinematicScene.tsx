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
import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import {
  applyYansiAccentRgb,
  extractYansiAccentRgb,
  YANSI_ACCENT_RGB_DEFAULT,
} from '@/lib/eza/yansiAccentColor';

const defaultSceneUrl =
  typeof defaultSceneImage === 'string'
    ? defaultSceneImage
    : (defaultSceneImage as { src: string }).src;

const analysisAtmosphereUrl =
  typeof analysisAtmosphereImage === 'string'
    ? analysisAtmosphereImage
    : (analysisAtmosphereImage as { src: string }).src;

const IDENTITY_FADE_MS = 420;
/** Neutral stage while a known cover decodes — never the default cityscape. */
const PENDING_SCENE_FILL = '#0c0b0a';

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
  /**
   * Legacy prop — public Deneyimle uses the same full-bleed `cover` crop as
   * individual Yansı. Kept for call-site compatibility; does not switch to contain.
   */
  preserveFrame?: boolean;
};

/** Full-width conversation atmosphere — default scene with optional Ayna identity crossfade. */
export default function SainaCinematicScene({
  sceneImageUrl,
  focalX,
  focalY,
  atmosphere = 'conversation',
  preserveFrame: _preserveFrame = false,
}: SainaCinematicSceneProps) {
  void _preserveFrame;
  const lockedAnalysis = atmosphere === 'analysis';
  const bundledSceneUrl = lockedAnalysis ? analysisAtmosphereUrl : defaultSceneUrl;

  const identityUrl =
    !lockedAnalysis && sceneImageUrl && isConversationSceneDisplayUrl(sceneImageUrl)
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

  // Optimistic first paint: Keşfet→Deneyimle remount must not flash cityscape.
  const [activeIdentityUrl, setActiveIdentityUrl] = useState<string | null>(identityUrl);
  const [identityVisible, setIdentityVisible] = useState(() => Boolean(identityUrl));
  const [identityFailed, setIdentityFailed] = useState(false);

  useEffect(() => {
    if (!identityUrl) {
      setIdentityFailed(false);
      setIdentityVisible(false);
      const timer = window.setTimeout(() => setActiveIdentityUrl(null), IDENTITY_FADE_MS);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    setIdentityFailed(false);
    setActiveIdentityUrl(identityUrl);
    setIdentityVisible(true);

    const img = new Image();
    const confirmReady = () => {
      if (cancelled) return;
      setActiveIdentityUrl(identityUrl);
      setIdentityVisible(true);
      setIdentityFailed(false);
    };
    img.onload = confirmReady;
    img.onerror = () => {
      if (cancelled) return;
      setIdentityFailed(true);
      setIdentityVisible(false);
      setActiveIdentityUrl(null);
    };
    img.src = identityUrl;
    // Warm cache / already-decoded decode from Keşfet — confirm synchronously when possible.
    if (img.complete && img.naturalWidth > 0) {
      confirmReady();
    }

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [identityUrl]);

  const showCityscapeFallback = !lockedAnalysis && (!identityUrl || identityFailed);
  const accentSceneUrl =
    activeIdentityUrl ?? (showCityscapeFallback || lockedAnalysis ? bundledSceneUrl : null);

  useEffect(() => {
    if (!accentSceneUrl) {
      applyYansiAccentRgb(YANSI_ACCENT_RGB_DEFAULT);
      return;
    }
    let cancelled = false;

    void extractYansiAccentRgb(accentSceneUrl).then((rgb) => {
      if (!cancelled) applyYansiAccentRgb(rgb);
    });

    return () => {
      cancelled = true;
    };
  }, [accentSceneUrl]);

  useEffect(() => {
    return () => {
      applyYansiAccentRgb(YANSI_ACCENT_RGB_DEFAULT);
    };
  }, []);

  return (
    <div
      className={cn(
        'saina-canvas-bg saina-canvas-bg--default-scene',
        lockedAnalysis && 'saina-canvas-bg--analysis-atmosphere'
      )}
      aria-hidden
      data-saina-atmosphere={atmosphere}
      data-saina-scene-pending={
        !lockedAnalysis && Boolean(identityUrl) && !identityFailed ? 'cover' : undefined
      }
    >
      <div className="saina-scene-fit">
        <div
          className="saina-scene-fit__frame"
          style={{ aspectRatio: lockedAnalysis ? '16 / 9' : `${SCENE_IMAGE_ASPECT}` }}
        >
          {showCityscapeFallback || lockedAnalysis ? (
            <div
              className="saina-canvas-scene-image saina-canvas-scene-image--bundled"
              style={{ backgroundImage: `url('${bundledSceneUrl}')`, ...focalStyle }}
              data-testid={
                lockedAnalysis ? 'saina-scene-analysis-layer' : 'saina-scene-image-layer'
              }
            />
          ) : (
            <div
              className="saina-canvas-scene-image saina-canvas-scene-image--pending"
              style={{ backgroundColor: PENDING_SCENE_FILL, backgroundImage: 'none' }}
              data-testid="saina-scene-pending-layer"
            />
          )}
          {activeIdentityUrl ? (
            <div
              className={cn(
                'saina-canvas-scene-image saina-canvas-scene-image--identity',
                identityVisible && 'saina-canvas-scene-image--identity-visible'
              )}
              style={{ backgroundImage: `url('${activeIdentityUrl}')`, ...focalStyle }}
              data-testid="saina-scene-identity-layer"
              data-saina-scene-fit="cover"
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
