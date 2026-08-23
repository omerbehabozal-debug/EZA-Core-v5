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

export function useConversationYansiStatusMap(
  ownerUserId: string | null | undefined,
  options?: { isAuthenticated?: boolean; isAuthReady?: boolean }
): Record<string, ConversationYansiVisualStatus> {
  const [artifactTick, setArtifactTick] = useState(0);
  const [publication, setPublication] = useState(getOwnerYansiPublicationSnapshot);

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
    const artifacts = listAllJourneyArtifactsForOwner(owner);
    return buildConversationYansiStatusMap(
      artifacts,
      publication.bySlug,
      publication.ready
    );
  }, [artifactTick, owner, publication]);
}
