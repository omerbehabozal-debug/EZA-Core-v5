/**
 * Phase 8.8G-2 — authenticated standalone conversation API client.
 */

import { apiClient } from '@/lib/apiClient';

export type ServerConversationType =
  | 'direct'
  | 'mirror'
  | 'mirror_branch'
  | 'continuation';

export type ServerConversationListItem = {
  id: string;
  clientConversationId: string;
  title?: string | null;
  preview?: string | null;
  conversationType: ServerConversationType;
  sourceYansiSlug?: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt?: string | null;
  lastMessageAt?: string | null;
  archived: boolean;
  pinned: boolean;
  titlePinned: boolean;
  groupId?: string | null;
  conversationSceneUrl?: string | null;
  conversationSceneSource?: string | null;
  conversationSceneSlug?: string | null;
};

export type ServerConversationMessage = {
  id: string;
  clientMessageId: string;
  role: 'user' | 'assistant';
  content: string;
  sequence: number;
  createdAt: string;
};

export type ServerConversationDetail = ServerConversationListItem & {
  messages: ServerConversationMessage[];
};

export type CreateServerConversationInput = {
  clientConversationId: string;
  title?: string;
  preview?: string;
  conversationType?: ServerConversationType;
  parentClientConversationId?: string;
  sourceYansiSlug?: string;
  groupId?: string;
  titlePinned?: boolean;
  pinned?: boolean;
};

export async function listServerConversations(): Promise<ServerConversationListItem[]> {
  const res = await apiClient.get<ServerConversationListItem[]>(
    '/api/standalone/conversations',
    { auth: true }
  );
  if (!res.ok || !Array.isArray(res.data)) {
    throw new Error('server_conversation_list_failed');
  }
  return res.data;
}

export async function getServerConversation(
  serverConversationId: string
): Promise<ServerConversationDetail> {
  const res = await apiClient.get<ServerConversationDetail>(
    `/api/standalone/conversations/${serverConversationId}`,
    { auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('server_conversation_detail_failed');
  }
  return res.data;
}

export async function createServerConversation(
  input: CreateServerConversationInput
): Promise<ServerConversationListItem> {
  const res = await apiClient.post<ServerConversationListItem>(
    '/api/standalone/conversations',
    { body: input, auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('server_conversation_create_failed');
  }
  return res.data;
}

export async function patchServerConversation(
  serverConversationId: string,
  patch: {
    title?: string;
    titlePinned?: boolean;
    pinned?: boolean;
    archived?: boolean;
    initializeTitleOnly?: boolean;
  }
): Promise<ServerConversationListItem> {
  const res = await apiClient.patch<ServerConversationListItem>(
    `/api/standalone/conversations/${serverConversationId}`,
    { body: patch, auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('server_conversation_patch_failed');
  }
  return res.data;
}

export async function deleteServerConversation(serverConversationId: string): Promise<void> {
  const res = await apiClient.delete(
    `/api/standalone/conversations/${serverConversationId}`,
    { auth: true }
  );
  if (!res.ok) {
    throw new Error('server_conversation_delete_failed');
  }
}

export type LegacyMigrationStatus =
  | 'migrated'
  | 'already_server_authoritative'
  | 'tombstoned'
  | 'rejected_invalid'
  | 'empty_transcript'
  | 'failed_retryable';

export type LegacyMigrationMessagePayload = {
  clientMessageId?: string;
  role: 'user' | 'assistant';
  content: string;
  ordinal: number;
  createdAt?: string;
};

export type LegacyMigrationConversationPayload = {
  clientConversationId: string;
  title?: string;
  titlePinned?: boolean;
  pinned?: boolean;
  conversationType?: string;
  parentClientConversationId?: string;
  sourceYansiSlug?: string;
  groupId?: string;
  treeMetadata?: Record<string, unknown>;
  conversationSceneUrl?: string;
  conversationSceneSource?: string;
  conversationSceneSlug?: string;
  messages: LegacyMigrationMessagePayload[];
};

export type LegacyMigrationConversationResult = {
  clientConversationId: string;
  status: LegacyMigrationStatus;
  serverConversationId?: string | null;
  reason?: string | null;
  messageCount?: number | null;
};

export type LegacyMigrationResponse = {
  results: LegacyMigrationConversationResult[];
};

export async function migrateLegacyServerConversations(
  conversations: LegacyMigrationConversationPayload[]
): Promise<LegacyMigrationResponse> {
  const res = await apiClient.post<LegacyMigrationResponse>(
    '/api/standalone/conversations/migrate-legacy',
    { body: { conversations }, auth: true }
  );
  if (!res.ok || !res.data?.results) {
    throw new Error('server_legacy_migration_failed');
  }
  return res.data;
}
