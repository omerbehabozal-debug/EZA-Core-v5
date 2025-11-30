/**
 * RequireAuth Component
 * Protects routes that require authentication
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export default function RequireAuth({ 
  children, 
  allowedRoles,
  fallback 
}: RequireAuthProps) {
  const { token, role, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated || !token) {
      router.push('/login');
      return;
    }

    // Check role
    if (role && !allowedRoles.includes(role)) {
      // Role not allowed - stay on page but show access denied
      // (fallback will be shown)
    }
  }, [isAuthenticated, token, role, allowedRoles, router]);

  // Not authenticated - redirect will happen in useEffect
  if (!isAuthenticated || !token) {
    return null;
  }

  // Authenticated but wrong role
  if (role && !allowedRoles.includes(role)) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-gray-500">
              Required roles: {allowedRoles.join(', ')}
              <br />
              Your role: {role || 'none'}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      )
    );
  }

  // Authenticated and role matches
  return <>{children}</>;
}

