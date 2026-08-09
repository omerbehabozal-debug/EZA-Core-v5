/**
 * Phase 3.7.5 — canonical panel domain object for multi-artifact Ayna readiness.
 *
 * Panel must not rebuild title/summary/scene from live chat.
 * Each artifact owns its sealed generation identity + publish/share meta.
 *
 * Persistence: localStorage (user + journeyId + version). Survives refresh.
 * Not Phase 4 durable server freeze.
 */

import type { JourneyGenerationLineage } from './journeyGenerationLineage';
import {
  cloneJourneyGenerationLineage,
  isPublishableJourneyGenerationLineage,
} from './journeyGenerationLineage';

export type MirrorJourneyArtifactStatus =
  | 'generating'
  | 'ready'
  | 'published'
  | 'failed';

export type MirrorJourneyArtifactPublish = {
  slug?: string | null;
  shareUrl?: string | null;
  publishedAt?: string | null;
};

/**
 * Reserved for Phase 3.8 metrics UI — never invent fake counts.
 */
export type MirrorJourneyArtifactMetricsPlaceholders = {
  experienceCount?: number;
  childYansiCount?: number;
};

export type MirrorJourneyArtifact = {
  journeyId: string;
  journeyVersion: number;
  sourceConversationId: string;
  blockIndex: number;
  generationId: string;

  selectedCount: number;
  sourceBlockHash?: string | null;
  selectedStepsHash: string;

  sceneImageUrl?: string | null;
  sceneAssetId?: string | null;

  publicTitle?: string | null;
  publicSummary?: string | null;
  continuationContext?: string | null;

  status: MirrorJourneyArtifactStatus;

  publish: MirrorJourneyArtifactPublish;

  alignmentStatus?: string | null;
  generationError?: string | null;

  /** Immutable sealed lineage when ready/published; may be null while generating. */
  sealedLineage: JourneyGenerationLineage | null;

  /** Leave undefined until real metrics exist. */
  experienceCount?: number;
  childYansiCount?: number;

  createdAt: string;
  updatedAt: string;
  /** Per-artifact CAS revision for multi-tab safety. */
  stateVersion: number;
};

export function cloneMirrorJourneyArtifact(
  row: MirrorJourneyArtifact
): MirrorJourneyArtifact {
  return {
    ...row,
    publish: { ...row.publish },
    sealedLineage: row.sealedLineage
      ? cloneJourneyGenerationLineage(row.sealedLineage)
      : null,
  };
}

export function isMirrorJourneyArtifact(raw: unknown): raw is MirrorJourneyArtifact {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Partial<MirrorJourneyArtifact>;
  const status = row.status;
  if (
    status !== 'generating' &&
    status !== 'ready' &&
    status !== 'published' &&
    status !== 'failed'
  ) {
    return false;
  }
  return Boolean(
    typeof row.journeyId === 'string' &&
      row.journeyId.trim() &&
      Number(row.journeyVersion) >= 1 &&
      typeof row.sourceConversationId === 'string' &&
      row.sourceConversationId.trim() &&
      typeof row.generationId === 'string' &&
      typeof row.blockIndex === 'number' &&
      typeof row.selectedCount === 'number' &&
      typeof row.selectedStepsHash === 'string' &&
      row.publish &&
      typeof row.publish === 'object' &&
      typeof row.createdAt === 'string' &&
      typeof row.updatedAt === 'string' &&
      typeof row.stateVersion === 'number'
  );
}

export function artifactIdentityKey(
  ownerUserId: string,
  journeyId: string,
  journeyVersion: number
): string {
  return `${ownerUserId.trim()}::${journeyId.trim().toLowerCase()}::v${journeyVersion}`;
}

export function buildGeneratingMirrorJourneyArtifact(input: {
  journeyId: string;
  journeyVersion?: number;
  sourceConversationId: string;
  blockIndex: number;
  generationId?: string | null;
  selectedCount?: number;
  now?: string;
}): MirrorJourneyArtifact {
  const now = input.now || new Date().toISOString();
  return {
    journeyId: input.journeyId.trim().toLowerCase(),
    journeyVersion: input.journeyVersion && input.journeyVersion >= 1 ? input.journeyVersion : 1,
    sourceConversationId: input.sourceConversationId.trim(),
    blockIndex: input.blockIndex,
    generationId: (input.generationId || '').trim() || `pending-${input.journeyId}`,
    selectedCount: input.selectedCount && input.selectedCount >= 6 ? input.selectedCount : 8,
    selectedStepsHash: '',
    status: 'generating',
    publish: {},
    sealedLineage: null,
    createdAt: now,
    updatedAt: now,
    stateVersion: 0,
  };
}

export function buildReadyMirrorJourneyArtifactFromLineage(input: {
  lineage: JourneyGenerationLineage;
  sceneImageUrl?: string | null;
  publicTitle?: string | null;
  publicSummary?: string | null;
  continuationContext?: string | null;
  alignmentStatus?: string | null;
  existing?: MirrorJourneyArtifact | null;
  now?: string;
}): MirrorJourneyArtifact | null {
  if (!isPublishableJourneyGenerationLineage(input.lineage)) return null;
  const now = input.now || new Date().toISOString();
  const existing = input.existing;
  const wasPublished = existing?.status === 'published';
  return {
    journeyId: input.lineage.journeyId,
    journeyVersion: input.lineage.journeyVersion,
    sourceConversationId: input.lineage.sourceConversationId,
    blockIndex: input.lineage.blockIndex ?? input.lineage.windowIndex,
    generationId: input.lineage.generationId,
    selectedCount:
      input.lineage.selectedCount ?? input.lineage.selectedSteps.length,
    sourceBlockHash: input.lineage.sourceBlockHash ?? null,
    selectedStepsHash: input.lineage.selectedStepsHash,
    sceneImageUrl: input.sceneImageUrl?.trim() || existing?.sceneImageUrl || null,
    sceneAssetId: input.lineage.sceneAssetId ?? existing?.sceneAssetId ?? null,
    publicTitle:
      input.publicTitle?.trim() || existing?.publicTitle || null,
    publicSummary:
      input.publicSummary?.trim() || existing?.publicSummary || null,
    continuationContext:
      input.continuationContext?.trim() || existing?.continuationContext || null,
    // Never demote published → ready on re-seal of same identity.
    status: wasPublished ? 'published' : 'ready',
    publish: wasPublished ? { ...existing!.publish } : existing?.publish ?? {},
    alignmentStatus: input.alignmentStatus ?? existing?.alignmentStatus ?? null,
    generationError: null,
    sealedLineage: cloneJourneyGenerationLineage(input.lineage),
    experienceCount: existing?.experienceCount,
    childYansiCount: existing?.childYansiCount,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    stateVersion: existing?.stateVersion ?? 0,
  };
}

export function applyPublishSuccessToArtifact(
  artifact: MirrorJourneyArtifact,
  input: {
    slug: string;
    shareUrl: string;
    publishedAt?: string;
    publicTitle?: string | null;
    publicSummary?: string | null;
    continuationContext?: string | null;
    sceneImageUrl?: string | null;
  }
): MirrorJourneyArtifact {
  const now = input.publishedAt || new Date().toISOString();
  return {
    ...artifact,
    status: 'published',
    publish: {
      slug: input.slug.trim(),
      shareUrl: input.shareUrl.trim(),
      publishedAt: now,
    },
    publicTitle: input.publicTitle?.trim() || artifact.publicTitle || null,
    publicSummary: input.publicSummary?.trim() || artifact.publicSummary || null,
    continuationContext:
      input.continuationContext?.trim() || artifact.continuationContext || null,
    sceneImageUrl: input.sceneImageUrl?.trim() || artifact.sceneImageUrl || null,
    generationError: null,
    updatedAt: now,
  };
}

/**
 * Publish failure must not erase a ready/published artifact.
 */
export function applyPublishFailureToArtifact(
  artifact: MirrorJourneyArtifact,
  message: string
): MirrorJourneyArtifact {
  if (artifact.status === 'published') {
    return {
      ...artifact,
      generationError: message,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...artifact,
    status: artifact.status === 'generating' ? 'failed' : artifact.status,
    generationError: message,
    updatedAt: new Date().toISOString(),
  };
}

export function applyGenerationFailureToArtifact(
  artifact: MirrorJourneyArtifact,
  message: string
): MirrorJourneyArtifact {
  if (artifact.status === 'published') {
    return {
      ...artifact,
      generationError: message,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...artifact,
    status: 'failed',
    generationError: message,
    updatedAt: new Date().toISOString(),
  };
}
