import { describe, expect, it } from 'vitest';
import {
  canUpgradeSainaAccount,
  isSainaPaidTier,
  resolveSainaAccountLabel,
  resolveSainaSidebarFooter,
} from '@/lib/eza/plan/sainaAccountTiers';

describe('sainaAccountTiers', () => {
  it('resolves account labels for each tier', () => {
    expect(resolveSainaAccountLabel('free')).toBe('SAINA Free');
    expect(resolveSainaAccountLabel('mini')).toBe('SAINA Mini ✦');
    expect(resolveSainaAccountLabel('standard')).toBe('SAINA Standard ✦');
    expect(resolveSainaAccountLabel('premium')).toBe('SAINA Premium ✦');
  });

  it('builds sidebar footer content per tier', () => {
    expect(resolveSainaSidebarFooter('anonymous')).toMatchObject({
      tierLabel: 'SAINA Guest',
      actionLabel: 'Giriş Yap →',
      showLogin: true,
    });
    expect(resolveSainaSidebarFooter('free')).toMatchObject({
      tierLabel: 'SAINA Free',
      actionLabel: 'Hesabını Yükselt →',
      showUpgrade: true,
    });
    expect(resolveSainaSidebarFooter('premium')).toMatchObject({
      tierLabel: 'SAINA Premium ✦',
      showUpgrade: false,
    });
  });

  it('flags paid and upgradeable tiers', () => {
    expect(isSainaPaidTier('mini')).toBe(true);
    expect(isSainaPaidTier('free')).toBe(false);
    expect(canUpgradeSainaAccount('standard')).toBe(true);
    expect(canUpgradeSainaAccount('premium')).toBe(false);
  });
});
