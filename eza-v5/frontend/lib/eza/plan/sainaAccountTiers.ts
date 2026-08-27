import {
  SAINA_FREE_TITLE,
  SAINA_GUEST_TITLE,
  SAINA_MINI_TITLE,
  SAINA_PREMIUM_TITLE,
  SAINA_STANDARD_TITLE,
} from '@/lib/eza/sainaCopy';
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
    features: ['Daha fazla mesaj', 'Medium kalite görsel', 'İlişki Deseni (90 gün)'],
  },
  {
    id: 'standard',
    name: 'Standard',
    features: ['High kalite görsel', 'Günlük Ayna', 'Tam İlişki Deseni', 'Öncelikli üretim'],
    recommended: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    features: ['En yüksek kalite', 'En hızlı üretim', 'Tam İlişki Deseni', 'Geniş kullanım'],
  },
] as const;

const ACCOUNT_LABELS: Record<'free' | 'mini' | 'standard' | 'premium', string> = {
  free: SAINA_FREE_TITLE,
  mini: SAINA_MINI_TITLE,
  standard: SAINA_STANDARD_TITLE,
  premium: SAINA_PREMIUM_TITLE,
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
        tierLabel: SAINA_GUEST_TITLE,
        actionLabel: 'Giriş Yap →',
        showUpgrade: false,
        showLogin: true,
        paidAccent: false,
      };
    case 'free':
      return {
        tierLabel: SAINA_FREE_TITLE,
        actionLabel: 'Hesabını Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: false,
      };
    case 'mini':
      return {
        tierLabel: SAINA_MINI_TITLE,
        actionLabel: 'Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: true,
      };
    case 'standard':
      return {
        tierLabel: SAINA_STANDARD_TITLE,
        actionLabel: 'Yükselt →',
        showUpgrade: true,
        showLogin: false,
        paidAccent: true,
      };
    case 'premium':
      return {
        tierLabel: SAINA_PREMIUM_TITLE,
        showUpgrade: false,
        showLogin: false,
        paidAccent: true,
      };
    default:
      return null;
  }
}
