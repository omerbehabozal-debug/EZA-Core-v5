/**
 * RequireAuth Component
 * Production-ready route protection
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export default function RequireAuth({ 
  children, 
  allowedRoles,
  fallback 
}: RequireAuthProps) {
  const { token, role, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Give a moment for AuthContext to load from localStorage
    const checkAuth = () => {
      // Check localStorage directly as fallback
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('eza_token') : null;
      const hasToken = token || storedToken;
      
      if (!hasToken) {
        // Determine login path based on current location or hostname
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const isPlatform = pathname?.includes('/platform') || hostname === 'platform.ezacore.ai';
        const isProxy = pathname?.includes('/proxy') || hostname === 'proxy.ezacore.ai';
        const isCorporate = pathname?.includes('/corporate') || hostname === 'corporate.ezacore.ai';
        
        let loginPath = '/platform/login';
        if (isProxy) loginPath = '/proxy/login';
        else if (isCorporate) loginPath = '/corporate/login';
        else if (isPlatform) loginPath = '/platform/login';
        
        router.push(loginPath);
        return;
      }

      setIsChecking(false);
    };

    // Initial check
    checkAuth();

    // Also check after a short delay to allow AuthContext to initialize
    const timer = setTimeout(checkAuth, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, token, role, allowedRoles, router, pathname]);

  // Listen for auth-expired events from API calls (401/403 errors)
  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn('Auth expired event received, logging out...');
      logout();
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const isPlatform = pathname?.includes('/platform') || hostname === 'platform.ezacore.ai';
      const isProxy = pathname?.includes('/proxy') || hostname === 'proxy.ezacore.ai';
      const isCorporate = pathname?.includes('/corporate') || hostname === 'corporate.ezacore.ai';
      
      let loginPath = '/platform/login';
      if (isProxy) loginPath = '/proxy/login';
      else if (isCorporate) loginPath = '/corporate/login';
      else if (isPlatform) loginPath = '/platform/login';
      
      router.push(loginPath);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [logout, router, pathname]);

  // Still checking - show nothing to prevent flash
  if (isChecking) {
    return null;
  }

  // Not authenticated - redirect will happen in useEffect
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('eza_token') : null;
  if (!isAuthenticated && !token && !storedToken) {
    return null;
  }

  // Authenticated but wrong role
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Detect if we're on Platform or Proxy for theme
    const isPlatform = pathname?.includes('/platform');
    const bgColor = isPlatform ? 'var(--platform-bg-primary)' : 'var(--proxy-bg-primary)';
    const surfaceColor = isPlatform ? 'var(--platform-surface)' : 'var(--proxy-surface)';
    const textColor = isPlatform ? 'var(--platform-text-primary)' : 'var(--proxy-text-primary)';
    
    return fallback || (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: surfaceColor }}>
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: textColor }}>
            Access Denied
          </h1>
          <p className="text-sm mb-6" style={{ color: isPlatform ? 'var(--platform-text-secondary)' : 'var(--proxy-text-secondary)' }}>
            You don't have permission to access this page.
          </p>
          <p className="text-xs" style={{ color: isPlatform ? 'var(--platform-text-secondary)' : 'var(--proxy-text-secondary)' }}>
            Required roles: {allowedRoles.join(', ')}
          </p>
        </div>
      </div>
    );
  }

  // Authenticated and authorized
  return <>{children}</>;
}
