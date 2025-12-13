/**
 * Client Layout Wrapper
 * Wraps children with AuthProvider (client component)
 */

'use client';

import { AuthProvider } from '@/context/AuthContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

