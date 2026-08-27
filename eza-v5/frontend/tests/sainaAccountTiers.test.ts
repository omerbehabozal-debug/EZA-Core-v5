import { describe, expect, it } from 'vitest';
import {
  canUpgradeSainaAccount,
  isSainaPaidTier,
  resolveSainaAccountLabel,
  resolveSainaSidebarFooter,
} from '@/lib/eza/plan/sainaAccountTiers';

describe('sainaAccountTiers', () => {
  it('resolves account labels for each tier', () => {
    expect(resolveSainaAccountLabel('free')).toBe('biligN Free');
    expect(resolveSainaAccountLabel('mini')).toBe('biligN Mini ✦');
    expect(resolveSainaAccountLabel('standard')).toBe('biligN Standard ✦');
    expect(resolveSainaAccountLabel('premium')).toBe('biligN Premium ✦');
  });

  it('builds sidebar footer content per tier', () => {
    expect(resolveSainaSidebarFooter('anonymous')).toMatchObject({
      tierLabel: 'biligN Guest',
      actionLabel: 'Giriş Yap →',
      showLogin: true,
    });
    expect(resolveSainaSidebarFooter('free')).toMatchObject({
      tierLabel: 'biligN Free',
      actionLabel: 'Hesabını Yükselt →',
      showUpgrade: true,
    });
    expect(resolveSainaSidebarFooter('premium')).toMatchObject({
      tierLabel: 'biligN Premium ✦',
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
