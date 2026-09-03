/**
 * Phase 8.8G-3 — migrate account-scoped legacy local chats to server authority.
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

export const LEGACY_MIGRATION_VERSION = 'standalone-conversations-v1';
const MARKER_STORAGE_KEY = 'eza_standalone_legacy_migration_v1';

const TERMINAL_STATUSES = new Set<LegacyMigrationStatus>([
  'migrated',
  'already_server_authoritative',
  'tombstoned',
  'rejected_invalid',
]);

type MarkerConversationState = {
  status: LegacyMigrationStatus;
  serverConversationId?: string | null;
  reason?: string | null;
};

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

function updateMarker(
  userId: string,
  results: LegacyMigrationConversationResult[],
  eligibleIds: string[]
): void {
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

  const allTerminal = eligibleIds.every((id) => {
    const st = conversations[id]?.status;
    return st != null && TERMINAL_STATUSES.has(st);
  });

  const next: UserMigrationMarker = {
    version: LEGACY_MIGRATION_VERSION,
    conversations,
    ...(allTerminal ? { completedAt: new Date().toISOString() } : {}),
  };
  // Never keep completedAt if any retryable remains
  if (!allTerminal) {
    delete next.completedAt;
  }
  store[userId] = next;
  writeMarkerStore(store);
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
  if (!Array.isArray(chat.messages) || chat.messages.length === 0) return null;

  const treeMetadata = sanitizeTreeMetadataForMigration(chat.treeMetadata);
  const sceneUrl =
    chat.conversationSceneUrl && isPersistableConversationSceneUrl(chat.conversationSceneUrl)
      ? chat.conversationSceneUrl
      : undefined;

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
    groupId: chat.groupId || chat.treeMetadata?.groupId || undefined,
    treeMetadata,
    conversationSceneUrl: sceneUrl,
    conversationSceneSource: sceneUrl ? chat.conversationSceneSource || undefined : undefined,
    conversationSceneSlug: sceneUrl ? chat.conversationSceneSlug || undefined : undefined,
    messages,
  };
}

/**
 * Eligible = current user bucket, has messages, not already linked to server,
 * and not already terminal in marker (retryable may re-run).
 */
export function collectLegacyMigrationCandidates(userId: string): ArchivedChat[] {
  const scope = userScope(userId);
  const archives = readChatArchivesForScope(scope);
  const marker = getLegacyMigrationMarker(userId);
  return archives.filter((chat) => {
    if (!chat.id) return false;
    if (!chat.messages?.length) return false;
    if (chat.serverConversationId || getServerIdForClientChat(chat.id)) {
      return false;
    }
    const status = marker?.conversations[chat.id]?.status;
    if (status && TERMINAL_STATUSES.has(status)) {
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
    if (!chat.id || !chat.messages?.length) continue;
    const serverId = chat.serverConversationId || getServerIdForClientChat(chat.id);
    if (!serverId) continue;
    const prev = marker?.conversations[chat.id]?.status;
    if (prev && TERMINAL_STATUSES.has(prev)) continue;
    synthetic.push({
      clientConversationId: chat.id,
      status: 'already_server_authoritative',
      serverConversationId: serverId,
    });
  }
  if (synthetic.length === 0) return;
  const allMessageChatIds = archives.filter((c) => c.messages?.length).map((c) => c.id);
  updateMarker(userId, synthetic, allMessageChatIds);
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
    // Preserve full transcript — only annotate server id.
    return { ...chat, serverConversationId: result.serverConversationId };
  });
  if (changed) {
    replaceChatArchivesForScope(scope, next);
  }
}

export type LegacyMigrationRunResult = {
  ran: boolean;
  refreshed: boolean;
  results: LegacyMigrationConversationResult[];
};

/**
 * After successful server bootstrap for `userId`, migrate eligible local-only chats.
 */
export async function runLegacyConversationMigration(
  userId: string
): Promise<LegacyMigrationRunResult> {
  const authority = getServerConversationAuthority();
  if (
    !authority.bootstrapOk ||
    authority.ownerKey !== userId ||
    isLegacyMigrationComplete(userId)
  ) {
    return { ran: false, refreshed: false, results: [] };
  }

  const ownerAtStart = authority.ownerKey;
  const epochAtStart = authority.epoch;

  markAlreadyServerBackedLocals(userId);

  const candidates = collectLegacyMigrationCandidates(userId);
  if (candidates.length === 0) {
    const scope = userScope(userId);
    const archives = readChatArchivesForScope(scope);
    const eligibleIds = archives.filter((c) => c.messages?.length).map((c) => c.id);
    updateMarker(userId, [], eligibleIds);
    return { ran: false, refreshed: false, results: [] };
  }

  const payloads = candidates
    .map(buildPayload)
    .filter((p): p is LegacyMigrationConversationPayload => p != null);

  if (payloads.length === 0) {
    return { ran: false, refreshed: false, results: [] };
  }

  let response;
  try {
    response = await migrateLegacyServerConversations(payloads);
  } catch {
    if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
      return { ran: false, refreshed: false, results: [] };
    }
    const failed: LegacyMigrationConversationResult[] = payloads.map((p) => ({
      clientConversationId: p.clientConversationId,
      status: 'failed_retryable',
      reason: 'network_or_server_error',
    }));
    updateMarker(
      userId,
      failed,
      payloads.map((p) => p.clientConversationId)
    );
    return { ran: true, refreshed: false, results: failed };
  }

  if (!isServerConversationAuthorityValid(ownerAtStart, epochAtStart)) {
    return { ran: false, refreshed: false, results: [] };
  }

  updateMarker(
    userId,
    response.results,
    payloads.map((p) => p.clientConversationId)
  );
  annotateLocalArchives(userId, response.results);

  const changedServer = response.results.some(
    (r) => r.status === 'migrated' || r.status === 'already_server_authoritative'
  );

  let refreshed = false;
  if (changedServer) {
    const ok = await bootstrapServerConversations(userId);
    refreshed = ok && isServerConversationAuthorityValid(ownerAtStart, epochAtStart);
  }

  return { ran: true, refreshed, results: response.results };
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
