'use client';

import { useEffect } from 'react';
import { hydratePlanFromServer } from '@/lib/eza/plan/planStore';

/** Mirror layout mount — server entitlement hydrate. */
export default function PlanHydrator() {
  useEffect(() => {
    void hydratePlanFromServer();
  }, []);
  return null;
}
