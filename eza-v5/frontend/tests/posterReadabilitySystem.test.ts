import { describe, it, expect } from 'vitest';
import {
  EDITORIAL_TYPE,
  getEditorialContrast,
  buildEditorialReadabilityVars,
} from '@/lib/eza/mirror/posterReadabilitySystem';

describe('posterReadabilitySystem', () => {
  it('uses readable metric scale at design width', () => {
    expect(EDITORIAL_TYPE.metricLine).toBeGreaterThanOrEqual(10);
    expect(EDITORIAL_TYPE.headline).toBeGreaterThanOrEqual(32);
  });

  it('calm density keeps editorial contrast not wellness fade', () => {
    const calm = getEditorialContrast('calm');
    expect(calm.titleScrimPeak).toBeGreaterThanOrEqual(0.75);
    expect(calm.storyOpacity).toBeGreaterThanOrEqual(0.9);
    expect(calm.sceneContrast).toBeGreaterThanOrEqual(1.1);
  });

  it('exports CSS vars for card inline style', () => {
    const vars = buildEditorialReadabilityVars(getEditorialContrast('balanced'));
    expect(vars['--poster-story-opacity']).toBeDefined();
    expect(vars['--poster-scene-brightness']).toBeDefined();
  });
});
