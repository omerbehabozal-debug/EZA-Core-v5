/**
 * Auth Context
 * JWT authentication state management
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Proxy roles (operational users)
export type ProxyRole = 'proxy_user' | 'reviewer' | 'auditor';

// Platform roles (management users)
export type PlatformRole = 'org_admin' | 'ops' | 'finance' | 'admin';

// Legacy roles (for backward compatibility)
export type LegacyRole = 'corporate' | 'regulator';

// Combined role type
export type UserRole = ProxyRole | PlatformRole | LegacyRole | null;

interface AuthState {
  token: string | null;
  role: UserRole;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'eza_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    role: null,
  });

  // Load auth from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setAuthState({
            token: parsed.token || null,
            role: parsed.role || null,
          });
        }
      } catch (error) {
        console.error('Failed to load auth from localStorage:', error);
      }
    }
  }, []);

  const setAuth = (token: string, role: UserRole) => {
    const newState = { token, role };
    setAuthState(newState);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newState));
      } catch (error) {
        console.error('Failed to save auth to localStorage:', error);
      }
    }
  };

  const logout = () => {
    setAuthState({ token: null, role: null });
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear auth from localStorage:', error);
      }
    }
  };

  const value: AuthContextType = {
    ...authState,
    setAuth,
    logout,
    isAuthenticated: !!authState.token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

