import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isNonProductionFrontendPath,
  shouldBlockProductionFrontendSurface,
} from '@/lib/eza/productionSurfaceGuard';

describe('productionSurfaceGuard Phase 8.1.3 connection_test', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes connection_test in guarded paths', () => {
    expect(isNonProductionFrontendPath('/connection_test')).toBe(true);
  });

  it('blocks connection_test on production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface('/connection_test', 'standalone.ezacore.ai')
    ).toBe(true);
  });

  it('blocks connection_test on unknown remote deployment', () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('EZA_DEPLOY_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_EZA_DEPLOY_ENV', '');
    expect(
      shouldBlockProductionFrontendSurface('/connection_test', 'random-deploy.example.com')
    ).toBe(true);
  });

  it('allows connection_test on localhost', () => {
    expect(shouldBlockProductionFrontendSurface('/connection_test', 'localhost')).toBe(false);
  });

  it('allows connection_test in explicit staging deploy env', () => {
    vi.stubEnv('VERCEL_ENV', 'staging');
    expect(
      shouldBlockProductionFrontendSurface('/connection_test', 'preview.example.com')
    ).toBe(false);
  });

  it('docs test-suite remains blocked on production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface('/docs/test-suite', 'standalone.ezacore.ai')
    ).toBe(true);
  });

  it('lab paths remain blocked on production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface('/dev/mirror-poster', 'standalone.ezacore.ai')
    ).toBe(true);
    expect(
      shouldBlockProductionFrontendSurface(
        '/standalone/mirror-v2-lab',
        'standalone.ezacore.ai'
      )
    ).toBe(true);
  });
});
