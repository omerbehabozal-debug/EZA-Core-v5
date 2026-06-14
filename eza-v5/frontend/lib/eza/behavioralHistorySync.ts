/**
 * Premium behavioral history — server sync architecture (planned).
 *
 * Today: `localStorage` (`eza_standalone_behavioral_history`) is the sole source.
 * Target: server is canonical; localStorage is offline cache + optimistic append.
 *
 * ## Sync flow (planned)
 * 1. On premium session hydrate: `GET /api/platform/behavioral-history?limit=50`
 *    → merge into local cache (newest wins by `interaction_id`).
 * 2. After each chat turn: append locally, then `POST /api/platform/behavioral-history/turn`
 *    with snapshot + standalone_observation (no raw message text).
 * 3. On pattern page load: if local empty but server has rows → hydrate cache first.
 * 4. Conflict: server `saved_at` newer than local for same `interaction_id` → keep server.
 *
 * ## Storage roles
 * - Server: canonical store per `user_id`, retention cap (e.g. 50 turns).
 * - localStorage: read-through cache, offline queue for failed POSTs.
 *
 * ## Privacy
 * - Only numeric vectors + observation categories (existing SavedBehavioralEntry shape).
 * - Chat archive text stays local until a separate chat-sync product decision.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export type BehavioralHistorySyncSource = 'local' | 'server' | 'merged';

export type BehavioralHistoryHydrateResult = {
  entries: SavedBehavioralEntry[];
  source: BehavioralHistorySyncSource;
  serverAvailable: boolean;
};

/** Planned API contract — not wired yet. */
export type BehavioralHistoryTurnPayload = {
  interaction_id: string;
  saved_at: string;
  snapshot: Omit<SavedBehavioralEntry, 'savedAt'>;
  standalone_observation?: SavedBehavioralEntry['standaloneObservation'];
  mirror_cue_hints?: string[];
};

export const BEHAVIORAL_HISTORY_SYNC_ENDPOINT = '/api/platform/behavioral-history';
