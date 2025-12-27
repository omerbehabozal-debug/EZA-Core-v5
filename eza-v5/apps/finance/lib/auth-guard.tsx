/**
 * Frontend Auth Guard for Finance Panel
 * 
 * CRITICAL: This is FRONTEND-ONLY enforcement.
 * Backend validates Finance roles.
 * 
 * Only allows: REGULATOR_FINANCE, REGULATOR_BDDK, REGULATOR_SPK roles
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_ROLES = ['REGULATOR_FINANCE', 'REGULATOR_BDDK', 'REGULATOR_SPK'];

interface User {
  id: string;
  email: string;
  role: string;
  org_id?: string;
}

export function useFinanceAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for auth token
    const token = localStorage.getItem('finance_token');
    
    if (!token) {
      // No token - redirect to login
      router.push('/login');
      return;
    }

    // Decode JWT token (simple decode, no verification - backend handles verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userRole = payload.role || payload.roles?.[0];
      
      // Check if role is allowed
      if (!ALLOWED_ROLES.includes(userRole)) {
        console.error('User role not allowed:', userRole);
        localStorage.removeItem('finance_token');
        router.push('/unauthorized');
        return;
      }

      const userData: User = {
        id: payload.sub || payload.user_id || '',
        email: payload.email || '',
        role: userRole,
        org_id: payload.org_id,
      };

      setUser(userData);
      setIsAuthorized(true);
    } catch (error) {
      console.error('Token decode error:', error);
      localStorage.removeItem('finance_token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem('finance_token');
    setUser(null);
    setIsAuthorized(false);
    router.push('/login');
  };

  return {
    user,
    loading,
    isAuthorized,
    logout,
  };
}

/**
 * HOC: Protect route with Finance auth
 */
export function withFinanceAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { loading, isAuthorized } = useFinanceAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Yükleniyor...</div>
        </div>
      );
    }

    if (!isAuthorized) {
      return null; // Redirect handled by useFinanceAuth
    }

    return <Component {...props} />;
  };
}

