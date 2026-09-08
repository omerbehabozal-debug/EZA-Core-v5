/**
 * Phase 8.8G-2 / 8.8G-2.1 — server-authoritative conversation state for authenticated users.
 */

import {
  createServerConversation,
  deleteServerConversation,
  getServerConversation,
  listServerConversations,
  patchServerConversation,
  type ServerConversationDetail,
  type ServerConversationListItem,
  type CreateServerConversationInput,
} from '@/lib/eza/standaloneConversationsApi';
import type { ConversationSceneSource } from '@/lib/eza/conversationSceneIdentity';
import {
  deriveConversationTitle,
  isDefaultConversationTitle,
  DEFAULT_CONVERSATION_TITLE,
} from '@/lib/eza/conversationTitle';
import {
  CHATS_UPDATED_EVENT,
  getChatArchive,
  type ArchivedChat,
  type ArchivedChatMessage,
  type ArchivedChatSummary,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

export type ConversationPersistenceStatus = {
  conversationPersisted: boolean;
  assistantPersisted: boolean;
};

type ServerConversationState = {
  summaries: ArchivedChatSummary[];
  serverIdByClientId: Record<string, string>;
  detailCache: Record<string, ArchivedChat>;
  loading: boolean;
  error: string | null;
  unsyncedClientIds: Set<string>;
  /**
   * Phase 8.8G-3.2.2 — authority readiness.
   * none: no owner / cleared
   * loading: fetch in flight (FAILED != empty)
   * ready: complete successful list installed (may be empty)
   * failed: last fetch failed (may still hold last-good snapshot)
   */
  authorityPhase: 'none' | 'loading' | 'ready' | 'failed';
  /** True after at least one complete successful list for the current owner. */
  hasCompleteSnapshot: boolean;
};

const state: ServerConversationState = {
  summaries: [],
  serverIdByClientId: {},
  detailCache: {},
  loading: false,
  error: null,
  unsyncedClientIds: new Set(),
  authorityPhase: 'none',
  hasCompleteSnapshot: false,
};

let activeOwnerKey: string | null = null;
let bootstrapEpoch = 0;

const listeners = new Set<() => void>();

function emit(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
  }
  listeners.forEach((listener) => listener());
}

function captureAuthority(): { ownerAtStart: string | null; epochAtStart: number } {
  return { ownerAtStart: activeOwnerKey, epochAtStart: bootstrapEpoch };
}

function isAuthorityValid(
  ownerAtStart: string | null,
  epochAtStart: number
): boolean {
  return ownerAtStart === activeOwnerKey && epochAtStart === bootstrapEpoch;
}

function resetMutableState(): void {
  state.summaries = [];
  state.serverIdByClientId = {};
  state.detailCache = {};
  state.loading = false;
  state.error = null;
  state.unsyncedClientIds = new Set();
  state.authorityPhase = 'none';
  state.hasCompleteSnapshot = false;
}

export function subscribeServerConversations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getServerConversationSummaries(): ArchivedChatSummary[] {
  return state.summaries;
}

export function getServerIdForClientChat(clientId: string): string | null {
  return state.serverIdByClientId[clientId] ?? null;
}

export function hasServerBackedConversation(clientId: string): boolean {
  return Boolean(
    state.serverIdByClientId[clientId] ||
      state.summaries.some((s) => s.id === clientId && s.serverConversationId)
  );
}

export function isServerBackedUser(userId: string | null | undefined): boolean {
  return Boolean(userId && activeOwnerKey === userId);
}

export function isConversationDurable(clientId: string): boolean {
  return (
    hasServerBackedConversation(clientId) && !state.unsyncedClientIds.has(clientId)
  );
}

export function markConversationUnsynced(clientId: string): void {
  state.unsyncedClientIds.add(clientId);
  emit();
}

export function markConversationSynced(clientId: string): void {
  state.unsyncedClientIds.delete(clientId);
  emit();
}

export function getUnsyncedClientIds(): ReadonlySet<string> {
  return state.unsyncedClientIds;
}

/** Phase 8.8G-3.2.2 — LOADING | READY | FAILED | NONE (not inferred from length). */
export function getServerAuthorityPhase():
  | 'none'
  | 'loading'
  | 'ready'
  | 'failed' {
  return state.authorityPhase;
}

export function hasCompleteServerAuthoritySnapshot(): boolean {
  return state.hasCompleteSnapshot;
}

/**
 * Sidebar reconcile mode for the current owner.
 * Complete snapshot (even if empty) ⇒ authoritative.
 * Otherwise loading/failed without snapshot ⇒ degraded local visibility.
 */
export function getSidebarAuthorityMode(): 'authoritative' | 'degraded' {
  if (state.hasCompleteSnapshot) return 'authoritative';
  return 'degraded';
}

export function applyPersistenceStatus(
  clientId: string,
  status: ConversationPersistenceStatus | null | undefined
): void {
  if (!status) return;
  if (status.conversationPersisted && status.assistantPersisted) {
    markConversationSynced(clientId);
  } else {
    markConversationUnsynced(clientId);
  }
}

export function beginAccountSession(userId: string): void {
  if (activeOwnerKey !== userId) {
    bootstrapEpoch += 1;
    activeOwnerKey = userId;
    resetMutableState();
    emit();
  }
}

export function clearServerConversationState(): void {
  bootstrapEpoch += 1;
  activeOwnerKey = null;
  resetMutableState();
  emit();
}

/** Test-only reset — not used in production UI. */
export function resetServerConversationStoreForTests(): void {
  bootstrapEpoch = 0;
  activeOwnerKey = null;
  resetMutableState();
  listeners.clear();
}

/** Test helper — map client conversation id → server UUID for assign mutations. */
export function seedServerConversationIdForTests(
  clientConversationId: string,
  serverConversationId: string
): void {
  state.serverIdByClientId[clientConversationId] = serverConversationId;
}

function mapListItemToSummary(item: ServerConversationListItem): ArchivedChatSummary {
  const savedAt = item.lastMessageAt || item.updatedAt || item.createdAt;
  state.serverIdByClientId[item.clientConversationId] = item.id;
  return {
    id: item.clientConversationId,
    title: item.title || 'Yeni sohbet',
    preview: item.preview || '',
    savedAt,
    messageCount: item.messageCount,
    pinned: item.pinned,
    titlePinned: item.titlePinned,
    groupId: item.groupId ?? null,
    conversationSceneUrl: item.conversationSceneUrl ?? null,
    conversationSceneSource: (item.conversationSceneSource as ConversationSceneSource | null) ?? null,
    conversationSceneSlug: item.conversationSceneSlug ?? null,
    serverConversationId: item.id,
    hasReadyYansi: Boolean(item.hasReadyYansi),
    publishedYansiSlug: item.publishedYansiSlug ?? null,
  };
}

function mapDetailToArchivedChat(detail: ServerConversationDetail): ArchivedChat {
  const savedAt = detail.lastMessageAt || detail.updatedAt || detail.createdAt;
  state.serverIdByClientId[detail.clientConversationId] = detail.id;
  const messages: ArchivedChatMessage[] = [...detail.messages]
    .sort((a, b) => a.sequence - b.sequence)
    .map((msg) => ({
      id: msg.clientMessageId,
      text: msg.content,
      isUser: msg.role === 'user',
      timestamp: msg.createdAt,
    }));

  return {
    id: detail.clientConversationId,
    serverConversationId: detail.id,
    title: detail.title || 'Yeni sohbet',
    preview: detail.preview || '',
    savedAt,
    messageCount: detail.messageCount,
    messages,
    pinned: detail.pinned,
    titlePinned: detail.titlePinned,
    groupId: detail.groupId ?? null,
    conversationSceneUrl: detail.conversationSceneUrl ?? null,
    conversationSceneSource:
      (detail.conversationSceneSource as ConversationSceneSource | null) ?? null,
    conversationSceneSlug: detail.conversationSceneSlug ?? null,
  };
}

export async function bootstrapServerConversations(userId: string): Promise<boolean> {
  beginAccountSession(userId);
  const { ownerAtStart, epochAtStart } = captureAuthority();
  state.loading = true;
  state.error = null;
  state.authorityPhase = 'loading';
  // Do NOT clear last-good summaries on same-owner refresh.
  emit();
  try {
    const items = await listServerConversations();
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return false;
    state.serverIdByClientId = {};
    state.summaries = items.map(mapListItemToSummary);
    state.loading = false;
    state.error = null;
    state.authorityPhase = 'ready';
    state.hasCompleteSnapshot = true;
  } catch {
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return false;
    state.loading = false;
    state.error = 'bootstrap_failed';
    state.authorityPhase = 'failed';
    // Preserve last-good complete snapshot when present; never install [].
    emit();
    return false;
  }
  if (isAuthorityValid(ownerAtStart, epochAtStart)) {
    emit();
    return true;
  }
  return false;
}

/** Snapshot for owner/epoch-bound follow-up work (e.g. 8.8G-3 migration). */
export function getServerConversationAuthority(): {
  ownerKey: string | null;
  epoch: number;
  bootstrapOk: boolean;
} {
  return {
    ownerKey: activeOwnerKey,
    epoch: bootstrapEpoch,
    // Only a successful complete install authorizes migration.
    bootstrapOk:
      state.authorityPhase === 'ready' &&
      state.hasCompleteSnapshot &&
      !state.loading &&
      state.error == null &&
      activeOwnerKey != null,
  };
}

export function isServerConversationAuthorityValid(
  ownerAtStart: string | null,
  epochAtStart: number
): boolean {
  return isAuthorityValid(ownerAtStart, epochAtStart);
}

export function noteServerConversationGroupCleared(groupId: string): void {
  const id = groupId.trim();
  if (!id) return;
  let changed = false;
  state.summaries = state.summaries.map((row) => {
    if (row.groupId !== id) return row;
    changed = true;
    return { ...row, groupId: null };
  });
  if (changed) emit();
}

export function noteServerConversationGroupAssigned(
  clientConversationId: string,
  groupId: string | null
): void {
  const id = clientConversationId.trim();
  if (!id) return;
  const idx = state.summaries.findIndex((row) => row.id === id);
  if (idx < 0) return;
  const current = state.summaries[idx];
  if (!current) return;
  state.summaries[idx] = { ...current, groupId };
  emit();
}

export function noteServerYansiReady(clientConversationId: string): void {
  const id = clientConversationId.trim();
  if (!id) return;
  const idx = state.summaries.findIndex((row) => row.id === id);
  if (idx < 0) return;
  const current = state.summaries[idx];
  if (!current) return;
  state.summaries[idx] = {
    ...current,
    hasReadyYansi: true,
  };
  emit();
}

/**
 * Stage 2 — promote Yansı title + visual onto the same conversation identity.
 * Uses titlePinned so late initializeTitleOnly cannot downgrade.
 */
export async function promoteServerConversationIdentityFromYansi(input: {
  clientConversationId: string;
  title: string;
  conversationSceneUrl?: string | null;
  conversationSceneSource?: ConversationSceneSource | null;
  conversationSceneSlug?: string | null;
}): Promise<void> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const id = input.clientConversationId.trim();
  const title = input.title.trim();
  if (!id || !title) return;

  const serverId = getServerIdForClientChat(id);
  if (!serverId) return;

  const sceneUrl = (input.conversationSceneUrl || '').trim() || undefined;
  const patch: Parameters<typeof patchServerConversation>[1] = {
    title,
    titlePinned: true,
  };
  if (sceneUrl) {
    patch.conversationSceneUrl = sceneUrl;
    if (input.conversationSceneSource) {
      patch.conversationSceneSource = input.conversationSceneSource;
    }
    if (input.conversationSceneSlug !== undefined) {
      patch.conversationSceneSlug = input.conversationSceneSlug;
    }
  }

  try {
    const updated = await patchServerConversation(serverId, patch);
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return;
    const summary = mapListItemToSummary(updated);
    summary.hasReadyYansi = true;
    const idx = state.summaries.findIndex((s) => s.id === id);
    if (idx >= 0) {
      state.summaries[idx] = summary;
    } else {
      state.summaries = [summary, ...state.summaries];
    }
    const cached = state.detailCache[id];
    if (cached) {
      state.detailCache[id] = {
        ...cached,
        title: summary.title,
        titlePinned: true,
        conversationSceneUrl: summary.conversationSceneUrl ?? cached.conversationSceneUrl,
        conversationSceneSource:
          summary.conversationSceneSource ?? cached.conversationSceneSource,
        conversationSceneSlug: summary.conversationSceneSlug ?? cached.conversationSceneSlug,
      };
    }
    const local = getChatArchive(id);
    if (local) {
      upsertChatArchive({
        ...local,
        title: summary.title,
        titlePinned: true,
        conversationSceneUrl: summary.conversationSceneUrl ?? local.conversationSceneUrl,
        conversationSceneSource:
          summary.conversationSceneSource ?? local.conversationSceneSource,
        conversationSceneSlug: summary.conversationSceneSlug ?? local.conversationSceneSlug,
      });
    }
    emit();
  } catch {
    // Non-blocking: local scene may already be set by ObservationExperience.
    const idx = state.summaries.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const current = state.summaries[idx];
      state.summaries[idx] = {
        ...current,
        title,
        titlePinned: true,
        hasReadyYansi: true,
        ...(sceneUrl
          ? {
              conversationSceneUrl: sceneUrl,
              conversationSceneSource: input.conversationSceneSource ?? current.conversationSceneSource,
              conversationSceneSlug:
                input.conversationSceneSlug !== undefined
                  ? input.conversationSceneSlug
                  : current.conversationSceneSlug,
            }
          : {}),
      };
      emit();
    }
  }
}

export function noteServerYansiPublished(
  clientConversationId: string,
  slug: string
): void {
  const id = clientConversationId.trim();
  const published = slug.trim().toLowerCase();
  if (!id || !published) return;
  const idx = state.summaries.findIndex((row) => row.id === id);
  if (idx < 0) return;
  const current = state.summaries[idx];
  if (!current) return;
  state.summaries[idx] = {
    ...current,
    hasReadyYansi: false,
    publishedYansiSlug: published,
  };
  emit();
}

export async function ensureServerConversation(
  input: CreateServerConversationInput
): Promise<ServerConversationListItem> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const created = await createServerConversation(input);
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) {
    throw new Error('server_conversation_stale_authority');
  }
  const summary = mapListItemToSummary(created);
  const existingIdx = state.summaries.findIndex((s) => s.id === summary.id);
  if (existingIdx >= 0) {
    state.summaries[existingIdx] = summary;
  } else {
    state.summaries = [summary, ...state.summaries];
  }
  markConversationSynced(summary.id);
  emit();
  return created;
}

export async function fetchServerConversationDetail(
  clientConversationId: string
): Promise<ArchivedChat | null> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return null;
  const detail = await getServerConversation(serverId);
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) return null;
  const archived = mapDetailToArchivedChat(detail);
  state.detailCache[clientConversationId] = archived;
  upsertChatArchive(archived);
  const summary = mapListItemToSummary(detail);
  const idx = state.summaries.findIndex((s) => s.id === summary.id);
  if (idx >= 0) {
    state.summaries[idx] = summary;
  } else {
    state.summaries = [summary, ...state.summaries];
  }
  emit();
  return archived;
}

export async function deleteServerBackedConversation(
  clientConversationId: string
): Promise<void> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) {
    throw new Error('server_conversation_not_found');
  }
  await deleteServerConversation(serverId);
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) return;
  state.summaries = state.summaries.filter((s) => s.id !== clientConversationId);
  delete state.serverIdByClientId[clientConversationId];
  delete state.detailCache[clientConversationId];
  state.unsyncedClientIds.delete(clientConversationId);
  emit();
}

export async function renameServerBackedConversation(
  clientConversationId: string,
  title: string
): Promise<void> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return;
  const updated = await patchServerConversation(serverId, { title, titlePinned: true });
  if (!isAuthorityValid(ownerAtStart, epochAtStart)) return;
  const summary = mapListItemToSummary(updated);
  const idx = state.summaries.findIndex((s) => s.id === clientConversationId);
  if (idx >= 0) {
    state.summaries[idx] = summary;
  }
  emit();
}

const DEFAULT_SERVER_TITLE = DEFAULT_CONVERSATION_TITLE;

function applyTitleToLocalAndStore(
  clientConversationId: string,
  title: string,
  titlePinned: boolean
): void {
  const idx = state.summaries.findIndex((s) => s.id === clientConversationId);
  if (idx >= 0) {
    const current = state.summaries[idx];
    state.summaries[idx] = {
      ...current,
      title,
      titlePinned,
    };
  }
  const cached = state.detailCache[clientConversationId];
  if (cached) {
    state.detailCache[clientConversationId] = {
      ...cached,
      title,
      titlePinned,
    };
  }
  const local = getChatArchive(clientConversationId);
  if (local && !local.titlePinned) {
    upsertChatArchive({
      ...local,
      title,
      ...(titlePinned ? { titlePinned: true } : {}),
    });
  } else if (local && titlePinned) {
    upsertChatArchive({
      ...local,
      title,
      titlePinned: true,
    });
  }
}

export async function persistServerConversationTitleIfNeeded(
  clientConversationId: string,
  firstUserText: string
): Promise<void> {
  const { ownerAtStart, epochAtStart } = captureAuthority();
  const summary = state.summaries.find((s) => s.id === clientConversationId);
  if (summary?.titlePinned) return;
  const local = getChatArchive(clientConversationId);
  if (local?.titlePinned) return;

  const derived = deriveConversationTitle(firstUserText);
  if (!derived) return;
  const currentTitle = summary?.title?.trim() || local?.title?.trim() || DEFAULT_SERVER_TITLE;
  if (!isDefaultConversationTitle(currentTitle)) return;

  // Optimistic: sidebar + header share store/local before PATCH round-trip.
  applyTitleToLocalAndStore(clientConversationId, derived, false);
  emit();

  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return;

  try {
    const updated = await patchServerConversation(serverId, {
      title: derived,
      initializeTitleOnly: true,
    });
    if (!isAuthorityValid(ownerAtStart, epochAtStart)) return;
    const nextSummary = mapListItemToSummary(updated);
    // If CAS no-op returned a newer/pinned title, prefer server authority.
    const idx = state.summaries.findIndex((s) => s.id === clientConversationId);
    if (idx >= 0) {
      state.summaries[idx] = nextSummary;
    }
    const cached = state.detailCache[clientConversationId];
    if (cached) {
      state.detailCache[clientConversationId] = {
        ...cached,
        title: nextSummary.title,
        titlePinned: nextSummary.titlePinned,
      };
    }
    const archive = getChatArchive(clientConversationId);
    if (archive) {
      if (nextSummary.titlePinned || !archive.titlePinned) {
        upsertChatArchive({
          ...archive,
          title: nextSummary.title,
          ...(nextSummary.titlePinned ? { titlePinned: true } : {}),
        });
      }
    }
    emit();
  } catch {
    // Keep optimistic local title; do not block conversation.
  }
}

export function buildGenerationPersistencePayload(
  clientConversationId: string,
  clientUserMessageId: string,
  clientAssistantMessageId: string
): Record<string, string> | null {
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return null;
  return {
    serverConversationId: serverId,
    clientUserMessageId,
    clientAssistantMessageId,
  };
}

export function parseApiPersistenceStatus(
  data: Record<string, unknown> | null | undefined
): ConversationPersistenceStatus | null {
  if (!data) return null;
  const raw = data.persistence;
  if (raw && typeof raw === 'object') {
    const p = raw as Record<string, unknown>;
    return {
      conversationPersisted: Boolean(p.conversationPersisted),
      assistantPersisted: Boolean(p.assistantPersisted),
    };
  }
  if (data.conversationPersistence) {
    return { conversationPersisted: true, assistantPersisted: true };
  }
  return null;
}
