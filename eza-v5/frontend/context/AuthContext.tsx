/**
 * Auth Context
 * Production-ready JWT authentication state management
 *
 * Phase 8.3.1:
 * - Browser close is not logout — valid sessions persist after reopen.
 * - Startup validates persisted token (JWT exp + /api/auth/me).
 * - Guest→user merge only when pending guest work exists.
 * - Logout clears auth and rotates guest identity (account buckets stay hidden).
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { notifyAuthChanged } from '@/lib/eza/plan/planStore';
import { mergeGuestConversationTree } from '@/lib/eza/conversation-tree/mergeGuestConversationTree';
import {
  peekMirrorGuestToken,
  rotateMirrorGuestToken,
} from '@/lib/eza/mirror-network/guestToken';
import { validateAuthSession } from '@/lib/eza/plan/fetchAuthMe';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  isJwtExpired,
} from '@/lib/eza/localIdentityScope';
import { CHATS_UPDATED_EVENT } from '@/lib/standaloneChatArchive';
import { GROUPS_UPDATED_EVENT } from '@/lib/eza/conversation-tree/conversationGroups';

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
  full_name?: string;
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
  /** False until localStorage auth has been read and validated (avoids pre-hydration API calls / login flash). */
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('eza_auth');
}

function persistAuth(token: string, user: UserInfo): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function notifyConversationVisibilityChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
  window.dispatchEvent(new CustomEvent(GROUPS_UPDATED_EVENT));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    user: null,
    role: null,
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const guestMergeRanRef = useRef(false);

  const bindGuestConversationTree = (token: string, user: UserInfo) => {
    const guestToken = peekMirrorGuestToken();
    if (!guestToken) return;
    void mergeGuestConversationTree({
      userId: user.user_id,
      guestToken,
      authToken: token,
    }).then(() => {
      notifyConversationVisibilityChanged();
    });
  };

  // Load + validate auth from localStorage on mount (browser reopen persistence).
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsAuthReady(true);
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const userStr = localStorage.getItem(USER_STORAGE_KEY);

        if (!token || !userStr) {
          if (!cancelled) {
            setAuthState({ token: null, user: null, role: null });
            setIsAuthReady(true);
          }
          return;
        }

        let user: UserInfo;
        try {
          user = JSON.parse(userStr) as UserInfo;
        } catch {
          clearAuthStorage();
          if (!cancelled) {
            setAuthState({ token: null, user: null, role: null });
            setIsAuthReady(true);
          }
          return;
        }

        if (!user?.user_id) {
          clearAuthStorage();
          if (!cancelled) {
            setAuthState({ token: null, user: null, role: null });
            setIsAuthReady(true);
          }
          return;
        }

        const expired = isJwtExpired(token);
        if (expired === true) {
          clearAuthStorage();
          if (!cancelled) {
            setAuthState({ token: null, user: null, role: null });
            setIsAuthReady(true);
            notifyAuthChanged();
            notifyConversationVisibilityChanged();
          }
          return;
        }

        const result = await validateAuthSession();
        if (cancelled) return;

        if (result.status === 'invalid') {
          clearAuthStorage();
          setAuthState({ token: null, user: null, role: null });
          setIsAuthReady(true);
          notifyAuthChanged();
          notifyConversationVisibilityChanged();
          return;
        }

        const nextUser: UserInfo =
          result.status === 'valid'
            ? {
                ...user,
                user_id: result.session.user_id,
                email: result.session.email || user.email,
                role: result.session.role || user.role,
              }
            : user;

        persistAuth(token, nextUser);
        setAuthState({
          token,
          user: nextUser,
          role: (nextUser.role as UserRole) || null,
        });
        setIsAuthReady(true);
      } catch (error) {
        console.error('Failed to hydrate auth:', error);
        // Do not wipe a persisted session on unexpected hydrate errors;
        // JWT expiry + explicit invalid /me responses already clear.
        if (!cancelled) {
          try {
            const token = localStorage.getItem(TOKEN_STORAGE_KEY);
            const userStr = localStorage.getItem(USER_STORAGE_KEY);
            if (token && userStr) {
              const user = JSON.parse(userStr) as UserInfo;
              if (user?.user_id) {
                setAuthState({
                  token,
                  user,
                  role: (user.role as UserRole) || null,
                });
                setIsAuthReady(true);
                return;
              }
            }
          } catch {
            /* fall through */
          }
          setAuthState({ token: null, user: null, role: null });
          setIsAuthReady(true);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-bind guest tree after refresh when session already exists — only if pending work.
  useEffect(() => {
    if (!isAuthReady || !authState.token || !authState.user?.user_id) return;
    if (guestMergeRanRef.current) return;
    guestMergeRanRef.current = true;
    bindGuestConversationTree(authState.token, authState.user);
  }, [isAuthReady, authState.token, authState.user?.user_id]);

  const setAuth = (token: string, user: UserInfo) => {
    const newState = {
      token,
      user,
      role: (user.role as UserRole) || null,
    };
    setAuthState(newState);
    guestMergeRanRef.current = true;

    if (typeof window !== 'undefined') {
      try {
        persistAuth(token, user);
      } catch (error) {
        console.error('Failed to save auth to localStorage:', error);
      }
      notifyAuthChanged();
      notifyConversationVisibilityChanged();
      bindGuestConversationTree(token, user);
    }
  };

  const logout = () => {
    setAuthState({ token: null, user: null, role: null });
    guestMergeRanRef.current = false;

    if (typeof window !== 'undefined') {
      try {
        clearAuthStorage();
        // Phase 8.3 / 8.3.1 — new anonymous identity after logout (shared-device isolation).
        // Account-scoped chat buckets remain on device but are no longer visible.
        rotateMirrorGuestToken();
      } catch (error) {
        console.error('Failed to clear auth from localStorage:', error);
      }
      notifyAuthChanged();
      notifyConversationVisibilityChanged();
    }
  };

  const value: AuthContextType = {
    ...authState,
    setAuth,
    logout,
    isAuthenticated: !!authState.token,
    isAuthReady,
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
