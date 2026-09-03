'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildConversationYansiStatusMap,
  type ConversationYansiVisualStatus,
} from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import {
  getOwnerYansiPublicationSnapshot,
  hydrateOwnerYansiPublicationAuthority,
  markOwnerYansiPublicationAuthorityReadyEmpty,
  subscribeOwnerYansiPublicationAuthority,
} from '@/lib/eza/mirror/journey/ownerYansiPublicationAuthority';
import {
  listAllJourneyArtifactsForOwner,
  subscribeMirrorJourneyArtifactStore,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { isGuestJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import {
  getServerConversationSummaries,
  subscribeServerConversations,
} from '@/lib/eza/serverConversationStore';

export function useConversationYansiStatusMap(
  ownerUserId: string | null | undefined,
  options?: { isAuthenticated?: boolean; isAuthReady?: boolean }
): Record<string, ConversationYansiVisualStatus> {
  const [artifactTick, setArtifactTick] = useState(0);
  const [publication, setPublication] = useState(getOwnerYansiPublicationSnapshot);
  const [serverTick, setServerTick] = useState(0);

  useEffect(() => {
    return subscribeMirrorJourneyArtifactStore(() => {
      setArtifactTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeOwnerYansiPublicationAuthority(() => {
      setPublication(getOwnerYansiPublicationSnapshot());
    });
  }, []);

  useEffect(() => {
    return subscribeServerConversations(() => {
      setServerTick((n) => n + 1);
    });
  }, []);

  const owner = (ownerUserId || '').trim();
  const isGuest = !owner || isGuestJourneyOwnerKey(owner);
  const canFetchAuthority =
    Boolean(options?.isAuthenticated) && options?.isAuthReady !== false && !isGuest;

  useEffect(() => {
    if (canFetchAuthority) {
      void hydrateOwnerYansiPublicationAuthority();
      return;
    }
    markOwnerYansiPublicationAuthorityReadyEmpty();
  }, [canFetchAuthority, owner]);

  return useMemo(() => {
    void artifactTick;
    void serverTick;
    const artifacts = listAllJourneyArtifactsForOwner(owner);
    const summaries = canFetchAuthority ? getServerConversationSummaries() : [];
    const serverReadyByConversationId: Record<string, boolean> = {};
    const serverPublishedSlugByConversationId: Record<string, string | null> = {};
    const extraConversationIds: string[] = [];
    for (let i = 0; i < summaries.length; i += 1) {
      const row = summaries[i];
      if (!row?.id) continue;
      extraConversationIds.push(row.id);
      serverReadyByConversationId[row.id] = Boolean(row.hasReadyYansi);
      serverPublishedSlugByConversationId[row.id] = row.publishedYansiSlug ?? null;
    }
    return buildConversationYansiStatusMap(
      artifacts,
      publication.bySlug,
      publication.ready,
      {
        serverPreparationAuthorityReady: canFetchAuthority,
        serverReadyByConversationId,
        serverPublishedSlugByConversationId,
        extraConversationIds,
      }
    );
  }, [artifactTick, owner, publication, serverTick, canFetchAuthority]);
}
