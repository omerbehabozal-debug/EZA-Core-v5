/**
 * Sidebar SOHBETLERİM enrichment — presentation only.
 * Does not project own-Yansı as separate rows.
 * Does not mutate Journey/product identity.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  isCurrentlyPublicPublication,
  isRestrictedPublication,
  isReusablePreparedYansiArtifact,
  type ConversationYansiVisualStatus,
} from './resolveConversationYansiStatus';
import type { OwnerYansiPublicationRecord } from './ownerYansiPublicationAuthority';
import { sortArtifactsForSidebarProjection } from './projectYansiSidebarItems';
import { buildYansiSourceIdentity } from './yansiSidebarIdentity';
import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';

function canonicalYansiTitle(artifact: MirrorJourneyArtifact): string {
  return (
    artifact.sealedPublicLanding?.publicTitle?.trim() ||
    artifact.publicTitle?.trim() ||
    ''
  );
}

function canonicalYansiScene(artifact: MirrorJourneyArtifact): string | null {
  const url = artifact.sceneImageUrl?.trim() || '';
  if (!url) return null;
  if (isConversationSceneDisplayUrl(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

/**
 * Exact single-Yansı status for N=1 rows.
 * Red only when owner publication inventory authoritatively lists this slug as private.
 */
export function resolveExactYansiSidebarStatus(input: {
  artifact: MirrorJourneyArtifact;
  publicationBySlug: Map<string, OwnerYansiPublicationRecord>;
  publicationAuthorityReady: boolean;
}): ConversationYansiVisualStatus {
  if (!isReusablePreparedYansiArtifact(input.artifact)) return 'none';
  const slug = input.artifact.publish?.slug?.trim().toLowerCase() || '';

  if (input.publicationAuthorityReady) {
    if (slug && isCurrentlyPublicPublication(input.publicationBySlug.get(slug))) {
      return 'published';
    }
    if (slug && isRestrictedPublication(input.publicationBySlug.get(slug))) {
      return 'none';
    }
    const record = slug ? input.publicationBySlug.get(slug) : undefined;
    if (
      record &&
      (record.visibility || '').trim().toLowerCase() === 'private' &&
      !isRestrictedPublication(record)
    ) {
      return 'withdrawn';
    }
  }

  if (input.artifact.status === 'published') {
    return input.publicationAuthorityReady ? 'ready' : 'none';
  }
  if (input.artifact.status === 'ready') return 'ready';
  return 'none';
}

export function listReusableYansiForConversation(
  artifacts: readonly MirrorJourneyArtifact[],
  conversationId: string
): MirrorJourneyArtifact[] {
  const conv = conversationId.trim();
  if (!conv) return [];
  const reusable = artifacts.filter(
    (row) =>
      row.sourceConversationId.trim() === conv && isReusablePreparedYansiArtifact(row)
  );
  return sortArtifactsForSidebarProjection(reusable);
}

export function enrichConversationItemWithYansiPresentation(
  item: SainaConversationItem,
  artifacts: readonly MirrorJourneyArtifact[],
  publicationBySlug: Map<string, OwnerYansiPublicationRecord>,
  publicationAuthorityReady: boolean
): SainaConversationItem {
  if ((item.kind ?? 'conversation') === 'yansi') {
    return item;
  }

  const ordered = listReusableYansiForConversation(artifacts, item.id);
  const total = ordered.length;

  if (total === 0) {
    return {
      ...item,
      kind: 'conversation',
      yansiStatus: 'none',
      additionalYansiCount: undefined,
      representativeYansiCount: 0,
      journeyId: undefined,
      journeyVersion: undefined,
      yansiSourceIdentity: undefined,
    };
  }

  const latest = ordered[ordered.length - 1]!;
  const title = canonicalYansiTitle(latest) || item.title;
  const scene = canonicalYansiScene(latest);
  const identity = buildYansiSourceIdentity(latest.journeyId, latest.journeyVersion);

  if (total === 1) {
    return {
      ...item,
      kind: 'conversation',
      title,
      thumbImageUrl: scene,
      yansiStatus: resolveExactYansiSidebarStatus({
        artifact: latest,
        publicationBySlug,
        publicationAuthorityReady,
      }),
      additionalYansiCount: undefined,
      representativeYansiCount: 1,
      journeyId: latest.journeyId.trim().toLowerCase(),
      journeyVersion: latest.journeyVersion,
      yansiSourceIdentity: identity || undefined,
    };
  }

  return {
    ...item,
    kind: 'conversation',
    title,
    thumbImageUrl: scene,
    yansiStatus: 'none',
    additionalYansiCount: total - 1,
    representativeYansiCount: total,
    journeyId: latest.journeyId.trim().toLowerCase(),
    journeyVersion: latest.journeyVersion,
    yansiSourceIdentity: identity || undefined,
  };
}

export function enrichConversationItemsWithYansiPresentation(
  items: SainaConversationItem[],
  artifacts: readonly MirrorJourneyArtifact[],
  publicationBySlug: Map<string, OwnerYansiPublicationRecord>,
  publicationAuthorityReady: boolean
): SainaConversationItem[] {
  return items.map((item) =>
    enrichConversationItemWithYansiPresentation(
      item,
      artifacts,
      publicationBySlug,
      publicationAuthorityReady
    )
  );
}
