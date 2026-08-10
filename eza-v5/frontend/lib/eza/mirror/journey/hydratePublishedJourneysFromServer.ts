/**
 * Phase 4 — owner Ayna rehydration from durable server published journeys.
 *
 * Published = server durable. Generating/ready unpublished may remain local-only.
 * Merges into the panel artifact store without wiping local ready/generating rows.
 */

import { apiClient } from '@/lib/apiClient';
import { buildApiUrl } from '@/lib/apiUrl';
import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  loadMirrorJourneyArtifact,
  saveMirrorJourneyArtifact,
} from './mirrorJourneyArtifactStore';

export type OwnerPublishedJourneyServerItem = {
  slug: string;
  journeyId: string;
  journeyVersion: number;
  artifactKind?: string | null;
  freezeStatus: string;
  publicTitle?: string | null;
  publicSummary?: string | null;
  continuationContext?: string | null;
  sceneImageUrl?: string | null;
  sceneAssetId?: string | null;
  parentSlug?: string | null;
  authorUserId?: string | null;
  selectedCount?: number | null;
  publishedAt?: string | null;
  frozenAt?: string | null;
  sourceConversationId?: string | null;
};

export type OwnerPublishedJourneysResponse = {
  conversationId: string;
  items: OwnerPublishedJourneyServerItem[];
  total: number;
};

function toPanelArtifact(
  ownerUserId: string,
  item: OwnerPublishedJourneyServerItem,
  conversationId: string
): MirrorJourneyArtifact {
  const now = new Date().toISOString();
  const journeyId = (item.journeyId || item.slug || '').trim().toLowerCase();
  const selectedCount =
    typeof item.selectedCount === 'number' && item.selectedCount >= 6
      ? item.selectedCount
      : 8;
  return {
    journeyId,
    journeyVersion: Number(item.journeyVersion) || 1,
    sourceConversationId:
      (item.sourceConversationId || conversationId || '').trim() || conversationId,
    blockIndex: 0,
    generationId: `server-frozen:${journeyId}:v${item.journeyVersion}`,
    selectedCount,
    selectedStepsHash: `server-frozen:${journeyId}:v${item.journeyVersion}`,
    sceneImageUrl: item.sceneImageUrl ?? null,
    sceneAssetId: item.sceneAssetId ?? null,
    publicTitle: item.publicTitle ?? null,
    publicSummary: item.publicSummary ?? null,
    continuationContext: item.continuationContext ?? null,
    status: 'published',
    publish: {
      slug: item.slug,
      shareUrl: `/m/${item.slug}`,
      publishedAt: item.publishedAt ?? item.frozenAt ?? now,
    },
    sealedLineage: null,
    sealedPublicLanding: item.publicTitle
      ? {
          publicTitle: String(item.publicTitle),
          publicSummary: String(item.publicSummary || ''),
          continuationContext: String(item.continuationContext || ''),
        }
      : null,
    authorUserId: item.authorUserId || ownerUserId,
    parentSlug: item.parentSlug ?? null,
    parentJourneyId: item.parentSlug ?? null,
    createdAt: item.publishedAt || now,
    updatedAt: now,
    stateVersion: 0,
  };
}

/**
 * Fetch durable published journeys for a conversation and merge into panel store.
 * Returns the server items (empty on network/auth failure — fail soft for UI).
 */
export async function hydratePublishedJourneysFromServer(input: {
  ownerUserId: string;
  conversationId: string;
}): Promise<OwnerPublishedJourneyServerItem[]> {
  const owner = (input.ownerUserId || '').trim();
  const conversationId = (input.conversationId || '').trim();
  if (!owner || !conversationId) return [];

  const path = `/api/mirror-network/me/conversations/${encodeURIComponent(conversationId)}/published-journeys`;
  let items: OwnerPublishedJourneyServerItem[] = [];
  try {
    const response = await apiClient.get<OwnerPublishedJourneysResponse>(path, {
      auth: true,
      timeoutMs: 15_000,
    });
    if (!response.ok || !response.data) return [];
    items = Array.isArray(response.data.items) ? response.data.items : [];
  } catch {
    return [];
  }
  for (const item of items) {
    if (!item?.slug || !item?.journeyId) continue;
    if (String(item.freezeStatus || '').toLowerCase() !== 'frozen') continue;
    const artifact = toPanelArtifact(owner, item, conversationId);
    const existing = loadMirrorJourneyArtifact(
      owner,
      artifact.journeyId,
      artifact.journeyVersion
    );
    // Do not clobber richer local generating/ready rows or sealed published lineage.
    if (existing && existing.status === 'published' && existing.sealedLineage) {
      continue;
    }
    if (existing && (existing.status === 'ready' || existing.status === 'generating')) {
      continue;
    }
    saveMirrorJourneyArtifact(owner, {
      ...artifact,
      stateVersion: existing?.stateVersion ?? 0,
    });
  }
  return items;
}

/** Public frozen read — no auth; used by share /m adapters. */
export async function fetchFrozenJourneyArtifact(input: {
  slug: string;
  journeyVersion?: number | null;
}): Promise<Record<string, unknown> | null> {
  const slug = (input.slug || '').trim().toLowerCase();
  if (!slug) return null;
  const qs =
    input.journeyVersion != null && Number.isFinite(input.journeyVersion)
      ? `?journeyVersion=${encodeURIComponent(String(input.journeyVersion))}`
      : '';
  const url = buildApiUrl(`/api/mirror-network/${encodeURIComponent(slug)}/frozen${qs}`);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
