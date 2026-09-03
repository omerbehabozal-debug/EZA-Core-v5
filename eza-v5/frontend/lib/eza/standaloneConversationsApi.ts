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
  hasReadyYansi?: boolean;
  publishedYansiSlug?: string | null;
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

export type ServerConversationListPage = {
  items: ServerConversationListItem[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export const SERVER_CONVERSATION_PAGE_SIZE = 100;
export const SERVER_CONVERSATION_MAX_PAGES = 200;

export async function listServerConversationsPage(input?: {
  limit?: number;
  offset?: number;
}): Promise<ServerConversationListPage> {
  const limit = input?.limit ?? SERVER_CONVERSATION_PAGE_SIZE;
  const offset = input?.offset ?? 0;
  const res = await apiClient.get<ServerConversationListPage>(
    `/api/standalone/conversations?limit=${limit}&offset=${offset}`,
    { auth: true }
  );
  if (!res.ok || !res.data || !Array.isArray(res.data.items)) {
    throw new Error('server_conversation_list_failed');
  }
  return res.data;
}

/** Drain all pages. Fails closed if any page fails (no partial install). */
export async function listServerConversations(): Promise<ServerConversationListItem[]> {
  const out: ServerConversationListItem[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (let page = 0; page < SERVER_CONVERSATION_MAX_PAGES; page += 1) {
    const batch = await listServerConversationsPage({
      limit: SERVER_CONVERSATION_PAGE_SIZE,
      offset,
    });
    for (const item of batch.items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    if (!batch.hasMore || batch.items.length === 0) {
      return out;
    }
    offset += batch.limit;
  }
  throw new Error('server_conversation_list_page_cap');
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

export type ServerYansiPreparation = {
  id: string;
  conversationId: string;
  sourceIdentity: string;
  journeyId: string;
  journeyVersion: number;
  windowIndex: number;
  windowHash: string;
  selectedStepsHash: string;
  sourceBlockHash?: string | null;
  generationId: string;
  status: 'ready';
  publicTitle: string;
  publicSummary: string;
  continuationContext?: string | null;
  sceneImageUrl: string;
  sceneAssetId?: string | null;
  sceneFocalX?: number | null;
  sceneFocalY?: number | null;
  sealedLineage: Record<string, unknown>;
  sealedPublicLanding?: Record<string, unknown> | null;
  publishedSlug?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type ServerYansiPreparationUpsert = {
  journeyId: string;
  journeyVersion: number;
  windowIndex: number;
  windowHash: string;
  selectedStepsHash: string;
  sourceBlockHash?: string | null;
  generationId: string;
  publicTitle: string;
  publicSummary: string;
  continuationContext?: string | null;
  sceneImageUrl: string;
  sceneAssetId?: string | null;
  sceneFocalX?: number | null;
  sceneFocalY?: number | null;
  sealedLineage: Record<string, unknown>;
  sealedPublicLanding?: Record<string, unknown> | null;
};

export async function getServerYansiPreparations(
  serverConversationId: string
): Promise<ServerYansiPreparation[]> {
  const res = await apiClient.get<{ items: ServerYansiPreparation[] }>(
    `/api/standalone/conversations/${serverConversationId}/yansi-preparation`,
    { auth: true }
  );
  if (!res.ok || !res.data || !Array.isArray(res.data.items)) {
    throw new Error('server_yansi_preparation_get_failed');
  }
  return res.data.items;
}

export async function putServerYansiPreparation(
  serverConversationId: string,
  body: ServerYansiPreparationUpsert
): Promise<ServerYansiPreparation> {
  const res = await apiClient.put<ServerYansiPreparation>(
    `/api/standalone/conversations/${serverConversationId}/yansi-preparation`,
    { body, auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('server_yansi_preparation_put_failed');
  }
  return res.data;
}

export async function linkServerYansiPreparationPublication(
  serverConversationId: string,
  body: { slug: string; journeyId?: string; journeyVersion?: number }
): Promise<ServerYansiPreparation> {
  const res = await apiClient.post<ServerYansiPreparation>(
    `/api/standalone/conversations/${serverConversationId}/yansi-preparation/publication-link`,
    { body, auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('server_yansi_preparation_link_failed');
  }
  return res.data;
}
