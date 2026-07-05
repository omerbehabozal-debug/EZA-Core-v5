'use client';

import { useCallback, useState, type ReactNode } from 'react';
import IdentityModal from '@/components/plan/IdentityModal';
import UpgradeModal from '@/components/plan/UpgradeModal';
import { canUpgradeSainaAccount } from '@/lib/eza/plan/sainaAccountTiers';
import { gatePremiumFeature } from '@/lib/eza/plan/sainaFeatureGate';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

type UseSainaGateModalsOptions = {
  planTier: SainaPlanTier;
  defaultUpgradeFeature?: string;
};

export function useSainaGateModals({
  planTier,
  defaultUpgradeFeature = 'saina_sidebar',
}: UseSainaGateModalsOptions) {
  const [identityOpen, setIdentityOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState(defaultUpgradeFeature);

  const openGateModal = useCallback(
    (feature: string) => {
      const outcome = gatePremiumFeature(planTier);
      setUpgradeFeature(feature);
      if (outcome === 'upgrade_required') {
        setUpgradeOpen(true);
      } else {
        setIdentityOpen(true);
      }
    },
    [planTier]
  );

  const handleRequestLogin = useCallback(() => {
    setIdentityOpen(true);
  }, []);

  const handleOpenUpgrade = useCallback(
    (feature = defaultUpgradeFeature) => {
      if (canUpgradeSainaAccount(planTier)) {
        setUpgradeFeature(feature);
        setUpgradeOpen(true);
        return;
      }
      setIdentityOpen(true);
    },
    [defaultUpgradeFeature, planTier]
  );

  const gateModals: ReactNode = (
    <>
      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeFeature}
      />
    </>
  );

  return {
    identityOpen,
    upgradeOpen,
    upgradeFeature,
    setIdentityOpen,
    setUpgradeOpen,
    setUpgradeFeature,
    openGateModal,
    handleRequestLogin,
    handleOpenUpgrade,
    gateModals,
  };
}
