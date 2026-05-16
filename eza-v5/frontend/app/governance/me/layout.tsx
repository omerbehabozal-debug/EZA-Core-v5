'use client';

import RequireAuth from '@/components/auth/RequireAuth';
import GovernanceShell from '@/components/Layout/GovernanceShell';
import GovernanceReportErrorBoundary from '@/components/governance/GovernanceReportErrorBoundary';

export default function GovernanceMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <GovernanceShell>
        <GovernanceReportErrorBoundary>{children}</GovernanceReportErrorBoundary>
      </GovernanceShell>
    </RequireAuth>
  );
}
