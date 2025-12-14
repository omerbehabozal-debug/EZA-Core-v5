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
    // Detect if we're on Platform or Proxy for theme
    const isPlatform = typeof window !== 'undefined' && window.location.pathname.includes('/platform');
    const bgColor = isPlatform ? 'var(--platform-bg-primary)' : 'var(--proxy-bg-primary)';
    const surfaceColor = isPlatform ? 'var(--platform-surface)' : 'var(--proxy-surface)';
    const textPrimary = isPlatform ? 'var(--platform-text-primary)' : 'var(--proxy-text-primary)';
    const textSecondary = isPlatform ? 'var(--platform-text-secondary)' : 'var(--proxy-text-secondary)';
    const actionColor = isPlatform ? 'var(--platform-action-primary)' : 'var(--proxy-action-primary)';
    
    return (
      fallback || (
        <div 
          className="flex items-center justify-center min-h-screen"
          style={{ backgroundColor: bgColor }}
        >
          <div 
            className="text-center p-8 rounded-xl"
            style={{
              backgroundColor: surfaceColor,
              border: `1px solid ${isPlatform ? 'var(--platform-border)' : 'var(--proxy-border-soft)'}`,
            }}
          >
            <div className="text-4xl mb-4">🔒</div>
            <h1 
              className="text-2xl font-bold mb-4"
              style={{ color: textPrimary }}
            >
              Access Denied
            </h1>
            <p 
              className="mb-6"
              style={{ color: textSecondary }}
            >
              You don't have permission to access this page.
            </p>
            <p 
              className="text-sm mb-6"
              style={{ color: textSecondary }}
            >
              Required roles: {allowedRoles.join(', ')}
              <br />
              Your role: {role || 'none'}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: actionColor,
                color: '#FFFFFF',
              }}
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

