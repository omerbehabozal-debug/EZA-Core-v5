import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ONBOARDING_PREVIEW_SLIDES } from '@/lib/eza/mirror/onboardingPreviewSlides';
import { ONBOARDING_PREVIEW_CARD } from '@/lib/eza/mirror/onboardingPreviewMock';

const previewSrc = readFileSync(
  join(process.cwd(), 'components/mirror/MirrorOnboardingPreview.tsx'),
  'utf8'
);

const promptSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorCreatePrompt.tsx'),
  'utf8'
);

describe('MirrorOnboardingPreview', () => {
  it('uses index-based carousel with slide transform animation', () => {
    expect(previewSrc).toContain('useState(0)');
    expect(previewSrc).toContain('stepSlide');
    expect(previewSrc).toContain('320');
    expect(previewSrc).toContain('translateX');
    expect(previewSrc).toContain('onPointerDown');
    expect(previewSrc).not.toContain('cursor-grab');
    expect(previewSrc).toContain('wheel');
    expect(previewSrc).toContain('ONBOARDING_PREVIEW_SLIDES');
    expect(previewSrc).not.toContain('DailyMirrorPosterCard');
    expect(ONBOARDING_PREVIEW_SLIDES.length).toBeGreaterThanOrEqual(4);
  });

  it('serves all onboarding preview assets from public mirror folder', () => {
    for (const slide of ONBOARDING_PREVIEW_SLIDES) {
      const assetPath = join(process.cwd(), 'public', slide.src.replace(/^\//, ''));
      expect(() => readFileSync(assetPath)).not.toThrow();
    }
  });

  it('scales slides by width with intrinsic 9:16 height (no letterbox)', () => {
    expect(previewSrc).toContain('width={540}');
    expect(previewSrc).toContain('height={960}');
    expect(previewSrc).toContain('h-auto w-full');
    expect(previewSrc).not.toContain('object-contain');
    expect(previewSrc).not.toContain('fill');
  });

  it('keeps future wiring mock aligned with target poster copy', () => {
    expect(ONBOARDING_PREVIEW_CARD.headline).toContain('Lezzetli');
    expect(ONBOARDING_PREVIEW_CARD.themeDescription).toBe('Yaratıcılık & Özen');
  });

  it('DailyMirrorCreatePrompt shows CTA before preview slider on idle', () => {
    expect(promptSrc).toContain('MirrorOnboardingPreview');
    expect(promptSrc).toContain('from-violet-600');
    const previewUse = promptSrc.indexOf('<MirrorOnboardingPreview');
    const ctaUse = promptSrc.indexOf('onClick={onGenerate}');
    expect(previewUse).toBeGreaterThan(-1);
    expect(ctaUse).toBeGreaterThan(-1);
    expect(ctaUse).toBeLessThan(previewUse);
  });
});
