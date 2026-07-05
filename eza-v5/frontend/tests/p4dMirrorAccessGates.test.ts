import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canRequestNewSceneVariation } from '@/lib/eza/mirror/mirrorSceneVariation';
import { MIRROR_EPHEMERAL_FREE, MIRROR_EPHEMERAL_PLUS } from '@/lib/eza/mirror/copy';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);
const refreshSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorRefreshActions.tsx'),
  'utf8'
);
const lightboxSrc = readFileSync(
  join(process.cwd(), 'components/mirror/MirrorPosterLightbox.tsx'),
  'utf8'
);
const copySrc = readFileSync(join(process.cwd(), 'lib/eza/mirror/copy.ts'), 'utf8');
const sceneBtnSrc = readFileSync(
  join(process.cwd(), 'components/mirror/MirrorSceneGenerateButton.tsx'),
  'utf8'
);
const footerSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorReadyFooter.tsx'),
  'utf8'
);

describe('P4-D access gates (source)', () => {
  it('does not mention geçmiş aynalar in mirror copy', () => {
    expect(copySrc.toLowerCase()).not.toContain('geçmiş aynalar');
  });

  it('mounts DailyMirrorSharePoster only for Plus', () => {
    expect(experienceSrc).toMatch(/\{isPlus \? \([\s\S]*DailyMirrorSharePoster/);
    expect(experienceSrc).toContain('open={shareOpen && isPlus}');
  });

  it('gates share open and capture for Plus', () => {
    expect(experienceSrc).toContain('handleShareOpen');
    expect(experienceSrc).toMatch(/if \(!isPlus\) return/);
    expect(experienceSrc).toContain('showShareAction');
    expect(experienceSrc).toMatch(/isPlus &&[\s\S]*shareEnabled/);
  });

  it('keeps ephemeral and pattern copy in footer but hides them in premium poster ready state', () => {
    expect(copySrc).toContain('MIRROR_EPHEMERAL_PLUS');
    expect(copySrc).toContain('MIRROR_EPHEMERAL_FREE');
    expect(footerSrc).toContain('MIRROR_PATTERN_ROUTE');
    expect(footerSrc).toContain('MIRROR_PATTERN_REDIRECT');
    expect(footerSrc).toContain('loginOnly');
    expect(experienceSrc).toContain('minimal={isScenePosterVisible}');
    expect(experienceSrc).toContain('loginOnly');
    expect(experienceSrc).not.toContain('MIRROR_EPHEMERAL_PLUS');
    expect(experienceSrc).not.toContain('formatPlusMirrorQuotaHint');
  });

  it('wires account entitlements visual quota', () => {
    expect(experienceSrc).toContain('canCreateVisualFromEntitlements');
    expect(experienceSrc).toContain('canCreateVisual');
    expect(experienceSrc).toContain('useAccountEntitlements');
    expect(experienceSrc).not.toContain('plusMirrorDailyUsage');
    expect(experienceSrc).not.toContain('consumePlusMirrorProduction');
  });

  it('allows guest scene generation when visual quota is available', () => {
    expect(experienceSrc).toContain('if (!isAuthReady || !canCreateVisual) return');
    expect(experienceSrc).toContain('generationRequestId');
    expect(experienceSrc).toMatch(
      /handleGenerateMirrorScene[\s\S]*if \(!isAuthReady\) return;[\s\S]*if \(!canCreateVisual\) return;/
    );
  });

  it('does not permanently block scene generation after snapshot hydrate', () => {
    expect(experienceSrc).not.toMatch(/endsWith\(':hydrate'\)\)\s*return;/);
    expect(experienceSrc).toContain("sceneImageStatus !== 'idle'");
    expect(experienceSrc).toContain('refreshPlan');
  });

  it('marks scene auto-generation complete to prevent duplicate API calls', () => {
    expect(experienceSrc).toContain(':complete');
    expect(experienceSrc).toContain('sceneGenerationInFlightRef');
  });

  it('Free does not get scene retry button on ready panel', () => {
    expect(experienceSrc).not.toContain('MirrorSceneGenerateButton');
  });

  it('does not show Sahne hazır to users', () => {
    expect(sceneBtnSrc).not.toContain('MIRROR_SCENE_READY');
  });

  it('opens poster lightbox from preview and share modal has no download', () => {
    expect(experienceSrc).toContain('MirrorPosterLightbox');
    expect(experienceSrc).toContain('saina-mirror-poster-preview-trigger');
    expect(experienceSrc).not.toContain('showDownload');
    expect(experienceSrc).not.toContain('handleCardDownload');
    expect(lightboxSrc).toContain('createPortal');
    expect(lightboxSrc).toContain('document.body');
  });

  it('Plus refresh actions expose share only (no download)', () => {
    expect(refreshSrc).toContain('showShare');
    expect(refreshSrc).not.toContain('showDownload');
    expect(refreshSrc).not.toContain('MIRROR_SHARE_DOWNLOAD_LABEL');
    expect(refreshSrc).toContain('primaryShareClass');
  });
});

describe('P4-D ephemeral copy constants', () => {
  it('defines distinct Free and Plus ephemeral strings', () => {
    expect(MIRROR_EPHEMERAL_FREE).toMatch(/hesabını yükselttiğinde açılır/i);
    expect(MIRROR_EPHEMERAL_PLUS).toMatch(/Paylaşarak saklayabilirsin/i);
  });
});

describe('P4-D scene variation quota', () => {
  it('blocks new scene when Plus production quota exhausted', () => {
    expect(canRequestNewSceneVariation(true, 'ready', false)).toBe(false);
    expect(canRequestNewSceneVariation(true, 'ready', true)).toBe(true);
  });
});
