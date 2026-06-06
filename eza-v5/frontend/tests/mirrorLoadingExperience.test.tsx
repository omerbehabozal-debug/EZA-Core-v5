import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

const loadingSrc = readFileSync(
  join(process.cwd(), 'components/mirror/MirrorLoadingExperience.tsx'),
  'utf8'
);

const skinSrc = readFileSync(join(process.cwd(), 'lib/eza/standaloneSkin.ts'), 'utf8');

describe('MirrorLoadingExperience', () => {
  it('defines premium step copy for mirror scene wait', () => {
    expect(loadingSrc).toContain('EZA aynanı oluşturuyor');
    expect(loadingSrc).toContain('Konular okunuyor');
    expect(loadingSrc).toContain('İlişki ritmi çıkarılıyor');
    expect(loadingSrc).toContain('Sahne hazırlanıyor');
    expect(loadingSrc).toContain('mirrorLoadingRoot');
  });

  it('StandaloneObservationExperience gates poster until scene is ready', () => {
    expect(experienceSrc).toContain('MirrorLoadingExperience');
    expect(experienceSrc).toContain('isScenePosterVisible');
    expect(experienceSrc).toContain('isSceneLoading');
    expect(experienceSrc).toMatch(
      /sceneImageUrl\?\.trim\(\)\)[\s\S]*sceneImageStatus === 'ready'/
    );
    expect(experienceSrc).toContain('isSceneLoading ?');
    expect(experienceSrc).toContain('isScenePosterVisible ?');
  });

  it('keeps share poster mounted only when scene poster is visible', () => {
    expect(experienceSrc).toMatch(
      /showShareAction[\s\S]*isScenePosterVisible/
    );
    expect(experienceSrc).toMatch(
      /isScenePosterVisible \? \([\s\S]*DailyMirrorSharePoster/
    );
  });

  it('daily stage and poster frame support viewport-centered layout', () => {
    expect(skinSrc).toContain('dailyPosterFrame');
    expect(skinSrc).toContain('100dvh-11rem');
    expect(skinSrc).toContain('justify-center');
  });
});
