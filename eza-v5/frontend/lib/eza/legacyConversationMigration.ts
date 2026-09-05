/**
 * Phase 8.8G-3 — migrate account-scoped legacy local chats to server authority.
 * Phase 8.8G-3.2 — deterministic batch drain + entire-bucket completion marker.
 *
 * Only inspects user:{userId}. Never guest buckets.
 * Does not delete local source transcripts.
 */

import {
  migrateLegacyServerConversations,
  type LegacyMigrationConversationPayload,
  type LegacyMigrationConversationResult,
  type LegacyMigrationStatus,
} from '@/lib/eza/standaloneConversationsApi';
import {
  bootstrapServerConversations,
  getServerConversationAuthority,
  getServerIdForClientChat,
  isServerConversationAuthorityValid,
} from '@/lib/eza/serverConversationStore';
import {
  isPersistableConversationSceneUrl,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';
import {
  readChatArchivesForScope,
  replaceChatArchivesForScope,
} from '@/lib/standaloneChatArchive';
import { userScope } from '@/lib/eza/localIdentityScope';
import { sanitizeOptionalServerGroupId } from '@/lib/eza/serverGroupId';
import { isChatDeleted } from '@/lib/standaloneChatDelete';

export const LEGACY_MIGRATION_VERSION = 'standalone-conversations-v1';
export const LEGACY_MIGRATION_BATCH_SIZE = 30;
const MARKER_STORAGE_KEY = 'eza_standalone_legacy_migration_v1';
/** Defensive cap — 30/request ⇒ room for very large buckets without infinite loop. */
const MAX_MIGRATION_BATCHES = 500;

/** Exact terminal reason that must be reopened for content recovery (8.8G-5 / 2.2). */
export const INVALID_GROUP_ID_REJECTION_REASON = 'invalid_group_id';

const TERMINAL_STATUSES = new Set<LegacyMigrationStatus>([
  'migrated',
  'already_server_authoritative',
  'tombstoned',
  'rejected_invalid',
  'empty_transcript',
]);

export function isTerminalLegacyMigrationStatus(
  status: LegacyMigrationStatus | null | undefined
): boolean {
  return Boolean(status && TERMINAL_STATUSES.has(status));
}

type MarkerConversationState = {
  status: LegacyMigrationStatus;
  serverConversationId?: string | null;
  reason?: string | null;
};

/**
 * Only rejected_invalid + invalid_group_id is reopenable — not arbitrary rejections.
 */
export function isReopenableInvalidGroupIdRejection(
  state: MarkerConversationState | null | undefined
): boolean {
  if (!state) return false;
  return (
    state.status === 'rejected_invalid' &&
    (state.reason || '').trim() === INVALID_GROUP_ID_REJECTION_REASON
  );
}

/** Blocking terminal = terminal AND not the exact invalid_group_id reopen case. */
export function isBlockingTerminalMigrationState(
  state: MarkerConversationState | null | undefined
): boolean {
  if (!state?.status || !TERMINAL_STATUSES.has(state.status)) return false;
  if (isReopenableInvalidGroupIdRejection(state)) return false;
  return true;
}

type UserMigrationMarker = {
  version: string;
  completedAt?: string;
  conversations: Record<string, MarkerConversationState>;
};

type MarkerStore = Record<string, UserMigrationMarker>;

const FORBIDDEN_META_SUBSTRINGS = [
  'prooftoken',
  'sessiontoken',
  'authtoken',
  'accesstoken',
  'refreshtoken',
  'bearertoken',
  'lineageproof',
  'continuationproof',
  'authorization',
  'bearer',
  'jwt',
  'password',
  'credential',
  'csrftoken',
  'sessionid',
];

function normalizeMetaKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isForbiddenMetaKey(key: string): boolean {
  const n = normalizeMetaKey(key);
  if (!n) return false;
  return FORBIDDEN_META_SUBSTRINGS.some((frag) => n.includes(frag) || n === frag);
}

/** Recursively strip forbidden secret-bearing keys from tree metadata. */
export function sanitizeTreeMetadataForMigration(
  value: unknown
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenMetaKey(key)) continue;
    if (nested && typeof nested === 'object') {
      if (Array.isArray(nested)) {
        out[key] = nested.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? sanitizeTreeMetadataForMigration(item) ?? {}
            : item
        );
      } else {
        const cleaned = sanitizeTreeMetadataForMigration(nested);
        if (cleaned) out[key] = cleaned;
      }
    } else {
      out[key] = nested;
    }
  }
  return out;
}

function readMarkerStore(): MarkerStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MARKER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as MarkerStore;
  } catch {
    return {};
  }
}

function writeMarkerStore(store: MarkerStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MARKER_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

export function getLegacyMigrationMarker(userId: string): UserMigrationMarker | null {
  const entry = readMarkerStore()[userId];
  if (!entry || entry.version !== LEGACY_MIGRATION_VERSION) return null;
  return entry;
}

export function isLegacyMigrationComplete(userId: string): boolean {
  const marker = getLegacyMigrationMarker(userId);
  return Boolean(marker?.completedAt);
}

function safeSavedAtMs(value: string | null | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/** Deterministic archive order: savedAt desc, clientConversationId asc tie-break. */
export function sortLegacyMigrationCandidates(chats: ArchivedChat[]): ArchivedChat[] {
  return [...chats].sort((a, b) => {
    const tb = safeSavedAtMs(b.savedAt);
    const ta = safeSavedAtMs(a.savedAt);
    if (tb !== ta) return tb - ta;
    const idA = a.id || '';
    const idB = b.id || '';
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

function applyMarkerResults(
  userId: string,
  results: LegacyMigrationConversationResult[]
): UserMigrationMarker {
  const store = readMarkerStore();
  const prev = store[userId] ?? {
    version: LEGACY_MIGRATION_VERSION,
    conversations: {},
  };
  const conversations = { ...prev.conversations };
  for (const result of results) {
    conversations[result.clientConversationId] = {
      status: result.status,
      serverConversationId: result.serverConversationId,
      reason: result.reason,
    };
  }
  const next: UserMigrationMarker = {
    version: LEGACY_MIGRATION_VERSION,
    conversations,
  };
  // completedAt is owned exclusively by entire-bucket rescan.
  if (prev.completedAt) {
    next.completedAt = prev.completedAt;
  }
  store[userId] = next;
  writeMarkerStore(store);
  return next;
}

/**
 * completedAt means: every migration-responsibility record in the current
 * account-scoped bucket has a terminal outcome. Not "last batch was ok".
 */
export function rescanAndWriteCompletionMarker(userId: string): boolean {
  const store = readMarkerStore();
  const prev = store[userId] ?? {
    version: LEGACY_MIGRATION_VERSION,
    conversations: {},
  };
  const archives = readChatArchivesForScope(userScope(userId));
  const conversations = { ...prev.conversations };

  for (const chat of archives) {
    if (!chat.id) continue;
    const serverId = chat.serverConversationId || getServerIdForClientChat(chat.id);
    if (serverId) {
      const prevStatus = conversations[chat.id]?.status;
      if (!prevStatus || !isBlockingTerminalMigrationState(conversations[chat.id])) {
        conversations[chat.id] = {
          status: 'already_server_authoritative',
          serverConversationId: serverId,
        };
      }
      continue;
    }
    const st = conversations[chat.id];
    if (!isBlockingTerminalMigrationState(st)) {
      const next: UserMigrationMarker = {
        version: LEGACY_MIGRATION_VERSION,
        conversations,
      };
      store[userId] = next;
      writeMarkerStore(store);
      return false;
    }
  }

  const next: UserMigrationMarker = {
    version: LEGACY_MIGRATION_VERSION,
    conversations,
    completedAt: new Date().toISOString(),
  };
  store[userId] = next;
  writeMarkerStore(store);
  return true;
}

function mapConversationType(chat: ArchivedChat): string {
  const source = chat.treeMetadata?.sourceType;
  if (source === 'direct' || source === 'mirror' || source === 'mirror_branch') {
    return source;
  }
  if (chat.mirrorOrigin?.startedFromMirrorId) return 'mirror';
  return 'direct';
}

function buildPayload(chat: ArchivedChat): LegacyMigrationConversationPayload | null {
  if (!chat.id?.trim()) return null;
  if (!Array.isArray(chat.messages)) return null;

  const treeMetadata = sanitizeTreeMetadataForMigration(chat.treeMetadata);
  const sceneUrl =
    chat.conversationSceneUrl && isPersistableConversationSceneUrl(chat.conversationSceneUrl)
      ? chat.conversationSceneUrl
      : undefined;

  // Preserve ORIGINAL ordinals — do not renumber after filtering empty rows.
  const messages = chat.messages
    .map((msg, ordinal) => {
      const content = (msg.text || '').trim();
      if (!content) return null;
      return {
        clientMessageId: typeof msg.id === 'string' && msg.id.trim() ? msg.id.trim() : undefined,
        role: (msg.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
        content,
        ordinal,
        createdAt: typeof msg.timestamp === 'string' ? msg.timestamp : undefined,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m != null);

  if (messages.length === 0) return null;

  const parent =
    chat.treeMetadata?.parentConversationId ||
    chat.treeMetadata?.branchFromConversationId ||
    undefined;
  const sourceSlug =
    chat.treeMetadata?.startedFromMirrorId ||
    chat.mirrorOrigin?.startedFromMirrorId ||
    undefined;

  return {
    clientConversationId: chat.id,
    title: chat.title,
    titlePinned: Boolean(chat.titlePinned),
    pinned: Boolean(chat.pinned),
    conversationType: mapConversationType(chat),
    parentClientConversationId: parent || undefined,
    sourceYansiSlug: sourceSlug || undefined,
    // Payload only — do not mutate local archive groupId (Chrome tree UX).
    groupId: sanitizeOptionalServerGroupId(
      chat.groupId || chat.treeMetadata?.groupId || undefined
    ),
    treeMetadata,
    conversationSceneUrl: sceneUrl,
    conversationSceneSource: sceneUrl ? chat.conversationSceneSource || undefined : undefined,
    conversationSceneSlug: sceneUrl ? chat.conversationSceneSlug || undefined : undefined,
    messages,
  };
}

/** True when the chat has no usable non-whitespace message text. */
export function isEmptyLegacyTranscript(chat: ArchivedChat): boolean {
  if (!Array.isArray(chat.messages) || chat.messages.length === 0) return true;
  return chat.messages.every((m) => !(m.text || '').trim());
}

/**
 * Eligible = current user bucket, not already linked to server,
 * and not already a blocking terminal in marker (retryable may re-run).
 * Phase 8.8G-5 / 2.2 — rejected_invalid + invalid_group_id is reopenable.
 * Includes zero-message / empty-transcript chats for terminal accounting.
 */
export function collectLegacyMigrationCandidates(userId: string): ArchivedChat[] {
  const scope = userScope(userId);
  const archives = sortLegacyMigrationCandidates(readChatArchivesForScope(scope));
  const marker = getLegacyMigrationMarker(userId);
  return archives.filter((chat) => {
    if (!chat.id) return false;
    if (isChatDeleted(chat.id)) return false;
    if (chat.serverConversationId || getServerIdForClientChat(chat.id)) {
      return false;
    }
    const state = marker?.conversations[chat.id];
    if (isBlockingTerminalMigrationState(state)) {
      return false;
    }
    return true;
  });
}

function markAlreadyServerBackedLocals(userId: string): void {
  const scope = userScope(userId);
  const archives = readChatArchivesForScope(scope);
  const marker = getLegacyMigrationMarker(userId);
  const synthetic: LegacyMigrationConversationResult[] = [];
  for (const chat of archives) {
    if (!chat.id) continue;
    const serverId = chat.serverConversationId || getServerIdForClientChat(chat.id);
    if (!serverId) continue;
    const prev = marker?.conversations[chat.id];
    if (isBlockingTerminalMigrationState(prev)) continue;
    synthetic.push({
      clientConversationId: chat.id,
      status: 'already_server_authoritative',
      serverConversationId: serverId,
    });
  }
  if (synthetic.length === 0) return;
  applyMarkerResults(userId, synthetic);
}

/**
 * Classify candidates into local terminal results vs server payloads.
 * Every candidate must appear in one of the two buckets.
 */
export function classifyLegacyMigrationCandidates(candidates: ArchivedChat[]): {
  localTerminal: LegacyMigrationConversationResult[];
  payloads: LegacyMigrationConversationPayload[];
  candidateIds: string[];
} {
  const localTerminal: LegacyMigrationConversationResult[] = [];
  const payloads: LegacyMigrationConversationPayload[] = [];
  const candidateIds: string[] = [];

  for (const chat of sortLegacyMigrationCandidates(candidates)) {
    if (!chat.id) continue;
    candidateIds.push(chat.id);
    if (isEmptyLegacyTranscript(chat)) {
      localTerminal.push({
        clientConversationId: chat.id,
        status: 'empty_transcript',
        reason: 'empty_transcript',
      });
      continue;
    }
    const payload = buildPayload(chat);
    if (!payload) {
      localTerminal.push({
        clientConversationId: chat.id,
        status: 'empty_transcript',
        reason: 'empty_transcript',
      });
      continue;
    }
    payloads.push(payload);
  }

  return { localTerminal, payloads, candidateIds };
}

function annotateLocalArchives(
  userId: string,
  results: LegacyMigrationConversationResult[]
): void {
  const scope = userScope(userId);
  const archives = readChatArchivesForScope(scope);
  let changed = false;
  const byId = new Map(results.map((r) => [r.clientConversationId, r]));
  const next = archives.map((chat) => {
    const result = byId.get(chat.id);
    if (!result?.serverConversationId) return chat;
    if (
      result.status !== 'migrated' &&
      result.status !== 'already_server_authoritative'
    ) {
      return chat;
    }
    if (chat.serverConversationId === result.serverConversationId) return chat;
    changed = true;
    return { ...chat, serverConversationId: result.serverConversationId };
  });
  if (changed) {
    replaceChatArchivesForScope(scope, next);
  }
}

function accountBatchResults(
  submittedIds: string[],
  responseResults: LegacyMigrationConversationResult[]
): LegacyMigrationConversationResult[] {
  const byId = new Map(
    responseResults.map((r) => [r.clientConversationId, r] as const)
  );
  const out: LegacyMigrationConversationResult[] = [];
  for (const id of submittedIds) {
    const got = byId.get(id);
    if (got) {
      out.push(got);
    } else {
      out.push({
        clientConversationId: id,
        status: 'failed_retryable',
        reason: 'response_omission',
      });
    }
  }
  return out;
}

export type LegacyMigrationRunResult = {
  ran: boolean;
  refreshed: boolean;
  results: LegacyMigrationConversationResult[];
};

/**
 * After successful server bootstrap for `userId`, migrate eligible local-only chats.
 *
 * completedAt must NOT strand later unsynced current chats: we still inspect
 * the bucket for new non-terminal candidates even when a prior completedAt exists.
 */
export async function runLegacyConversationMigration(
  userId: string
): Promise<LegacyMigrationRunResult> {
  const authority = getServerConversationAuthority();
  if (!authority.bootstrapOk || authority.ownerKey !== userId) {
    return { ran: false, refreshed: false, results: [] };
  }

  const ownerAtStart = authority.ownerKey;
  const epochAtStart = authority.epoch;

  markAlreadyServerBackedLocals(userId);

  const candidates = collectLegacyMigrationCandidates(userId);
  if (candidates.length === 0) {
    if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
      return { ran: false, refreshed: false, results: [] };
    }
    rescanAndWriteCompletionMarker(userId);
    return { ran: false, refreshed: false, results: [] };
  }

  const { localTerminal, payloads } = classifyLegacyMigrationCandidates(candidates);

  const allResults: LegacyMigrationConversationResult[] = [...localTerminal];

  if (localTerminal.length > 0) {
    if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
      return { ran: false, refreshed: false, results: [] };
    }
    applyMarkerResults(userId, localTerminal);
  }

  let stopForRetryable = false;
  let changedServer = false;

  for (
    let offset = 0, batchIndex = 0;
    offset < payloads.length && batchIndex < MAX_MIGRATION_BATCHES;
    offset += LEGACY_MIGRATION_BATCH_SIZE, batchIndex += 1
  ) {
    if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
      return { ran: false, refreshed: false, results: [] };
    }

    const batch = payloads.slice(offset, offset + LEGACY_MIGRATION_BATCH_SIZE);
    const submittedIds = batch.map((p) => p.clientConversationId);

    let batchResults: LegacyMigrationConversationResult[];
    try {
      const response = await migrateLegacyServerConversations(batch);
      if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
        return { ran: false, refreshed: false, results: [] };
      }
      batchResults = accountBatchResults(submittedIds, response.results ?? []);
    } catch {
      if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
        return { ran: false, refreshed: false, results: [] };
      }
      // Batch N failed — mark this batch retryable; leave remaining unprocessed.
      batchResults = submittedIds.map((id) => ({
        clientConversationId: id,
        status: 'failed_retryable' as const,
        reason: 'network_or_server_error',
      }));
      applyMarkerResults(userId, batchResults);
      allResults.push(...batchResults);
      stopForRetryable = true;
      break;
    }

    applyMarkerResults(userId, batchResults);
    annotateLocalArchives(userId, batchResults);
    allResults.push(...batchResults);

    if (
      batchResults.some(
        (r) => r.status === 'migrated' || r.status === 'already_server_authoritative'
      )
    ) {
      changedServer = true;
    }

    if (batchResults.some((r) => r.status === 'failed_retryable')) {
      stopForRetryable = true;
      break;
    }
  }

  if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
    return { ran: false, refreshed: false, results: [] };
  }

  if (!stopForRetryable) {
    rescanAndWriteCompletionMarker(userId);
  } else {
    // Ensure completedAt stays absent while responsibility remains.
    const store = readMarkerStore();
    const entry = store[userId];
    if (entry?.completedAt) {
      delete entry.completedAt;
      store[userId] = entry;
      writeMarkerStore(store);
    }
  }

  let refreshed = false;
  if (changedServer) {
    const ok = await bootstrapServerConversations(userId);
    refreshed = ok && isServerConversationAuthorityValid(ownerAtStart, epochAtStart);
  }

  return {
    ran: allResults.length > 0 || payloads.length > 0,
    refreshed,
    results: allResults,
  };
}

/** Test helper — clear migration markers. */
export function resetLegacyMigrationMarkersForTests(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MARKER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
