/**
 * Persist sealed Journey generation artifacts so publish survives draft mutation,
 * Journey B activation, and (when the card is restored) reload.
 */

import {
  cloneJourneyGenerationLineage,
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from './journeyGenerationLineage';

export const JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY =
  'eza_mirror_journey_generation_artifacts_v1';

type ArtifactStore = Record<string, JourneyGenerationLineage>;

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function artifactKey(ownerUserId: string, journeyId: string, journeyVersion: number): string {
  return `${ownerUserId.trim()}::${journeyId.trim().toLowerCase()}::v${journeyVersion}`;
}

function readStore(): ArtifactStore {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: ArtifactStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPublishableJourneyGenerationLineage(value)) {
        out[key] = cloneJourneyGenerationLineage(value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: ArtifactStore): void {
  storage()?.setItem(JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY, JSON.stringify(store));
}

export function saveJourneyGenerationArtifact(
  ownerUserId: string | null | undefined,
  lineage: JourneyGenerationLineage
): void {
  const owner = (ownerUserId || '').trim();
  if (!owner || !isPublishableJourneyGenerationLineage(lineage)) return;
  const store = readStore();
  store[artifactKey(owner, lineage.journeyId, lineage.journeyVersion)] =
    cloneJourneyGenerationLineage(lineage);
  writeStore(store);
}

export function loadJourneyGenerationArtifact(
  ownerUserId: string | null | undefined,
  journeyId: string,
  journeyVersion: number
): JourneyGenerationLineage | null {
  const owner = (ownerUserId || '').trim();
  const jid = journeyId.trim().toLowerCase();
  if (!owner || !jid || !Number.isFinite(journeyVersion)) return null;
  const row = readStore()[artifactKey(owner, jid, journeyVersion)];
  return row ? cloneJourneyGenerationLineage(row) : null;
}

/**
 * Multi-artifact foundation (Phase 3.7) — ordered list for one source conversation.
 * Does not build Ayna UI; only data isolation for coexisting Journey A/B/….
 */
export function listJourneyGenerationArtifactsForConversation(
  ownerUserId: string | null | undefined,
  sourceConversationId: string
): JourneyGenerationLineage[] {
  const owner = (ownerUserId || '').trim();
  const conv = (sourceConversationId || '').trim();
  if (!owner || !conv) return [];
  const store = readStore();
  const prefix = `${owner}::`;
  const out: JourneyGenerationLineage[] = [];
  for (const [key, value] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    if (value.sourceConversationId !== conv) continue;
    out.push(cloneJourneyGenerationLineage(value));
  }
  out.sort((a, b) => {
    const bi = (a.blockIndex ?? a.windowIndex) - (b.blockIndex ?? b.windowIndex);
    if (bi !== 0) return bi;
    return a.journeyVersion - b.journeyVersion;
  });
  return out;
}

export function clearJourneyGenerationArtifactsForUser(
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
