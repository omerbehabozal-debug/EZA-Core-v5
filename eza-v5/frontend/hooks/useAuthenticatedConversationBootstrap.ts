'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  bootstrapServerConversations,
  clearServerConversationState,
  getServerConversationSummaries,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';
import { runLegacyConversationMigration } from '@/lib/eza/legacyConversationMigration';

/**
 * After auth identity resolves, bootstrap server conversation list,
 * then run Phase 8.8G-3 legacy migration when eligible.
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

    let cancelled = false;

    const run = async () => {
      const ok = await bootstrapServerConversations(userId);
      if (cancelled || !ok) return;
      await runLegacyConversationMigration(userId);
    };

    void run();
    return () => {
      cancelled = true;
    };
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
