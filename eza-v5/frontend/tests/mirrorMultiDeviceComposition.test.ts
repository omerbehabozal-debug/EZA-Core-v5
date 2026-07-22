/**
 * Multi-device Mirror composition: canonical size, focal readiness, no-distort CSS.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIRROR_CANONICAL_IMAGE_SIZE,
  MIRROR_OPENAI_ALLOWED_IMAGE_SIZES,
  isAllowedMirrorImageSize,
} from '@/lib/eza/mirror/mirrorCanonicalImageSize';
import {
  MIRROR_DEFAULT_FOCAL,
  mirrorFocalToCssPosition,
  resolveMirrorSceneFocal,
} from '@/lib/eza/mirror/mirrorSceneFocal';

const cssSrc = readFileSync(join(process.cwd(), 'styles/saina-mirror.css'), 'utf8');
const posterSceneSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterScene.tsx'),
  'utf8'
);
const cinematicSrc = readFileSync(
  join(process.cwd(), 'components/saina/SainaCinematicScene.tsx'),
  'utf8'
);
const sharePosterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorSharePoster.tsx'),
  'utf8'
);
const posterCardSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);
const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

describe('Mirror multi-device composition', () => {
  it('canonical image size is a valid OpenAI option', () => {
    expect(isAllowedMirrorImageSize(MIRROR_CANONICAL_IMAGE_SIZE)).toBe(true);
    expect(MIRROR_CANONICAL_IMAGE_SIZE).toBe('1024x1024');
    expect(MIRROR_OPENAI_ALLOWED_IMAGE_SIZES).toContain('1024x1024');
  });

  it('conversation background uses cover, never stretch fill', () => {
    expect(cssSrc).toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*cover/s
    );
    expect(cssSrc).not.toMatch(
      /\.saina-scene-fit__frame\s+\.saina-canvas-scene-image\s*\{[^}]*background-size:\s*100%\s+100%/s
    );
  });

  it('poster cover crops preserve aspect ratio (object-cover, no stretch)', () => {
    expect(posterSceneSrc).toContain('object-cover');
    expect(posterSceneSrc).toContain('object-contain');
    expect(posterSceneSrc).not.toContain('object-fill');
    expect(posterSceneSrc).toContain('mirrorFocalToCssPosition');
  });

  it('legacy images without focal metadata resolve to safe center', () => {
    expect(resolveMirrorSceneFocal(null)).toEqual(MIRROR_DEFAULT_FOCAL);
    expect(resolveMirrorSceneFocal(undefined)).toEqual(MIRROR_DEFAULT_FOCAL);
    expect(resolveMirrorSceneFocal({})).toEqual(MIRROR_DEFAULT_FOCAL);
    expect(mirrorFocalToCssPosition(null)).toBe('50.00% 50.00%');
  });

  it('CSS object/background-position can consume focal later', () => {
    expect(mirrorFocalToCssPosition({ focalX: 0.35, focalY: 0.6 })).toBe('35.00% 60.00%');
    expect(cssSrc).toContain('--mirror-focal-position');
    expect(cinematicSrc).toContain('mirrorFocalCssVars');
  });

  it('social and sidebar reuse the same sceneImageUrl source (no per-device generate)', () => {
    expect(sharePosterSrc).toContain('sceneImageUrl={sceneUrl}');
    expect(posterCardSrc).toContain('sceneImageUrl={card.visual?.sceneImageUrl}');
    expect(experienceSrc).toContain('DailyMirrorSharePoster');
    expect(experienceSrc).toContain('sceneImageUrl={cardForRender.visual?.sceneImageUrl}');
    // One generate path — no device-specific size regenerate.
    expect(experienceSrc).not.toMatch(/generateMirrorScene\([^)]*phone/i);
    expect(experienceSrc).not.toMatch(/imageSize.*tablet|tablet.*imageSize/i);
  });

  it('does not introduce benchmark-specific crop wording in FE composition helpers', () => {
    const focalSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/mirrorSceneFocal.ts'),
      'utf8'
    ).toLowerCase();
    const sizeSrc = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/mirrorCanonicalImageSize.ts'),
      'utf8'
    ).toLowerCase();
    for (const banned of ['mardin', 'trench', 'panda', 'benchmark', 'wallpaper style']) {
      expect(focalSrc).not.toContain(banned);
      expect(sizeSrc).not.toContain(banned);
    }
  });
});
