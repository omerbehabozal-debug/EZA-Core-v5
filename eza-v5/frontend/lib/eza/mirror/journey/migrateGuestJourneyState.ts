/**
 * Phase 8.7 — same-device guest → authenticated Journey/Ayna rebind.
 *
 * Moves local Journey windows, Review drafts, panel artifacts, and generation
 * seals from `guest:{token}` into `userId`. Idempotent. Never claims another
 * user's bucket. Does not call external AI or publish.
 */

import { REVIEW8_DRAFT_STORAGE_KEY } from './types';
import { guestJourneyOwnerKey } from './journeyOwnerKey';
import {
  JOURNEY_WINDOW_STATE_STORAGE_KEY,
  loadJourneyConversationState,
  saveJourneyConversationState,
} from './journeyWindowStore';
import {
  listReview8DraftsForConversation,
  saveReview8Draft,
  loadReview8Draft,
} from './review8DraftStore';
import {
  listJourneyArtifactsForConversation,
  saveMirrorJourneyArtifact,
  clearMirrorJourneyArtifactsForUser,
  loadMirrorJourneyArtifact,
  MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY,
} from './mirrorJourneyArtifactStore';
import {
  JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY,
  loadJourneyGenerationArtifact,
  saveJourneyGenerationArtifact,
} from './journeyGenerationArtifactStore';
import { readChatArchivesForScope } from '@/lib/standaloneChatArchive';
import { guestScope } from '@/lib/eza/localIdentityScope';

export type MigrateGuestJourneyStateResult = {
  migrated: boolean;
  windows: number;
  drafts: number;
  panelArtifacts: number;
  generationArtifacts: number;
};

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function clearGuestWindowBucket(guestOwner: string): void {
  const bucket = readJson<Record<string, Record<string, unknown>>>(
    JOURNEY_WINDOW_STATE_STORAGE_KEY
  );
  if (!bucket || !bucket[guestOwner]) return;
  delete bucket[guestOwner];
  writeJson(JOURNEY_WINDOW_STATE_STORAGE_KEY, bucket);
}

/**
 * Idempotent rebind of guest Journey local state into the authenticated user.
 */
export function migrateGuestJourneyStateToUser(input: {
  guestToken: string;
  userId: string;
}): MigrateGuestJourneyStateResult {
  const empty: MigrateGuestJourneyStateResult = {
    migrated: false,
    windows: 0,
    drafts: 0,
    panelArtifacts: 0,
    generationArtifacts: 0,
  };
  if (typeof window === 'undefined') return empty;

  const userId = input.userId.trim();
  const guestToken = input.guestToken.trim();
  if (!userId || !guestToken) return empty;
  if (userId.startsWith('guest:')) return empty;

  const guestOwner = guestJourneyOwnerKey(guestToken);
  if (!guestOwner) return empty;

  const guestChats = readChatArchivesForScope(guestScope(guestToken));
  const convIds = new Set(guestChats.map((c) => c.id));

  const windowBucket = readJson<Record<string, Record<string, unknown>>>(
    JOURNEY_WINDOW_STATE_STORAGE_KEY
  );
  const guestWindows = windowBucket?.[guestOwner] || {};
  for (const convId of Object.keys(guestWindows)) {
    convIds.add(convId);
  }

  let windows = 0;
  let drafts = 0;
  let panelArtifacts = 0;
  let generationArtifacts = 0;

  for (const convId of convIds) {
    const guestState = loadJourneyConversationState(guestOwner, convId);
    if (guestState) {
      const existingUser = loadJourneyConversationState(userId, convId);
      if (!existingUser) {
        const saved = saveJourneyConversationState({
          ...guestState,
          ownerUserId: userId,
          stateVersion: 0,
        });
        if (saved.ok) windows += 1;
      }
    }

    for (const draft of listReview8DraftsForConversation(guestOwner, convId)) {
      const existing = loadReview8Draft({
        ownerUserId: userId,
        sourceConversationId: convId,
        draftKey: draft.draftKey,
      });
      if (existing) continue;
      saveReview8Draft({
        ...draft,
        ownerUserId: userId,
      });
      drafts += 1;
    }
  }

  // Sweep all guest panel artifacts (even if conversation id was not in chat list).
  const panelStore = readJson<Record<string, { sourceConversationId?: string; journeyId?: string; journeyVersion?: number }>>(
    MIRROR_JOURNEY_ARTIFACT_PANEL_STORAGE_KEY
  );
  const guestPanelPrefix = `${guestOwner}::`;
  if (panelStore) {
    for (const [key, raw] of Object.entries(panelStore)) {
      if (!key.startsWith(guestPanelPrefix)) continue;
      const convId = String(raw?.sourceConversationId || '').trim();
      if (convId) convIds.add(convId);
    }
  }

  for (const convId of convIds) {
    for (const artifact of listJourneyArtifactsForConversation(guestOwner, convId)) {
      const existing = loadMirrorJourneyArtifact(
        userId,
        artifact.journeyId,
        artifact.journeyVersion
      );
      if (existing) continue;
      const saved = saveMirrorJourneyArtifact(userId, {
        ...artifact,
        authorUserId: userId,
        stateVersion: 0,
      });
      if (saved.ok) {
        panelArtifacts += 1;
        const lineage = loadJourneyGenerationArtifact(
          guestOwner,
          artifact.journeyId,
          artifact.journeyVersion
        );
        if (lineage) {
          saveJourneyGenerationArtifact(userId, lineage);
          generationArtifacts += 1;
        }
      }
    }
  }

  const genStore = readJson<Record<string, unknown>>(JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY);
  if (genStore) {
    const prefix = `${guestOwner}::`;
    let changed = false;
    for (const [key, value] of Object.entries(genStore)) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const userKey = `${userId}::${rest}`;
      if (!genStore[userKey]) {
        genStore[userKey] = value;
        generationArtifacts += 1;
      }
      delete genStore[key];
      changed = true;
    }
    if (changed) writeJson(JOURNEY_GENERATION_ARTIFACT_STORAGE_KEY, genStore);
  }

  clearGuestWindowBucket(guestOwner);
  clearMirrorJourneyArtifactsForUser(guestOwner);

  const reviewBucket = readJson<Record<string, unknown>>(REVIEW8_DRAFT_STORAGE_KEY);
  if (reviewBucket && reviewBucket[guestOwner]) {
    delete reviewBucket[guestOwner];
    writeJson(REVIEW8_DRAFT_STORAGE_KEY, reviewBucket);
  }
  const activeBucket = readJson<Record<string, unknown>>(
    `${REVIEW8_DRAFT_STORAGE_KEY}__active`
  );
  if (activeBucket && activeBucket[guestOwner]) {
    delete activeBucket[guestOwner];
    writeJson(`${REVIEW8_DRAFT_STORAGE_KEY}__active`, activeBucket);
  }

  const migrated =
    windows > 0 || drafts > 0 || panelArtifacts > 0 || generationArtifacts > 0;
  return {
    migrated,
    windows,
    drafts,
    panelArtifacts,
    generationArtifacts,
  };
}
