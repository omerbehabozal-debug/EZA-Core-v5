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
import {
  validateAuthSession,
  type AuthSessionValidationResult,
} from '@/lib/eza/plan/fetchAuthMe';
import { mergeAvatarAuthorityFields } from '@/lib/eza/profile/authoritativeAvatar';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  isJwtExpired,
} from '@/lib/eza/localIdentityScope';
import { setMemoryAuthToken } from '@/lib/eza/authTokenStore';
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
  /** Phase 8.5 — explicit public display name (owner-controlled). */
  public_display_name?: string | null;
  /** Public profile photo URL (owner-controlled). */
  public_avatar_url?: string | null;
  /** Server-authoritative monotonic avatar revision from PostgreSQL. */
  public_avatar_revision?: number;
  /** Public honorific id: curious | bilgin. Never a plan or role. */
  public_honorific?: string | null;
  /** Product-scoped capabilities from /me (hint; backend enforces). */
  capabilities?: string[];
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  role: UserRole;
}

interface AuthContextType extends AuthState {
  setAuth: (token: string, user: UserInfo) => void;
  /** Merge partial profile fields into the persisted session user. */
  patchAuthUser: (patch: Partial<UserInfo>) => void;
  logout: () => void;
  isAuthenticated: boolean;
  /** False until localStorage auth has been read and validated (avoids pre-hydration API calls / login flash). */
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearAuthStorage(): void {
  setMemoryAuthToken(null);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('eza_auth');
}

function persistAuth(token: string, user: UserInfo): void {
  setMemoryAuthToken(token);
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

        let sessionResult: AuthSessionValidationResult = result;
        if (result.status === 'unavailable') {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          if (cancelled) return;
          const retry = await validateAuthSession();
          if (retry.status === 'valid' || retry.status === 'invalid') {
            sessionResult = retry;
          }
          if (retry.status === 'invalid') {
            clearAuthStorage();
            setAuthState({ token: null, user: null, role: null });
            setIsAuthReady(true);
            notifyAuthChanged();
            notifyConversationVisibilityChanged();
            return;
          }
        }

        const nextUser: UserInfo =
          sessionResult.status === 'valid'
            ? mergeAvatarAuthorityFields(
                {
                  ...user,
                  user_id: sessionResult.session.user_id,
                  email: sessionResult.session.email || user.email,
                  role: sessionResult.session.role || user.role,
                  public_display_name:
                    sessionResult.session.public_display_name !== undefined
                      ? sessionResult.session.public_display_name
                      : user.public_display_name,
                  // Keep legacy full_name aligned with authoritative public profile name.
                  full_name:
                    sessionResult.session.public_display_name !== undefined &&
                    sessionResult.session.public_display_name
                      ? sessionResult.session.public_display_name
                      : user.full_name,
                  public_honorific:
                    sessionResult.session.public_honorific !== undefined
                      ? sessionResult.session.public_honorific
                      : user.public_honorific,
                  capabilities:
                    sessionResult.session.capabilities !== undefined
                      ? sessionResult.session.capabilities
                      : user.capabilities,
                },
                {
                  public_avatar_url: sessionResult.session.public_avatar_url,
                  public_avatar_revision: sessionResult.session.public_avatar_revision,
                }
              )
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
                setMemoryAuthToken(token);
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

  // Cross-tab + focus sync: BiligN / Business / Admin share one AuthContext identity.
  // Profile name/avatar writes update localStorage; other tabs pick up via storage.
  // Visibility revalidates /me so a long-lived panel reflects server truth after rename.
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthReady) return;

    let refreshInFlight = false;
    let lastRefreshAt = 0;
    const REFRESH_MIN_INTERVAL_MS = 8000;

    const applyStoredUser = () => {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const userStr = localStorage.getItem(USER_STORAGE_KEY);
        if (!token || !userStr) {
          setAuthState({ token: null, user: null, role: null });
          setMemoryAuthToken(null);
          return;
        }
        const user = JSON.parse(userStr) as UserInfo;
        if (!user?.user_id) return;
        setMemoryAuthToken(token);
        setAuthState({
          token,
          user,
          role: (user.role as UserRole) || null,
        });
      } catch {
        /* ignore malformed cross-tab payloads */
      }
    };

    const softRefreshFromServer = async () => {
      const now = Date.now();
      if (refreshInFlight || now - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) return;
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const userStr = localStorage.getItem(USER_STORAGE_KEY);
      if (!token || !userStr) return;
      let user: UserInfo;
      try {
        user = JSON.parse(userStr) as UserInfo;
      } catch {
        return;
      }
      if (!user?.user_id) return;
      refreshInFlight = true;
      try {
        const result = await validateAuthSession();
        if (result.status !== 'valid') return;
        const nextUser = mergeAvatarAuthorityFields(
          {
            ...user,
            user_id: result.session.user_id,
            email: result.session.email || user.email,
            role: result.session.role || user.role,
            public_display_name:
              result.session.public_display_name !== undefined
                ? result.session.public_display_name
                : user.public_display_name,
            full_name:
              result.session.public_display_name !== undefined &&
              result.session.public_display_name
                ? result.session.public_display_name
                : user.full_name,
            public_honorific:
              result.session.public_honorific !== undefined
                ? result.session.public_honorific
                : user.public_honorific,
            capabilities:
              result.session.capabilities !== undefined
                ? result.session.capabilities
                : user.capabilities,
          },
          {
            public_avatar_url: result.session.public_avatar_url,
            public_avatar_revision: result.session.public_avatar_revision,
          }
        );
        const unchanged =
          nextUser.public_display_name === user.public_display_name &&
          nextUser.public_avatar_url === user.public_avatar_url &&
          nextUser.public_avatar_revision === user.public_avatar_revision &&
          nextUser.public_honorific === user.public_honorific &&
          nextUser.email === user.email &&
          nextUser.role === user.role;
        lastRefreshAt = Date.now();
        if (unchanged) return;
        persistAuth(token, nextUser);
        setAuthState({
          token,
          user: nextUser,
          role: (nextUser.role as UserRole) || null,
        });
      } finally {
        refreshInFlight = false;
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== USER_STORAGE_KEY && event.key !== TOKEN_STORAGE_KEY) return;
      applyStoredUser();
    };

    let visibilityTimer: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
      visibilityTimer = window.setTimeout(() => {
        void softRefreshFromServer();
      }, 400);
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      if (visibilityTimer != null) window.clearTimeout(visibilityTimer);
    };
  }, [isAuthReady]);

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

  const patchAuthUser = (patch: Partial<UserInfo>) => {
    setAuthState((prev) => {
      if (!prev.token || !prev.user) return prev;
      const { public_avatar_url, public_avatar_revision, ...rest } = patch;
      let user: UserInfo = { ...prev.user, ...rest };
      if (
        public_avatar_url !== undefined ||
        public_avatar_revision !== undefined
      ) {
        user = mergeAvatarAuthorityFields(user, {
          public_avatar_url,
          public_avatar_revision,
        });
      }
      const newState = {
        ...prev,
        user,
        role: (user.role as UserRole) || null,
      };
      if (typeof window !== 'undefined') {
        try {
          persistAuth(prev.token, user);
        } catch (error) {
          console.error('Failed to save auth to localStorage:', error);
        }
        notifyAuthChanged();
        notifyConversationVisibilityChanged();
      }
      return newState;
    });
    guestMergeRanRef.current = true;
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
    patchAuthUser,
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
