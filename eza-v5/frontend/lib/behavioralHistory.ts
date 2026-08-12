/**
 * Local persistence for behavioral snapshots (demo / standalone only).
 * No PII — only numeric vectors returned by the pipeline.
 *
 * Phase 4.3.1:
 * - User-scoped storage keys (Alice ≠ Bob).
 * - ALL write paths gated by canWriteEzaProfileHistory (fail-closed).
 * - Legacy global key is never attributed to an authenticated user.
 */

import type { BehavioralSnapshot, StandaloneObservation } from '@/lib/types';
import {
  canWriteEzaProfileHistory,
  resolveEzaOwnerScope,
} from '@/lib/eza/ezaUserPrefs';

/** @deprecated Legacy global bucket — never attach to authenticated users. */
export const LEGACY_BEHAVIORAL_HISTORY_STORAGE_KEY = 'eza_standalone_behavioral_history';

const STORAGE_PREFIX = 'eza_standalone_behavioral_history_v2:';
const MAX_ITEMS = 50;

/** Rapor sayfası ve diğer dinleyiciler için (aynı sekme). */
export const BEHAVIORAL_HISTORY_UPDATED = 'eza-behavioral-history-updated';

function notifyBehavioralHistoryUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BEHAVIORAL_HISTORY_UPDATED));
}

export type SavedBehavioralEntry = BehavioralSnapshot & {
  savedAt: string;
  standaloneObservation?: StandaloneObservation | null;
  /** Frontend-only cues from user message (Mirror intent lock; no chat text stored). */
  mirrorCueHints?: string[];
};

export function behavioralHistoryStorageKey(ownerUserId?: string | null): string {
  return `${STORAGE_PREFIX}${resolveEzaOwnerScope(ownerUserId)}`;
}

function placeholderSnapshot(interactionId: string): BehavioralSnapshot {
  return {
    schema_version: 1,
    interaction_id: interactionId,
    mode: 'standalone',
    vector: {
      input_risk: 0.2,
      output_risk: 0.15,
      input_health: 0.8,
      output_health: 0.85,
      alignment_score: null,
      eza_final: null,
      intent: '',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: {
      health_gap: 0.05,
      risk_delta_output_minus_input: -0.05,
      index: 0.1,
    },
  };
}

export type AppendBehavioralOptions = {
  mirrorCueHints?: string[];
  /** User scope for Phase 4.3 processing gate + storage key. */
  ownerUserId?: string | null;
};

function parseEntries(raw: string | null): SavedBehavioralEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBehavioralEntry);
  } catch {
    return [];
  }
}

/**
 * One-time: copy legacy global history into the guest bucket only.
 * Never assigns legacy data to an authenticated user.
 */
function migrateLegacyIntoGuestBucketOnce(): void {
  if (typeof window === 'undefined') return;
  try {
    const guestKey = behavioralHistoryStorageKey(null);
    const guestExisting = parseEntries(localStorage.getItem(guestKey));
    if (guestExisting.length > 0) return;
    const legacy = parseEntries(localStorage.getItem(LEGACY_BEHAVIORAL_HISTORY_STORAGE_KEY));
    if (!legacy.length) return;
    localStorage.setItem(guestKey, JSON.stringify(legacy.slice(0, MAX_ITEMS)));
    // Leave legacy key in place but unused for auth users; remove to avoid
    // double-counting if guest later writes — safe after successful guest copy.
    localStorage.removeItem(LEGACY_BEHAVIORAL_HISTORY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Persist turn; observation-only turns use a neutral placeholder vector. */
export function appendBehavioralTurn(
  snapshot: BehavioralSnapshot | null | undefined,
  standaloneObservation?: StandaloneObservation | null,
  options?: AppendBehavioralOptions
): void {
  if (!canWriteEzaProfileHistory(options?.ownerUserId)) return;
  if (!snapshot && !standaloneObservation) return;
  const base = snapshot ?? placeholderSnapshot(`obs-${Date.now()}`);
  appendBehavioralSnapshot(base, standaloneObservation, options);
}

export function appendBehavioralSnapshot(
  snapshot: BehavioralSnapshot | null | undefined,
  standaloneObservation?: StandaloneObservation | null,
  options?: AppendBehavioralOptions
): void {
  if (!canWriteEzaProfileHistory(options?.ownerUserId)) return;
  if (!snapshot || typeof window === 'undefined') return;
  try {
    const key = behavioralHistoryStorageKey(options?.ownerUserId);
    const list = parseEntries(localStorage.getItem(key));
    const entry: SavedBehavioralEntry = {
      ...snapshot,
      savedAt: new Date().toISOString(),
      ...(standaloneObservation ? { standaloneObservation } : {}),
      ...(options?.mirrorCueHints?.length ? { mirrorCueHints: options.mirrorCueHints } : {}),
    };
    list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list.slice(0, MAX_ITEMS)));
    notifyBehavioralHistoryUpdated();
  } catch {
    // ignore quota / parse errors
  }
}

export function isValidBehavioralEntry(
  entry: SavedBehavioralEntry | null | undefined
): entry is SavedBehavioralEntry {
  if (!entry?.vector) return false;
  const v = entry.vector;
  return (
    typeof v.input_risk === 'number' &&
    typeof v.output_risk === 'number' &&
    !Number.isNaN(v.input_risk) &&
    !Number.isNaN(v.output_risk)
  );
}

export function readBehavioralHistory(ownerUserId?: string | null): SavedBehavioralEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const scope = resolveEzaOwnerScope(ownerUserId);
    if (scope === 'guest') {
      migrateLegacyIntoGuestBucketOnce();
    }
    return parseEntries(localStorage.getItem(behavioralHistoryStorageKey(ownerUserId)));
  } catch {
    return [];
  }
}

export function clearBehavioralHistory(ownerUserId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(behavioralHistoryStorageKey(ownerUserId));
    notifyBehavioralHistoryUpdated();
  } catch {
    /* empty */
  }
}

/**
 * Seed history only when empty (archive backfill / future server hydrate).
 * Gated by ezaDataProcessingEnabled — fail-closed when prefs unreadable.
 */
export function seedBehavioralHistoryFromEntries(
  entries: SavedBehavioralEntry[],
  ownerUserId?: string | null
): boolean {
  if (!canWriteEzaProfileHistory(ownerUserId)) return false;
  if (typeof window === 'undefined' || !entries.length) return false;
  if (readBehavioralHistory(ownerUserId).length > 0) return false;
  try {
    const normalized = entries.filter(isValidBehavioralEntry).slice(0, MAX_ITEMS);
    if (!normalized.length) return false;
    localStorage.setItem(
      behavioralHistoryStorageKey(ownerUserId),
      JSON.stringify(normalized)
    );
    notifyBehavioralHistoryUpdated();
    return true;
  } catch {
    return false;
  }
}
