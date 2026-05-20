import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMirrorDevToolsEnabled } from '@/lib/eza/mirror/devTools';

describe('isMirrorDevToolsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enabled in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isMirrorDevToolsEnabled()).toBe(true);
  });

  it('disabled in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isMirrorDevToolsEnabled()).toBe(false);
  });

  it('disabled in test env by default', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(isMirrorDevToolsEnabled()).toBe(false);
  });
});
