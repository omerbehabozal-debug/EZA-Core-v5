/**
 * Phase 8.8G-4 — hydrate server-backed ready Yansı into the local cache.
 * Does not regenerate scenes, titles, or window hashes.
 */

import {
  getServerConversationAuthority,
  getServerIdForClientChat,
  isServerConversationAuthorityValid,
} from '@/lib/eza/serverConversationStore';
import { getServerYansiPreparations } from '@/lib/eza/standaloneConversationsApi';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { upsertMirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';

function landingFromUnknown(
  raw: Record<string, unknown> | null | undefined
): MirrorJourneyArtifact['sealedPublicLanding'] {
  if (!raw) return null;
  const publicTitle = typeof raw.publicTitle === 'string' ? raw.publicTitle : '';
  const publicSummary = typeof raw.publicSummary === 'string' ? raw.publicSummary : '';
  const continuationContext =
    typeof raw.continuationContext === 'string' ? raw.continuationContext : '';
  if (!publicTitle && !publicSummary) return null;
  return {
    publicTitle,
    publicSummary,
    continuationContext,
    topicCategory: typeof raw.topicCategory === 'string' ? raw.topicCategory : undefined,
    semanticSource: typeof raw.semanticSource === 'string' ? raw.semanticSource : undefined,
    interpretationHash:
      typeof raw.interpretationHash === 'string' ? raw.interpretationHash : undefined,
    publicLandingHash:
      typeof raw.publicLandingHash === 'string' ? raw.publicLandingHash : undefined,
    contractVersion: typeof raw.contractVersion === 'string' ? raw.contractVersion : undefined,
  };
}

export function artifactFromServerYansiPreparation(
  row: {
    journeyId: string;
    journeyVersion: number;
    conversationId: string;
    windowIndex: number;
    windowHash: string;
    selectedStepsHash: string;
    sourceBlockHash?: string | null;
    generationId: string;
    publicTitle: string;
    publicSummary: string;
    continuationContext?: string | null;
    sceneImageUrl: string;
    sceneAssetId?: string | null;
    sealedLineage: Record<string, unknown>;
    sealedPublicLanding?: Record<string, unknown> | null;
    publishedSlug?: string | null;
    createdAt: string;
    updatedAt?: string | null;
  },
  sourceConversationId: string
): MirrorJourneyArtifact | null {
  if (!isPublishableJourneyGenerationLineage(row.sealedLineage)) return null;
  const lineage = row.sealedLineage as JourneyGenerationLineage;
  const published = Boolean(row.publishedSlug?.trim());
  return {
    journeyId: row.journeyId,
    journeyVersion: row.journeyVersion,
    sourceConversationId,
    blockIndex: row.windowIndex,
    generationId: row.generationId,
    selectedCount: lineage.selectedSteps.length,
    sourceBlockHash: row.sourceBlockHash ?? lineage.sourceBlockHash ?? null,
    selectedStepsHash: row.selectedStepsHash,
    sceneImageUrl: row.sceneImageUrl,
    sceneAssetId: row.sceneAssetId ?? lineage.sceneAssetId ?? null,
    publicTitle: row.publicTitle,
    publicSummary: row.publicSummary,
    continuationContext: row.continuationContext ?? null,
    status: published ? 'published' : 'ready',
    publish: published
      ? { slug: row.publishedSlug?.trim().toLowerCase() }
      : {},
    sealedLineage: lineage,
    sealedPublicLanding: landingFromUnknown(row.sealedPublicLanding),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
    stateVersion: 0,
  };
}

export async function hydrateYansiPreparationsFromServer(input: {
  ownerUserId: string | null | undefined;
  clientConversationId: string;
  ownerAtStart: string | null;
  epochAtStart: number;
}): Promise<MirrorJourneyArtifact[]> {
  const owner = (input.ownerUserId || '').trim();
  if (!owner) return [];
  if (!isServerConversationAuthorityValid(input.ownerAtStart, input.epochAtStart)) {
    return [];
  }
  const serverId = getServerIdForClientChat(input.clientConversationId);
  if (!serverId) return [];
  const items = await getServerYansiPreparations(serverId);
  if (!isServerConversationAuthorityValid(input.ownerAtStart, input.epochAtStart)) {
    return [];
  }
  if (getServerConversationAuthority().ownerKey !== owner) {
    return [];
  }
  const hydrated: MirrorJourneyArtifact[] = [];
  for (const row of items) {
    const artifact = artifactFromServerYansiPreparation(row, input.clientConversationId);
    if (!artifact) continue;
    const saved = upsertMirrorJourneyArtifact(owner, artifact);
    if (saved) hydrated.push(saved);
  }
  return hydrated;
}
