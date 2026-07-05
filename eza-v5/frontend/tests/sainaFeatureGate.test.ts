import { describe, expect, it } from 'vitest';
import { gatePremiumFeature } from '@/lib/eza/plan/sainaFeatureGate';

describe('gatePremiumFeature', () => {
  it('allows standard and premium users', () => {
    expect(gatePremiumFeature('premium')).toBe('allow');
    expect(gatePremiumFeature('standard')).toBe('allow');
  });

  it('requires upgrade for logged-in free and mini users', () => {
    expect(gatePremiumFeature('free')).toBe('upgrade_required');
    expect(gatePremiumFeature('mini')).toBe('upgrade_required');
  });

  it('requires auth for anonymous users', () => {
    expect(gatePremiumFeature('anonymous')).toBe('auth_required');
  });

  it('requires auth for invalid session users', () => {
    expect(gatePremiumFeature('session_invalid')).toBe('auth_required');
  });

  it('requires auth while plan is loading', () => {
    expect(gatePremiumFeature('loading')).toBe('auth_required');
  });
});
