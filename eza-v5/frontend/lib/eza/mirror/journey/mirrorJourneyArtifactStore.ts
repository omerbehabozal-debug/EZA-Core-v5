/**
 * Phase 3.7.5 — conversation-scoped collection of panel Journey artifacts.
 *
 * Keyed by owner + journeyId + version. Newer Journey B never overwrites A.
 * Multi-tab: per-artifact stateVersion CAS; stale writers do not mutate.
 *
 * Persistence class:
 * - Survives refresh (localStorage)
 * - Phase 4: published artifacts are also server-durable; hydrate via
 *   hydratePublishedJourneysFromServer after localStorage loss
 * - Generating/ready unpublished may remain local-only
 * - Cross-user isolated by ownerUserId prefix
 */

import {
  applyGenerationFailureToArtifact,
  applyPublishFailureToArtifact,
  applyPublishSuccessToArtifact,
  applyUnpublishToArtifact,
  artifactIdentityKey,
  buildGeneratingMirrorJourneyArtifact,
  buildReadyMirrorJourneyArtifactFromLineage,
  cloneMirrorJourneyArtifact,
  isMirrorJourneyArtifact,
  type MirrorJourneyArtifact,
} from './mirrorJourneyArtifact';
import type { JourneyGenerationLineage } from './journeyGenerationLineage';
import { isPublishableJourneyGenerationLineage } from './journeyGenerationLineage';

export const MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY =
  'eza_mirror_journey_panel_artifacts_v1';

type PanelStore = Record<string, MirrorJourneyArtifact>;

export type SaveMirrorJourneyArtifactResult =
  | { ok: true; artifact: MirrorJourneyArtifact }
  | {
      ok: false;
      code: 'stale_revision' | 'invalid' | 'missing_owner';
      current: MirrorJourneyArtifact | null;
    };

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function readStore(): PanelStore {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: PanelStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isMirrorJourneyArtifact(value)) {
        out[key] = cloneMirrorJourneyArtifact(value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

const artifactStoreListeners = new Set<() => void>();

function writeStore(store: PanelStore): void {
  storage()?.setItem(MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY, JSON.stringify(store));
  artifactStoreListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore listener errors */
    }
  });
}

/** Phase 3.8 — notify Ayna reel when panel artifacts change (same-tab). */
export function subscribeMirrorJourneyArtifactStore(listener: () => void): () => void {
  artifactStoreListeners.add(listener);
  return () => {
    artifactStoreListeners.delete(listener);
  };
}

export function loadMirrorJourneyArtifact(
  ownerUserId: string | null | undefined,
  journeyId: string,
  journeyVersion: number
): MirrorJourneyArtifact | null {
  const owner = (ownerUserId || '').trim();
  const jid = journeyId.trim().toLowerCase();
  if (!owner || !jid || !Number.isFinite(journeyVersion)) return null;
  const row = readStore()[artifactIdentityKey(owner, jid, journeyVersion)];
  return row ? cloneMirrorJourneyArtifact(row) : null;
}

/**
 * Canonical selector for Phase 3.8 Ayna panel — ordered by blockIndex then version.
 */
export function listJourneyArtifactsForConversation(
  ownerUserId: string | null | undefined,
  sourceConversationId: string
): MirrorJourneyArtifact[] {
  const owner = (ownerUserId || '').trim();
  const conv = (sourceConversationId || '').trim();
  if (!owner || !conv) return [];
  const store = readStore();
  const prefix = `${owner}::`;
  const out: MirrorJourneyArtifact[] = [];
  for (const [key, value] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    if (value.sourceConversationId !== conv) continue;
    out.push(cloneMirrorJourneyArtifact(value));
  }
  out.sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    if (a.journeyVersion !== b.journeyVersion) {
      return a.journeyVersion - b.journeyVersion;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
  return out;
}

/** Alias kept for clarity in call sites. */
export const listMirrorJourneyArtifactsForConversation =
  listJourneyArtifactsForConversation;

/** Owner-scoped scan for sidebar status — does not leak other accounts. */
export function listAllJourneyArtifactsForOwner(
  ownerUserId: string | null | undefined
): MirrorJourneyArtifact[] {
  const owner = (ownerUserId || '').trim();
  if (!owner) return [];
  const store = readStore();
  const prefix = `${owner}::`;
  const out: MirrorJourneyArtifact[] = [];
  for (const [key, value] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    out.push(cloneMirrorJourneyArtifact(value));
  }
  return out;
}

/**
 * After owner unpublish / private: demote matching published rows to reusable ready.
 * Restricted/safety-removed rows are handled by publication authority, not this scan.
 */
export function demoteMirrorJourneyArtifactsByPublishedSlug(slug: string): number {
  const needle = slug.trim().toLowerCase();
  if (!needle) return 0;
  const store = readStore();
  let changed = 0;
  for (const [key, value] of Object.entries(store)) {
    const current = value.publish?.slug?.trim().toLowerCase();
    if (current !== needle) continue;
    if (value.status !== 'published') continue;
    store[key] = applyUnpublishToArtifact(value);
    changed += 1;
  }
  if (changed > 0) writeStore(store);
  return changed;
}

/**
 * CAS persist. `artifact.stateVersion` must match stored revision (or absent).
 * On success bumps stateVersion by 1.
 */
export function saveMirrorJourneyArtifact(
  ownerUserId: string | null | undefined,
  artifact: MirrorJourneyArtifact
): SaveMirrorJourneyArtifactResult {
  const owner = (ownerUserId || '').trim();
  if (!owner) {
    return { ok: false, code: 'missing_owner', current: null };
  }
  if (!isMirrorJourneyArtifact(artifact)) {
    return { ok: false, code: 'invalid', current: null };
  }
  const key = artifactIdentityKey(owner, artifact.journeyId, artifact.journeyVersion);
  const store = readStore();
  const existing = store[key] ?? null;
  const baseVersion = artifact.stateVersion ?? 0;
  const storedVersion = existing?.stateVersion ?? 0;
  if (existing && storedVersion !== baseVersion) {
    return {
      ok: false,
      code: 'stale_revision',
      current: cloneMirrorJourneyArtifact(existing),
    };
  }
  const next = cloneMirrorJourneyArtifact({
    ...artifact,
    stateVersion: storedVersion + 1,
    updatedAt: new Date().toISOString(),
  });
  store[key] = next;
  writeStore(store);
  return { ok: true, artifact: next };
}

/**
 * Upsert without requiring caller to track stateVersion — merges onto current.
 * Never overwrites a different journeyId key. Never demotes published→ready.
 */
export function upsertMirrorJourneyArtifact(
  ownerUserId: string | null | undefined,
  next: MirrorJourneyArtifact
): MirrorJourneyArtifact | null {
  const owner = (ownerUserId || '').trim();
  if (!owner || !isMirrorJourneyArtifact(next)) return null;
  const existing = loadMirrorJourneyArtifact(
    owner,
    next.journeyId,
    next.journeyVersion
  );
  const merged: MirrorJourneyArtifact = existing
    ? {
        ...next,
        createdAt: existing.createdAt,
        stateVersion: existing.stateVersion,
        // Preserve publish identity if already published and caller didn't supply.
        status:
          existing.status === 'published' && next.status !== 'published'
            ? 'published'
            : next.status,
        publish:
          existing.status === 'published'
            ? {
                slug: next.publish.slug || existing.publish.slug,
                shareUrl: next.publish.shareUrl || existing.publish.shareUrl,
                publishedAt:
                  next.publish.publishedAt || existing.publish.publishedAt,
              }
            : next.publish,
        sealedLineage: next.sealedLineage || existing.sealedLineage,
        sealedPublicLanding:
          next.sealedPublicLanding ?? existing.sealedPublicLanding,
        publicTitle: next.publicTitle ?? existing.publicTitle,
        publicSummary: next.publicSummary ?? existing.publicSummary,
        continuationContext:
          next.continuationContext ?? existing.continuationContext,
        sceneImageUrl: next.sceneImageUrl ?? existing.sceneImageUrl,
        sceneAssetId: next.sceneAssetId ?? existing.sceneAssetId,
        authorUserId: next.authorUserId ?? existing.authorUserId,
        authorDisplayName: next.authorDisplayName ?? existing.authorDisplayName,
        authorAvatarUrl: next.authorAvatarUrl ?? existing.authorAvatarUrl,
        parentJourneyId: next.parentJourneyId ?? existing.parentJourneyId,
        parentSlug: next.parentSlug ?? existing.parentSlug,
        parentAuthorDisplayName:
          next.parentAuthorDisplayName ?? existing.parentAuthorDisplayName,
        parentPublicTitle: next.parentPublicTitle ?? existing.parentPublicTitle,
        experienceCount: next.experienceCount ?? existing.experienceCount,
        childYansiCount: next.childYansiCount ?? existing.childYansiCount,
      }
    : next;
  const saved = saveMirrorJourneyArtifact(owner, merged);
  return saved.ok ? saved.artifact : saved.current;
}

export function markMirrorJourneyArtifactGenerating(
  ownerUserId: string | null | undefined,
  input: {
    journeyId: string;
    journeyVersion?: number;
    sourceConversationId: string;
    blockIndex: number;
    generationId?: string | null;
    selectedCount?: number;
    authorUserId?: string | null;
    authorDisplayName?: string | null;
    authorAvatarUrl?: string | null;
    parentJourneyId?: string | null;
    parentSlug?: string | null;
    parentAuthorDisplayName?: string | null;
    parentPublicTitle?: string | null;
  }
): MirrorJourneyArtifact | null {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.journeyId,
    input.journeyVersion ?? 1
  );
  if (existing?.status === 'published' || existing?.status === 'ready') {
    // Do not wipe a completed artifact if confirm is retried.
    return existing;
  }
  const row = buildGeneratingMirrorJourneyArtifact(input);
  if (existing) {
    row.createdAt = existing.createdAt;
    row.stateVersion = existing.stateVersion;
  }
  return upsertMirrorJourneyArtifact(ownerUserId, row);
}

export function markMirrorJourneyArtifactReadyFromLineage(
  ownerUserId: string | null | undefined,
  input: {
    lineage: JourneyGenerationLineage;
    sceneImageUrl?: string | null;
    publicTitle?: string | null;
    publicSummary?: string | null;
    continuationContext?: string | null;
    sealedPublicLanding?: MirrorJourneyArtifact['sealedPublicLanding'];
    alignmentStatus?: string | null;
  }
): MirrorJourneyArtifact | null {
  if (!isPublishableJourneyGenerationLineage(input.lineage)) return null;
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.lineage.journeyId,
    input.lineage.journeyVersion
  );
  const ready = buildReadyMirrorJourneyArtifactFromLineage({
    ...input,
    existing,
  });
  if (!ready) return null;
  return upsertMirrorJourneyArtifact(ownerUserId, ready);
}

export function markMirrorJourneyArtifactPublished(
  ownerUserId: string | null | undefined,
  input: {
    journeyId: string;
    journeyVersion: number;
    slug: string;
    shareUrl: string;
    publicTitle?: string | null;
    publicSummary?: string | null;
    continuationContext?: string | null;
    sceneImageUrl?: string | null;
  }
): MirrorJourneyArtifact | null {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (!existing) return null;
  const next = applyPublishSuccessToArtifact(existing, input);
  return upsertMirrorJourneyArtifact(ownerUserId, next);
}

export function markMirrorJourneyArtifactPublishFailed(
  ownerUserId: string | null | undefined,
  input: {
    journeyId: string;
    journeyVersion: number;
    message: string;
  }
): MirrorJourneyArtifact | null {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (!existing) return null;
  const next = applyPublishFailureToArtifact(existing, input.message);
  // Ready must survive publish failure.
  if (existing.status === 'ready' || existing.status === 'published') {
    next.status = existing.status;
  }
  return upsertMirrorJourneyArtifact(ownerUserId, next);
}

export function markMirrorJourneyArtifactFailed(
  ownerUserId: string | null | undefined,
  input: {
    journeyId: string;
    journeyVersion: number;
    message: string;
  }
): MirrorJourneyArtifact | null {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (!existing) return null;
  const next = applyGenerationFailureToArtifact(existing, input.message);
  return upsertMirrorJourneyArtifact(ownerUserId, next);
}

export function patchMirrorJourneyArtifactMetrics(
  ownerUserId: string | null | undefined,
  input: {
    journeyId: string;
    journeyVersion: number;
    experienceCount?: number;
    childYansiCount?: number;
  }
): MirrorJourneyArtifact | null {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (!existing) return null;
  const next: MirrorJourneyArtifact = {
    ...existing,
    experienceCount:
      typeof input.experienceCount === 'number'
        ? input.experienceCount
        : existing.experienceCount,
    childYansiCount:
      typeof input.childYansiCount === 'number'
        ? input.childYansiCount
        : existing.childYansiCount,
    updatedAt: new Date().toISOString(),
  };
  return upsertMirrorJourneyArtifact(ownerUserId, next);
}

export function clearMirrorJourneyArtifactsForUser(
  ownerUserId: string | null | undefined
): void {
  const owner = (ownerUserId || '').trim();
  if (!owner) return;
  const store = readStore();
  const prefix = `${owner}::`;
  let changed = false;
  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      delete store[key];
      changed = true;
    }
  }
  if (changed) writeStore(store);
}

export function clearAllMirrorJourneyArtifactsForTests(): void {
  storage()?.removeItem(MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY);
}
