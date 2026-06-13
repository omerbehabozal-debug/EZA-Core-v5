import { describe, expect, it } from 'vitest';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

describe('resolveSainaPlanTier', () => {
  it('returns loading while plan is hydrating', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: true, source: 'default' }),
    ).toBe('loading');
  });

  it('returns unknown when server fetch failed with token', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: false, source: 'unknown' }),
    ).toBe('unknown');
  });

  it('maps server plus to premium', () => {
    expect(
      resolveSainaPlanTier({ isPlus: true, isLoading: false, source: 'server' }),
    ).toBe('premium');
  });

  it('maps server free to free', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: false, source: 'server' }),
    ).toBe('free');
  });

  it('maps default source to free for anonymous users', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: false, source: 'default' }),
    ).toBe('free');
  });
});
