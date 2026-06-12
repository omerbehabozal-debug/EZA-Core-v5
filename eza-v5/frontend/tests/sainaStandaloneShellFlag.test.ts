import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSainaStandaloneShellEnabled } from '@/lib/eza/sainaStandaloneShell';

describe('isSainaStandaloneShellEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when env is undefined', () => {
    vi.stubEnv('NEXT_PUBLIC_SAINA_STANDALONE_SHELL', '');
    expect(isSainaStandaloneShellEnabled()).toBe(false);
  });

  it('returns false when env is explicitly false', () => {
    vi.stubEnv('NEXT_PUBLIC_SAINA_STANDALONE_SHELL', 'false');
    expect(isSainaStandaloneShellEnabled()).toBe(false);
  });

  it('returns true only when env is true', () => {
    vi.stubEnv('NEXT_PUBLIC_SAINA_STANDALONE_SHELL', 'true');
    expect(isSainaStandaloneShellEnabled()).toBe(true);
  });
});
