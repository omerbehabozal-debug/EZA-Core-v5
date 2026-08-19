import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NON_PRODUCTION_FRONTEND_PATH_PREFIXES,
  isExplicitNonProductionFrontendSurfaceAllowed,
  isNonProductionFrontendPath,
  shouldBlockProductionFrontendSurface,
} from '@/lib/eza/productionSurfaceGuard';

describe('productionSurfaceGuard Phase 8.1.1', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks lab/dev paths on ezacore production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface(
        '/standalone/mirror-v2-lab',
        'standalone.ezacore.ai'
      )
    ).toBe(true);
    expect(
      shouldBlockProductionFrontendSurface('/dev/mirror-poster', 'standalone.ezacore.ai')
    ).toBe(true);
  });

  it('allows lab/dev paths on localhost', () => {
    expect(
      shouldBlockProductionFrontendSurface('/standalone/mirror-v2-lab', 'localhost')
    ).toBe(false);
    expect(isExplicitNonProductionFrontendSurfaceAllowed('localhost')).toBe(true);
  });

  it('fail-closed when deploy env is missing on non-local host', () => {
    vi.stubEnv('VERCEL_ENV', '');
    expect(isExplicitNonProductionFrontendSurfaceAllowed('unknown.example.com')).toBe(false);
    expect(
      shouldBlockProductionFrontendSurface('/dev/mirror-poster', 'unknown.example.com')
    ).toBe(true);
  });

  it('allows explicit ci/staging deploy env labels', () => {
    vi.stubEnv('VERCEL_ENV', 'ci');
    expect(isExplicitNonProductionFrontendSurfaceAllowed('preview.example.vercel.app')).toBe(
      true
    );
    vi.stubEnv('VERCEL_ENV', 'staging');
    expect(isExplicitNonProductionFrontendSurfaceAllowed('staging.example.com')).toBe(true);
  });

  it('blocks when VERCEL_ENV=production even on unknown host', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isExplicitNonProductionFrontendSurfaceAllowed('unknown.example.com')).toBe(false);
  });

  it('lists guarded non-production path prefixes', () => {
    expect(NON_PRODUCTION_FRONTEND_PATH_PREFIXES).toContain('/standalone/mirror-v2-lab');
    expect(NON_PRODUCTION_FRONTEND_PATH_PREFIXES).toContain('/dev');
    expect(isNonProductionFrontendPath('/dev/saina-conversation')).toBe(true);
  });
});
