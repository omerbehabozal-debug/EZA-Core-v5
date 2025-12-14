/**
 * Client Layout Wrapper
 * Wraps children with AuthProvider (client component)
 */

'use client';

import { AuthProvider } from '@/context/AuthContext';
import { OrganizationProvider } from '@/context/OrganizationContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        {children}
      </OrganizationProvider>
    </AuthProvider>
  );
}

