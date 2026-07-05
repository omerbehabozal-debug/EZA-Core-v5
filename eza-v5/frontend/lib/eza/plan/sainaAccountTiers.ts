import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

export type SainaUpgradePlanId = 'mini' | 'standard' | 'premium';

export type SainaUpgradePlanCard = {
  id: SainaUpgradePlanId;
  name: string;
  features: readonly string[];
  recommended?: boolean;
};

export const SAINA_UPGRADE_PLANS: readonly SainaUpgradePlanCard[] = [
  {
    id: 'mini',
    name: 'Mini',
    features: ['Günlük kullanım', 'Medium kalite', 'Geçmiş Aynalar'],
  },
  {
    id: 'standard',
    name: 'Standard',
    features: ['High kalite', 'Daha fazla Ayna', 'Koleksiyon', 'Öncelikli üretim'],
    recommended: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    features: ['En yüksek kalite', 'En hızlı üretim', 'Yeni özellikler', 'Profesyonel kullanım'],
  },
] as const;

const ACCOUNT_LABELS: Record<'free' | 'mini' | 'standard' | 'premium', string> = {
  free: 'SAINA Free',
  mini: 'SAINA Mini ✦',
  standard: 'SAINA Standard ✦',
  premium: 'SAINA Premium ✦',
};

/** Display label for profile menu and chrome. */
export function resolveSainaAccountLabel(planTier: SainaPlanTier): string | null {
  if (planTier === 'anonymous') return null;
  if (planTier === 'loading' || planTier === 'session_invalid') return null;
  return ACCOUNT_LABELS[planTier];
}

export function isSainaPaidTier(planTier: SainaPlanTier): boolean {
  return planTier === 'mini' || planTier === 'standard' || planTier === 'premium';
}

export function canUpgradeSainaAccount(planTier: SainaPlanTier): boolean {
  return planTier === 'free' || planTier === 'mini' || planTier === 'standard';
}

export type SainaSidebarFooterContent = {
  tierLabel: string;
  actionLabel?: string;
  showUpgrade: boolean;
  showLogin: boolean;
  paidAccent: boolean;
};

export function resolveSainaSidebarFooter(
  planTier: SainaPlanTier
): SainaSidebarFooterContent | null {
  switch (planTier) {
    case 'anonymous':
      return {
        tierLabel: 'SAINA Guest',
        actionLabel: 'Giriş Yap →',
        showUpgrade: false,
        showLogin: true,
        paidAccent: false,
      };
    case 'free':
      return {
        tierLabel: 'SAINA Free',
        actionLabel: 'Hesabını Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: false,
      };
    case 'mini':
      return {
        tierLabel: 'SAINA Mini ✦',
        actionLabel: 'Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: true,
      };
    case 'standard':
      return {
        tierLabel: 'SAINA Standard ✦',
        actionLabel: 'Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: true,
      };
    case 'premium':
      return {
        tierLabel: 'SAINA Premium ✦',
        showUpgrade: false,
        showLogin: false,
        paidAccent: true,
      };
    default:
      return null;
  }
}
