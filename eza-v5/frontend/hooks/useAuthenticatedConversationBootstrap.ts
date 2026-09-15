'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  bootstrapServerConversations,
  clearServerConversationState,
  getServerAuthorityPhase,
  getServerConversationAuthority,
  getServerConversationSummaries,
  getSidebarAuthorityMode,
  getUnsyncedClientIds,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';
import {
  bootstrapServerConversationGroups,
  clearServerConversationGroupState,
} from '@/lib/eza/serverConversationGroupStore';
import {
  getLegacyMigrationMarker,
  runLegacyConversationMigration,
} from '@/lib/eza/legacyConversationMigration';
import { reconcileAuthenticatedConversationSidebar } from '@/lib/eza/reconcileAuthenticatedConversationSidebar';
import { hydrateOwnerYansiPreparationsFromServer } from '@/lib/eza/mirror/journey/hydrateOwnerYansiPreparationsFromServer';
import {
  CHATS_UPDATED_EVENT,
  readChatArchivesForScope,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { userScope } from '@/lib/eza/localIdentityScope';

const EMPTY_SERVER_SUMMARIES: ArchivedChatSummary[] = [];

/**
 * After auth identity resolves, bootstrap server conversation list,
 * then run Phase 8.8G-3 legacy migration when eligible.
 * Clears in-memory server state immediately on logout / account switch.
 *
 * Phase 8.8G-3.2 — returns reconciled sidebar summaries (server + safe
 * owner-local fallbacks), not raw server-only rows.
 *
 * Phase 8.8G-3.2.2 — while server authority is loading/failed without a
 * complete snapshot, use degraded current-user local visibility so FAILED
 * is never treated as SUCCESS_EMPTY.
 *
 * Phase 8.8G-5.3.2 — also bootstrap authenticated conversation groups.
 */
export function useAuthenticatedConversationBootstrap() {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const userId = user?.user_id ?? null;
  const [archiveEpoch, setArchiveEpoch] = useState(0);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated || !userId) {
      clearServerConversationState();
      clearServerConversationGroupState();
      return;
    }

    let cancelled = false;

    const run = async () => {
      const ok = await bootstrapServerConversations(userId);
      if (cancelled) return;
      await bootstrapServerConversationGroups(userId);
      if (cancelled || !ok) return;
      await runLegacyConversationMigration(userId);
      if (cancelled) return;
      // Owner-wide Yansı inventory — failure must not block conversations.
      try {
        const authority = getServerConversationAuthority();
        await hydrateOwnerYansiPreparationsFromServer({
          ownerUserId: userId,
          ownerAtStart: authority.ownerKey,
          epochAtStart: authority.epoch,
        });
      } catch {
        /* keep conversations + any local artifacts */
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isAuthenticated, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bump = () => setArchiveEpoch((n) => n + 1);
    window.addEventListener(CHATS_UPDATED_EVENT, bump);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, bump);
  }, []);

  const serverOnlySummaries = useSyncExternalStore(
    subscribeServerConversations,
    getServerConversationSummaries,
    () => EMPTY_SERVER_SUMMARIES
  );

  const authorityPhase = useSyncExternalStore(
    subscribeServerConversations,
    getServerAuthorityPhase,
    () => 'none' as const
  );

  const serverSummaries = useMemo(() => {
    if (!isAuthReady || !isAuthenticated || !userId) {
      return EMPTY_SERVER_SUMMARIES;
    }
    const marker = getLegacyMigrationMarker(userId);
    const tombstonedClientIds: string[] = [];
    if (marker?.conversations) {
      for (const [id, state] of Object.entries(marker.conversations)) {
        if (state?.status === 'tombstoned') tombstonedClientIds.push(id);
      }
    }
    const mode = getSidebarAuthorityMode();
    return reconcileAuthenticatedConversationSidebar({
      ownerId: userId,
      serverSummaries: serverOnlySummaries,
      ownerLocalArchives: readChatArchivesForScope(userScope(userId)),
      migrationMarker: marker,
      tombstonedClientIds,
      unsyncedClientIds: getUnsyncedClientIds(),
      mode,
    });
    // archiveEpoch / authorityPhase force recompute on local or authority flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthReady,
    isAuthenticated,
    userId,
    serverOnlySummaries,
    archiveEpoch,
    authorityPhase,
  ]);

  return {
    isServerBacked: isAuthReady && isAuthenticated && Boolean(userId),
    serverSummaries,
    userId,
  };
}
