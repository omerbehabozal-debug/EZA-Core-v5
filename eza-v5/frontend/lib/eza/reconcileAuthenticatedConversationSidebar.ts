/**
 * Phase 8.8G-3.2 — narrow owner-visible local fallbacks for authenticated sidebar.
 *
 * Server remains authority for identity / delete / tombstone / ordering of
 * active server rows. Local fallbacks never fabricate server IDs and never
 * merge guest or other-account buckets.
 */

import type { LegacyMigrationStatus } from '@/lib/eza/standaloneConversationsApi';
import type { ArchivedChat, ArchivedChatSummary } from '@/lib/standaloneChatArchive';
import { isChatDeleted } from '@/lib/standaloneChatDelete';

const OWNER_VISIBLE_FALLBACK_STATUSES = new Set<LegacyMigrationStatus>([
  'empty_transcript',
  'rejected_invalid',
  'failed_retryable',
]);

export type MigrationMarkerConversationState = {
  status: LegacyMigrationStatus;
  serverConversationId?: string | null;
  reason?: string | null;
};

export type MigrationMarkerSnapshot = {
  version: string;
  completedAt?: string;
  conversations: Record<string, MigrationMarkerConversationState>;
} | null;

export type ReconcileAuthenticatedConversationSidebarInput = {
  ownerId: string;
  serverSummaries: ArchivedChatSummary[];
  ownerLocalArchives: ArchivedChat[];
  migrationMarker: MigrationMarkerSnapshot;
  /** Client ids known tombstoned by migration authority. */
  tombstonedClientIds?: Iterable<string>;
  /** Client ids marked deleted locally (server delete / user delete). */
  deletedClientIds?: Iterable<string>;
  /** Current unsynced authenticated chats (server create/retry pending). */
  unsyncedClientIds?: Iterable<string>;
};

function safeSavedAtMs(value: string | null | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function toSummary(chat: ArchivedChat): ArchivedChatSummary {
  return {
    id: chat.id,
    title: chat.title || 'Yeni sohbet',
    preview: chat.preview || '',
    savedAt: chat.savedAt || new Date(0).toISOString(),
    messageCount: chat.messageCount ?? chat.messages?.length ?? 0,
    pinned: chat.pinned,
    titlePinned: chat.titlePinned,
    groupId: chat.groupId ?? chat.treeMetadata?.groupId ?? null,
    conversationSceneUrl: chat.conversationSceneUrl ?? null,
    conversationSceneSource: chat.conversationSceneSource ?? null,
    conversationSceneSlug: chat.conversationSceneSlug ?? null,
    // Never fabricate a server id for fallback rows.
    serverConversationId: undefined,
    hasReadyYansi: Boolean(chat.hasReadyYansi),
    publishedYansiSlug: chat.publishedYansiSlug ?? null,
  };
}

function sortSidebarSummaries(rows: ArchivedChatSummary[]): ArchivedChatSummary[] {
  return [...rows].sort((a, b) => {
    const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pin !== 0) return pin;
    const tb = safeSavedAtMs(b.savedAt);
    const ta = safeSavedAtMs(a.savedAt);
    if (tb !== ta) return tb - ta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Merge server-authoritative summaries with conservative owner-local fallbacks.
 *
 * Precedence:
 * SERVER ACTIVE > LOCAL FALLBACK
 * SERVER TOMBSTONE/DELETE > HIDE LOCAL
 * GUEST / OTHER ACCOUNT > NEVER (caller must pass only current-user bucket)
 */
export function reconcileAuthenticatedConversationSidebar(
  input: ReconcileAuthenticatedConversationSidebarInput
): ArchivedChatSummary[] {
  const ownerId = (input.ownerId || '').trim();
  if (!ownerId) return [];

  const serverSummaries = Array.isArray(input.serverSummaries) ? input.serverSummaries : [];
  const ownerLocalArchives = Array.isArray(input.ownerLocalArchives)
    ? input.ownerLocalArchives
    : [];

  const serverClientIds = new Set<string>();
  for (const row of serverSummaries) {
    if (row?.id) serverClientIds.add(row.id);
  }

  const tombstoned = new Set<string>();
  for (const id of Array.from(input.tombstonedClientIds ?? [])) {
    if (id) tombstoned.add(id);
  }
  const marker = input.migrationMarker;
  if (marker?.conversations) {
    for (const [id, state] of Object.entries(marker.conversations)) {
      if (state?.status === 'tombstoned') tombstoned.add(id);
    }
  }

  const deleted = new Set<string>();
  for (const id of Array.from(input.deletedClientIds ?? [])) {
    if (id) deleted.add(id);
  }

  const unsynced = new Set<string>();
  for (const id of Array.from(input.unsyncedClientIds ?? [])) {
    if (id) unsynced.add(id);
  }

  const fallbacks: ArchivedChatSummary[] = [];
  for (const chat of ownerLocalArchives) {
    const id = chat?.id?.trim();
    if (!id) continue;

    // Active server row wins — never duplicate.
    if (serverClientIds.has(id)) continue;
    if (chat.serverConversationId) {
      // Previously mapped / deleted on server: do not resurrect from local.
      continue;
    }

    if (tombstoned.has(id)) continue;
    if (deleted.has(id) || isChatDeleted(id)) continue;

    const status = marker?.conversations[id]?.status;
    const eligible =
      unsynced.has(id) ||
      (status != null && OWNER_VISIBLE_FALLBACK_STATUSES.has(status)) ||
      // Pending migration / not yet examined — keep owner-visible until terminal hide.
      status == null;

    if (!eligible) continue;
    // migrated / already_server_authoritative without a live server row must not
    // invent visibility here (pagination/bootstrap owns recovery).
    if (status === 'migrated' || status === 'already_server_authoritative') {
      continue;
    }

    fallbacks.push(toSummary(chat));
  }

  return sortSidebarSummaries([...serverSummaries, ...fallbacks]);
}
