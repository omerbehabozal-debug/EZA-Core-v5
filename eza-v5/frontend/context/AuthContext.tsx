/**
 * Auth Context
 * Production-ready JWT authentication state management
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

interface UserInfo {
  email: string;
  role: string;
  user_id: string;
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  role: UserRole;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'eza_token';
const USER_STORAGE_KEY = 'eza_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    role: null,
  });

  // Load auth from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const userStr = localStorage.getItem(USER_STORAGE_KEY);
        
        if (token && userStr) {
          const user = JSON.parse(userStr);
          setAuthState({
            token,
            user,
            role: (user.role as UserRole) || null,
          });
        }
      } catch (error) {
        console.error('Failed to load auth from localStorage:', error);
        // Clear corrupted data
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  }, []);

  const setAuth = (token: string, user: UserInfo) => {
    const newState = {
      token,
      user,
      role: (user.role as UserRole) || null,
    };
    setAuthState(newState);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } catch (error) {
        console.error('Failed to save auth to localStorage:', error);
      }
    }
  };

  const logout = () => {
    setAuthState({ token: null, user: null, role: null });
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        // Also clear legacy storage keys for backward compatibility
        localStorage.removeItem('eza_auth');
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
