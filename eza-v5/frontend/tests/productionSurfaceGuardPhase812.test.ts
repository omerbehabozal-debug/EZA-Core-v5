import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isNonProductionFrontendPath,
  shouldBlockProductionFrontendSurface,
} from '@/lib/eza/productionSurfaceGuard';

describe('productionSurfaceGuard Phase 8.1.2 docs test-suite', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes docs test-suite in guarded paths', () => {
    expect(isNonProductionFrontendPath('/docs/test-suite')).toBe(true);
  });

  it('blocks docs test-suite on production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface('/docs/test-suite', 'standalone.ezacore.ai')
    ).toBe(true);
  });

  it('allows docs test-suite on localhost', () => {
    expect(shouldBlockProductionFrontendSurface('/docs/test-suite', 'localhost')).toBe(false);
  });
});
