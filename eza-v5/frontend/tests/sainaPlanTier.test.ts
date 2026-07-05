import { describe, expect, it } from 'vitest';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

describe('resolveSainaPlanTier', () => {
  it('returns loading while plan is hydrating', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: true, source: 'default' }),
    ).toBe('loading');
  });

  it('returns session_invalid when server fetch failed with token', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: false, source: 'session_invalid' }),
    ).toBe('session_invalid');
  });

  it('maps server plus to premium', () => {
    expect(
      resolveSainaPlanTier({ isPlus: true, isLoading: false, source: 'server' }),
    ).toBe('premium');
  });

  it('maps server free to logged-in free', () => {
    expect(
      resolveSainaPlanTier({ isPlus: false, isLoading: false, source: 'server' }),
    ).toBe('free');
  });

  it('prefers account tier from entitlements over legacy plus flag', () => {
    expect(
      resolveSainaPlanTier({
        isPlus: false,
        isLoading: false,
        source: 'server',
        accountTier: 'mini',
      }),
    ).toBe('mini');
  });

  it('maps guest entitlements tier to anonymous', () => {
    expect(
      resolveSainaPlanTier({
        isPlus: false,
        isLoading: false,
        source: 'default',
        accountTier: 'guest',
      }),
    ).toBe('anonymous');
  });
});
