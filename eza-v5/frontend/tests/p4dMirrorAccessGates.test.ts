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

  it('shows plan-specific ephemeral copy', () => {
    expect(experienceSrc).toContain('MIRROR_EPHEMERAL_PLUS');
    expect(experienceSrc).toContain('MIRROR_EPHEMERAL_FREE');
    expect(experienceSrc).toContain('DailyMirrorReadyFooter');
    expect(footerSrc).toContain('MIRROR_PATTERN_ROUTE');
    expect(footerSrc).toContain('MIRROR_PATTERN_REDIRECT');
  });

  it('wires Plus production quota', () => {
    expect(experienceSrc).toContain('plusMirrorDailyUsage');
    expect(experienceSrc).toContain('consumePlusMirrorProduction');
    expect(experienceSrc).toContain('hasPlusProductionQuota');
  });

  it('Free does not get scene retry button on ready panel', () => {
    expect(experienceSrc).not.toContain('MirrorSceneGenerateButton');
  });

  it('does not show Sahne hazır to users', () => {
    expect(sceneBtnSrc).not.toContain('MIRROR_SCENE_READY');
  });

  it('Plus refresh actions expose share and download', () => {
    expect(refreshSrc).toContain('showDownload');
    expect(refreshSrc).toContain('MIRROR_SHARE_DOWNLOAD_LABEL');
    expect(refreshSrc).toContain('primaryShareClass');
  });
});

describe('P4-D ephemeral copy constants', () => {
  it('defines distinct Free and Plus ephemeral strings', () => {
    expect(MIRROR_EPHEMERAL_FREE).toMatch(/Plus ile açılır/i);
    expect(MIRROR_EPHEMERAL_PLUS).toMatch(/Paylaşarak veya indirerek/i);
  });
});

describe('P4-D scene variation quota', () => {
  it('blocks new scene when Plus production quota exhausted', () => {
    expect(canRequestNewSceneVariation(true, 'ready', false)).toBe(false);
    expect(canRequestNewSceneVariation(true, 'ready', true)).toBe(true);
  });
});
