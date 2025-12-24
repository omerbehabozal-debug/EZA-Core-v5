/**
 * Frontend Auth Guard for Regulator Panel
 * 
 * CRITICAL: This is FRONTEND-ONLY enforcement.
 * Backend does NOT have new RBAC for regulators.
 * 
 * Only allows: REGULATOR_READONLY, REGULATOR_AUDITOR roles
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_ROLES = ['REGULATOR_READONLY', 'REGULATOR_AUDITOR'];

interface User {
  id: string;
  email: string;
  role: string;
  org_id?: string;
}

export function useRegulatorAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for auth token
    const token = localStorage.getItem('regulator_token');
    
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
        localStorage.removeItem('regulator_token');
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
      localStorage.removeItem('regulator_token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem('regulator_token');
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
 * HOC: Protect route with regulator auth
 */
export function withRegulatorAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { loading, isAuthorized } = useRegulatorAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    if (!isAuthorized) {
      return null; // Redirect handled by useRegulatorAuth
    }

    return <Component {...props} />;
  };
}

