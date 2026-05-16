'use client';

import useSWR from 'swr';
import { getGovernanceOverview } from '@/api/governance';
import type { GovernanceOverview } from '@/lib/types/governance';

export function useGovernanceOverview(orgId: string | null) {
  return useSWR<GovernanceOverview>(
    orgId ? ['governance-overview', orgId] : null,
    () => getGovernanceOverview(orgId!),
    { revalidateOnFocus: false }
  );
}
