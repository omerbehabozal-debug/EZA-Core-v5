'use client';

import RequireAuth from '@/components/auth/RequireAuth';
import GovernanceShell from '@/components/Layout/GovernanceShell';

export default function GovernanceMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <GovernanceShell>{children}</GovernanceShell>
    </RequireAuth>
  );
}
