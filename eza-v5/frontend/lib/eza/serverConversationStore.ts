/**
 * Phase 8.8G-2 — server-authoritative conversation state for authenticated users.
 *
 * Device B with empty localStorage bootstraps sidebar from server list.
 * localStorage remains a compatibility cache only.
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
  CHATS_UPDATED_EVENT,
  type ArchivedChat,
  type ArchivedChatMessage,
  type ArchivedChatSummary,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

type ServerConversationState = {
  loadedForUserId: string | null;
  summaries: ArchivedChatSummary[];
  serverIdByClientId: Record<string, string>;
  loading: boolean;
  error: string | null;
};

const state: ServerConversationState = {
  loadedForUserId: null,
  summaries: [],
  serverIdByClientId: {},
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
  }
  listeners.forEach((listener) => listener());
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

export function isServerBackedUser(userId: string | null | undefined): boolean {
  return Boolean(userId && state.loadedForUserId === userId);
}

export function clearServerConversationState(): void {
  state.loadedForUserId = null;
  state.summaries = [];
  state.serverIdByClientId = {};
  state.loading = false;
  state.error = null;
  emit();
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

export async function bootstrapServerConversations(userId: string): Promise<void> {
  state.loading = true;
  state.error = null;
  emit();
  try {
    const items = await listServerConversations();
    if (state.loadedForUserId && state.loadedForUserId !== userId) {
      return;
    }
    state.loadedForUserId = userId;
    state.serverIdByClientId = {};
    state.summaries = items.map(mapListItemToSummary);
    state.loading = false;
    state.error = null;
  } catch {
    state.loading = false;
    state.error = 'bootstrap_failed';
  }
  emit();
}

export async function ensureServerConversation(
  input: CreateServerConversationInput
): Promise<ServerConversationListItem> {
  const created = await createServerConversation(input);
  const summary = mapListItemToSummary(created);
  const existingIdx = state.summaries.findIndex((s) => s.id === summary.id);
  if (existingIdx >= 0) {
    state.summaries[existingIdx] = summary;
  } else {
    state.summaries = [summary, ...state.summaries];
  }
  emit();
  return created;
}

export async function fetchServerConversationDetail(
  clientConversationId: string
): Promise<ArchivedChat | null> {
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return null;
  const detail = await getServerConversation(serverId);
  const archived = mapDetailToArchivedChat(detail);
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

export async function deleteServerBackedConversation(clientConversationId: string): Promise<void> {
  const serverId = getServerIdForClientChat(clientConversationId);
  if (serverId) {
    await deleteServerConversation(serverId);
  }
  state.summaries = state.summaries.filter((s) => s.id !== clientConversationId);
  delete state.serverIdByClientId[clientConversationId];
  emit();
}

export async function renameServerBackedConversation(
  clientConversationId: string,
  title: string
): Promise<void> {
  const serverId = getServerIdForClientChat(clientConversationId);
  if (!serverId) return;
  const updated = await patchServerConversation(serverId, { title, titlePinned: true });
  const summary = mapListItemToSummary(updated);
  const idx = state.summaries.findIndex((s) => s.id === clientConversationId);
  if (idx >= 0) {
    state.summaries[idx] = summary;
  }
  emit();
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
