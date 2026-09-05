/**
 * Phase 8.8G-5.3.2 — authenticated conversation groups API client.
 */

import { apiClient } from '@/lib/apiClient';
import type { ConversationGroupSource } from '@/lib/eza/conversation-tree/types';

export type ServerConversationGroup = {
  id: string;
  title: string;
  source: ConversationGroupSource;
  parentGroupId?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  clientGroupId?: string | null;
};

export type CreateServerConversationGroupInput = {
  title: string;
  source?: ConversationGroupSource;
  clientGroupId?: string;
  parentGroupId?: string | null;
};

export type UpdateServerConversationGroupInput = {
  title?: string;
  sortOrder?: number;
};

function assertGroupPayload(data: unknown): ServerConversationGroup {
  if (!data || typeof data !== 'object') {
    throw new Error('conversation_group_invalid_response');
  }
  const row = data as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id.trim()) {
    throw new Error('conversation_group_invalid_response');
  }
  if (typeof row.title !== 'string') {
    throw new Error('conversation_group_invalid_response');
  }
  return {
    id: row.id,
    title: row.title,
    source: (row.source as ConversationGroupSource) || 'manual',
    parentGroupId: (row.parentGroupId as string | null | undefined) ?? null,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
    clientGroupId: (row.clientGroupId as string | null | undefined) ?? null,
  };
}

export async function listServerConversationGroups(): Promise<ServerConversationGroup[]> {
  const res = await apiClient.get<ServerConversationGroup[]>('/api/conversation-groups', {
    auth: true,
  });
  if (!res.ok) {
    throw new Error('conversation_group_list_failed');
  }
  if (!Array.isArray(res.data)) {
    throw new Error('conversation_group_invalid_response');
  }
  return res.data.map((row) => assertGroupPayload(row));
}

export async function createServerConversationGroup(
  input: CreateServerConversationGroupInput
): Promise<ServerConversationGroup> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    source: input.source ?? 'manual',
  };
  if (input.clientGroupId) body.clientGroupId = input.clientGroupId;
  if (input.parentGroupId) body.parentGroupId = input.parentGroupId;

  const res = await apiClient.post<ServerConversationGroup>('/api/conversation-groups', {
    body,
    auth: true,
  });
  if (!res.ok || !res.data) {
    throw new Error('conversation_group_create_failed');
  }
  return assertGroupPayload(res.data);
}

export async function updateServerConversationGroup(
  groupId: string,
  patch: UpdateServerConversationGroupInput
): Promise<ServerConversationGroup> {
  const res = await apiClient.patch<ServerConversationGroup>(
    `/api/conversation-groups/${groupId}`,
    { body: patch, auth: true }
  );
  if (!res.ok || !res.data) {
    throw new Error('conversation_group_update_failed');
  }
  return assertGroupPayload(res.data);
}

export async function deleteServerConversationGroup(groupId: string): Promise<void> {
  const res = await apiClient.delete(`/api/conversation-groups/${groupId}`, {
    auth: true,
  });
  if (!res.ok) {
    throw new Error('conversation_group_delete_failed');
  }
}

/** Assign or ungroup via standalone conversation PATCH (G5.3.1). */
export async function assignServerConversationGroup(
  serverConversationId: string,
  groupId: string | null
): Promise<void> {
  const res = await apiClient.patch(`/api/standalone/conversations/${serverConversationId}`, {
    body: { groupId },
    auth: true,
  });
  if (!res.ok) {
    throw new Error('conversation_group_assign_failed');
  }
}
