'use client';

import RequireAuth from '@/components/auth/RequireAuth';
import GovernanceShell from '@/components/Layout/GovernanceShell';
import GovernanceOrgBar from '@/components/governance/GovernanceOrgBar';
import { useOrganization } from '@/context/OrganizationContext';

export default function AdminGovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentOrganization } = useOrganization();

  return (
    <RequireAuth allowedRoles={['admin']}>
      <GovernanceShell
        orgLabel={currentOrganization?.name}
        headerActions={<GovernanceOrgBar />}
      >
        {children}
      </GovernanceShell>
    </RequireAuth>
  );
}
