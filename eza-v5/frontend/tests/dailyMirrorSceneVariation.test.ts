import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canRequestNewSceneVariation } from '@/lib/eza/mirror/mirrorSceneVariation';
import {
  MIRROR_NEW_SCENE_LABEL,
  MIRROR_NEW_SCENE_HINT,
  MIRROR_UPDATE_LABEL,
} from '@/lib/eza/mirror/copy';

describe('mirrorSceneVariation', () => {
  it('blocks Free from new scene variation', () => {
    expect(canRequestNewSceneVariation(false, 'ready')).toBe(false);
    expect(canRequestNewSceneVariation(false, 'idle')).toBe(false);
  });

  it('allows Plus when not generating', () => {
    expect(canRequestNewSceneVariation(true, 'ready')).toBe(true);
    expect(canRequestNewSceneVariation(true, 'idle')).toBe(true);
    expect(canRequestNewSceneVariation(true, 'error')).toBe(true);
  });

  it('blocks Plus while generating', () => {
    expect(canRequestNewSceneVariation(true, 'generating')).toBe(false);
  });

  it('blocks Plus when daily production quota is exhausted', () => {
    expect(canRequestNewSceneVariation(true, 'ready', false)).toBe(false);
  });
});

describe('Scene variation vs mirror update (source)', () => {
  const refreshSrc = readFileSync(
    join(process.cwd(), 'components/mirror/DailyMirrorRefreshActions.tsx'),
    'utf8'
  );
  const experienceSrc = readFileSync(
    join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
    'utf8'
  );

  it('uses distinct copy for update vs new scene', () => {
    expect(MIRROR_UPDATE_LABEL).toBe('Aynanı Güncelle');
    expect(MIRROR_NEW_SCENE_LABEL).toContain('Yeni Sahne Oluştur');
    expect(MIRROR_NEW_SCENE_HINT).toMatch(/Aynı hikâye/i);
    expect(MIRROR_NEW_SCENE_HINT).toMatch(/Style Lens/i);
    expect(refreshSrc).toContain('MIRROR_NEW_SCENE_LABEL');
    expect(refreshSrc).toContain('MIRROR_UPDATE_LABEL');
  });

  it('shows new scene only on current refresh CTA for Plus', () => {
    expect(refreshSrc).toMatch(
      /refreshCta === 'current'[\s\S]*showNewScene/
    );
    expect(refreshSrc).not.toMatch(/refreshCta === 'update'[\s\S]*MIRROR_NEW_SCENE_LABEL/);
  });

  it('handleNewMirrorScene does not call buildMirrorState or saveDailyMirrorSnapshot', () => {
    const fnBlock = experienceSrc.slice(
      experienceSrc.indexOf('handleNewMirrorScene'),
      experienceSrc.indexOf('useEffect', experienceSrc.indexOf('handleNewMirrorScene'))
    );
    expect(fnBlock).toContain('handleGenerateMirrorScene');
    expect(fnBlock).toContain('advanceStyleLensSession');
    expect(fnBlock).not.toContain('buildMirrorState');
    expect(fnBlock).not.toContain('saveDailyMirrorSnapshot');
  });

  it('scene generation applies Style Lens without rebuilding card', () => {
    expect(experienceSrc).toContain('applyStyleLensToVisual');
    expect(experienceSrc).toContain('resetStyleLensSessionForCard');
    expect(refreshSrc).toContain('MIRROR_SCENE_STYLE_PREFIX');
  });

  it('handleMirrorRefresh uses runMirrorWithReveal (card update path)', () => {
    expect(experienceSrc).toMatch(
      /handleMirrorRefresh[\s\S]*runMirrorWithReveal/
    );
  });

  it('guards duplicate scene API while generating', () => {
    expect(experienceSrc).toMatch(
      /if \(sceneImageStatus === 'generating'\) return/
    );
  });
});
