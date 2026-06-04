import { describe, expect, it, vi, afterEach } from 'vitest';

describe('getApiUrl on ezacore frontends', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses same-origin /api on standalone.ezacore.ai', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'standalone.ezacore.ai' },
    } as Window);
    const { getApiUrl } = await import('@/lib/apiUrl');
    expect(getApiUrl()).toBe('');
  });
});
