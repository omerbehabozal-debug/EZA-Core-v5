/**
 * Phase 8.8F.2 — owner sidebar Yansı visual status.
 *
 * Visual outcomes: none | ready | published.
 * Green (published) requires server publication authority, not local cache alone.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import { isPublishableJourneyGenerationLineage } from './journeyGenerationLineage';
import type { OwnerYansiPublicationRecord } from './ownerYansiPublicationAuthority';

export type ConversationYansiVisualStatus = 'none' | 'ready' | 'published';

export const YANSI_STATUS_TOOLTIP_READY = 'Yansı yayına hazır';
export const YANSI_STATUS_TOOLTIP_PUBLISHED = 'Yansı yayında';

export function isRestrictedPublication(
  record: OwnerYansiPublicationRecord | undefined
): boolean {
  if (!record) return false;
  return (record.safetyStatus || '').trim().toLowerCase() === 'restricted';
}

export function isCurrentlyPublicPublication(
  record: OwnerYansiPublicationRecord | undefined
): boolean {
  if (!record || isRestrictedPublication(record)) return false;
  const visibility = (record.visibility || '').trim().toLowerCase();
  return visibility === 'public' || visibility === 'unlisted';
}

export function isReusablePreparedYansiArtifact(
  artifact: MirrorJourneyArtifact | null | undefined
): boolean {
  if (!artifact) return false;
  if (artifact.status === 'generating' || artifact.status === 'failed') return false;
  if (artifact.status !== 'ready' && artifact.status !== 'published') return false;
  const hasScene = Boolean(artifact.sceneImageUrl?.trim());
  const hasSeal =
    artifact.sealedLineage != null &&
    isPublishableJourneyGenerationLineage(artifact.sealedLineage);
  const hasTitle = Boolean(
    artifact.publicTitle?.trim() || artifact.sealedPublicLanding?.publicTitle?.trim()
  );
  return hasScene || hasSeal || hasTitle;
}

export function findReusablePreparedYansiArtifact(
  artifacts: MirrorJourneyArtifact[],
  options?: { journeyId?: string }
): MirrorJourneyArtifact | null {
  const wantedId = options?.journeyId?.trim().toLowerCase();
  const reusable = artifacts.filter((row) => {
    if (!isReusablePreparedYansiArtifact(row)) return false;
    if (wantedId && row.journeyId.trim().toLowerCase() !== wantedId) return false;
    return true;
  });
  if (reusable.length === 0) return null;
  reusable.sort((a, b) => {
    if (a.status === 'published' && b.status !== 'published') return -1;
    if (b.status === 'published' && a.status !== 'published') return 1;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
  return reusable[0] ?? null;
}

export function shouldSkipAynaSceneGeneration(input: {
  artifacts: MirrorJourneyArtifact[];
  journeyId?: string;
}): boolean {
  return findReusablePreparedYansiArtifact(input.artifacts, {
    journeyId: input.journeyId,
  }) != null;
}

export function resolveConversationYansiStatus(input: {
  artifacts: MirrorJourneyArtifact[];
  publicationBySlug: Map<string, OwnerYansiPublicationRecord>;
  publicationAuthorityReady: boolean;
}): ConversationYansiVisualStatus {
  const reusable = input.artifacts.filter(isReusablePreparedYansiArtifact);
  if (reusable.length === 0) return 'none';

  const slugOf = (row: MirrorJourneyArtifact) =>
    row.publish?.slug?.trim().toLowerCase() || '';

  if (input.publicationAuthorityReady) {
    const publicHit = reusable.some((row) => {
      const slug = slugOf(row);
      if (!slug) return false;
      return isCurrentlyPublicPublication(input.publicationBySlug.get(slug));
    });
    if (publicHit) return 'published';

    const slugged = reusable.filter((row) => slugOf(row));
    const allRestricted =
      slugged.length > 0 &&
      slugged.every((row) =>
        isRestrictedPublication(input.publicationBySlug.get(slugOf(row)))
      ) &&
      reusable.every((row) => slugOf(row));
    if (allRestricted) return 'none';

    return 'ready';
  }

  if (reusable.some((row) => row.status === 'ready')) return 'ready';
  return 'none';
}

export function buildConversationYansiStatusMap(
  artifacts: MirrorJourneyArtifact[],
  publicationBySlug: Map<string, OwnerYansiPublicationRecord>,
  publicationAuthorityReady: boolean
): Record<string, ConversationYansiVisualStatus> {
  const byConversation: Record<string, MirrorJourneyArtifact[]> = {};
  for (let i = 0; i < artifacts.length; i += 1) {
    const artifact = artifacts[i];
    const conversationId = artifact?.sourceConversationId?.trim();
    if (!conversationId || !artifact) continue;
    const list = byConversation[conversationId] ?? [];
    list.push(artifact);
    byConversation[conversationId] = list;
  }
  const out: Record<string, ConversationYansiVisualStatus> = {};
  const conversationIds = Object.keys(byConversation);
  for (let i = 0; i < conversationIds.length; i += 1) {
    const conversationId = conversationIds[i];
    if (!conversationId) continue;
    out[conversationId] = resolveConversationYansiStatus({
      artifacts: byConversation[conversationId] ?? [],
      publicationBySlug,
      publicationAuthorityReady,
    });
  }
  return out;
}

export function withConversationYansiStatus<T extends { id: string }>(
  items: T[],
  statusByConversationId: Record<string, ConversationYansiVisualStatus>
): Array<T & { yansiStatus: ConversationYansiVisualStatus }> {
  return items.map((item) => ({
    ...item,
    yansiStatus: statusByConversationId[item.id] ?? 'none',
  }));
}
