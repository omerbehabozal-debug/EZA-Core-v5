import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MIRROR_PUBLIC_BASE_URL_DEFAULT,
  buildMirrorPublicPath,
  buildMirrorPublicShareUrl,
  isPublicMirrorNetworkPath,
  resolveMirrorPublicBaseUrl,
} from '@/lib/eza/mirror-network/mirrorPublicUrl';

describe('mirrorPublicUrl Phase 8.2', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds canonical /m/{slug} path', () => {
    expect(buildMirrorPublicPath('kyoto-journey')).toBe('/m/kyoto-journey');
  });

  it('defaults share host to standalone.ezacore.ai', () => {
    vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL', '');
    expect(resolveMirrorPublicBaseUrl()).toBe(MIRROR_PUBLIC_BASE_URL_DEFAULT);
    expect(buildMirrorPublicShareUrl('kyoto-journey')).toBe(
      'https://standalone.ezacore.ai/m/kyoto-journey'
    );
  });

  it('respects NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL override', () => {
    vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL', 'https://staging.example.com');
    expect(buildMirrorPublicShareUrl('slug-a')).toBe('https://staging.example.com/m/slug-a');
  });

  it('identifies public mirror network paths for middleware', () => {
    expect(isPublicMirrorNetworkPath('/m/slug-a')).toBe(true);
    expect(isPublicMirrorNetworkPath('/m/slug-a/sohbet')).toBe(true);
    expect(isPublicMirrorNetworkPath('/m/slug-a/yansilar')).toBe(true);
    expect(isPublicMirrorNetworkPath('/standalone/discover')).toBe(false);
  });

  it('does not use saina.app in active default share URL', () => {
    vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL', '');
    expect(buildMirrorPublicShareUrl('test-slug')).not.toContain('saina.app');
  });
});

describe('middleware contract Phase 8.2 /m routing', () => {
  it('middleware preserves /m paths before domain rewrite', () => {
    const middlewareSrc = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
    expect(middlewareSrc).toContain('isPublicMirrorNetworkPath');
    expect(middlewareSrc).toContain('Phase 8.2');
  });
});
