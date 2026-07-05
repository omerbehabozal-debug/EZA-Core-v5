'use client';

import { useEffect } from 'react';
import { hydrateAccountEntitlementsFromServer } from '@/lib/eza/plan/accountEntitlementsStore';
import { hydratePlanFromServer } from '@/lib/eza/plan/planStore';

/** Mirror layout mount — server plan + account entitlements hydrate. */
export default function PlanHydrator() {
  useEffect(() => {
    void (async () => {
      await hydratePlanFromServer();
      await hydrateAccountEntitlementsFromServer();
    })();
  }, []);
  return null;
}
