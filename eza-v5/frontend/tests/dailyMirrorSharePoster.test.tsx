import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildDevItalyPosterCard } from '@/lib/eza/mirror/devPosterFixtures';
import { resolvePosterSceneTone } from '@/lib/eza/mirror/posterSceneTone';

const sharePosterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorSharePoster.tsx'),
  'utf8'
);

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

const exportHookSrc = readFileSync(
  join(process.cwd(), 'hooks/useMirrorCardExport.ts'),
  'utf8'
);

const shareExportSrc = readFileSync(
  join(process.cwd(), 'lib/eza/mirror/shareExport.ts'),
  'utf8'
);

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);

describe('DailyMirrorSharePoster P4-C4', () => {
  it('renders share-story root with 9:16 and scene-first stack', () => {
    expect(sharePosterSrc).toContain('data-mirror-share-root');
    expect(sharePosterSrc).toContain('data-mirror-aspect="9-16"');
    expect(sharePosterSrc).toContain('data-mirror-poster="share-story-v1"');
    expect(sharePosterSrc).toContain('FullCanvasScene');
    expect(sharePosterSrc).toContain('shareMasthead');
    expect(sharePosterSrc).toContain('shareAvatarName');
    expect(sharePosterSrc).toContain('shareMirrorMoment');
    expect(sharePosterSrc).toContain('resolvePosterSceneTone');
  });

  it('excludes in-app-only dashboard blocks from share poster', () => {
    expect(sharePosterSrc).not.toContain('PosterReflectionSummary');
    expect(sharePosterSrc).not.toContain('PosterTomorrowHint');
    expect(sharePosterSrc).not.toContain('PosterIdentityHeadline');
    expect(sharePosterSrc).not.toContain('rhythmWhisper');
    expect(sharePosterSrc).not.toContain('heroScore');
    expect(sharePosterSrc).not.toContain('energyScore');
    expect(sharePosterSrc).not.toContain('relationshipBars');
    expect(sharePosterSrc).not.toContain('Bugün Sen');
  });

  it('Italy travel fixture resolves warm_gold tone for share skin', () => {
    const { card } = buildDevItalyPosterCard();
    expect(resolvePosterSceneTone(card).id).toBe('warm_gold');
    expect(card.dailyAvatarName).toContain('İtalyan');
    expect(card.mirrorMoment).toBeTruthy();
  });

  it('experience mounts share poster only for Plus', () => {
    expect(experienceSrc).toMatch(/\{isPlus \? \([\s\S]*DailyMirrorSharePoster/);
    expect(experienceSrc).toContain('left-[-9999px]');
    expect(experienceSrc).toContain('DailyMirrorPosterCard');
  });

  it('export capture prefers share root with card fallback', () => {
    expect(exportHookSrc).toContain('resolveMirrorExportCaptureNode');
    expect(shareExportSrc).toContain('[data-mirror-share-root]');
    expect(shareExportSrc).toContain('[data-mirror-card-root]');
  });

  it('in-app DailyMirrorPosterCard root unchanged', () => {
    expect(posterSrc).toContain('data-mirror-card-root');
    expect(posterSrc).toContain('rhythmWhisperZone');
    expect(posterSrc).toContain('İlişki ritmi');
    expect(posterSrc).not.toContain('data-mirror-share-root');
  });
});
