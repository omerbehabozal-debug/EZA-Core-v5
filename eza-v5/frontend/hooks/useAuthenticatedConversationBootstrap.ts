'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  bootstrapServerConversations,
  clearServerConversationState,
  getServerConversationSummaries,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';

/**
 * After auth identity resolves, bootstrap server conversation list.
 * Clears in-memory server state immediately on logout / account switch.
 */
export function useAuthenticatedConversationBootstrap() {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const userId = user?.user_id ?? null;

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated || !userId) {
      clearServerConversationState();
      return;
    }
    void bootstrapServerConversations(userId);
  }, [isAuthReady, isAuthenticated, userId]);

  const serverSummaries = useSyncExternalStore(
    subscribeServerConversations,
    getServerConversationSummaries,
    () => []
  );

  return {
    isServerBacked: isAuthReady && isAuthenticated && Boolean(userId),
    serverSummaries,
    userId,
  };
}
