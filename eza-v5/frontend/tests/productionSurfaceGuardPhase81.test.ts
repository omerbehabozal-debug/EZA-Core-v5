import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NON_PRODUCTION_FRONTEND_PATH_PREFIXES,
  isNonProductionFrontendPath,
  isProductionFrontendDeploy,
  shouldBlockProductionFrontendSurface,
} from '@/lib/eza/productionSurfaceGuard';

describe('productionSurfaceGuard Phase 8.1', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks mirror-v2-lab and dev paths on ezacore production hosts', () => {
    expect(
      shouldBlockProductionFrontendSurface(
        '/standalone/mirror-v2-lab',
        'standalone.ezacore.ai'
      )
    ).toBe(true);
    expect(
      shouldBlockProductionFrontendSurface('/dev/mirror-poster', 'standalone.ezacore.ai')
    ).toBe(true);
    expect(
      shouldBlockProductionFrontendSurface('/standalone/discover', 'standalone.ezacore.ai')
    ).toBe(false);
  });

  it('does not block lab paths on localhost', () => {
    expect(
      shouldBlockProductionFrontendSurface('/standalone/mirror-v2-lab', 'localhost')
    ).toBe(false);
  });

  it('treats VERCEL_ENV=production as production deploy on non-local hosts', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isProductionFrontendDeploy('standalone.ezacore.ai')).toBe(true);
    expect(isProductionFrontendDeploy('unknown.example.com')).toBe(true);
    // Localhost remains available for development tooling.
    expect(isProductionFrontendDeploy('localhost')).toBe(false);
  });

  it('lists guarded non-production path prefixes', () => {
    expect(NON_PRODUCTION_FRONTEND_PATH_PREFIXES).toContain('/standalone/mirror-v2-lab');
    expect(NON_PRODUCTION_FRONTEND_PATH_PREFIXES).toContain('/dev');
    expect(isNonProductionFrontendPath('/dev/saina-conversation')).toBe(true);
    expect(isNonProductionFrontendPath('/standalone/mirror/daily')).toBe(false);
  });
});
