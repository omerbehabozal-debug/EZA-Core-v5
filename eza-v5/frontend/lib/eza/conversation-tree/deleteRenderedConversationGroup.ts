import { deleteConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import type { ConversationTreeGroupDeleteRequest } from '@/lib/eza/conversation-tree/types';
import {
  deleteAuthenticatedConversationGroup,
  isServerAuthorityConversationGroup,
} from '@/lib/eza/serverConversationGroupStore';

export type RenderedGroupDeleteAuthority =
  | 'blocked_non_empty'
  | 'local'
  | 'server'
  | 'unknown';

export type RenderedGroupDeleteResult =
  | 'blocked_non_empty'
  | 'deleted_local'
  | 'deleted_server';

export function resolveRenderedGroupDeleteAuthority(
  group: ConversationTreeGroupDeleteRequest
): RenderedGroupDeleteAuthority {
  if (group.conversationCount !== 0) return 'blocked_non_empty';
  if (isServerAuthorityConversationGroup(group.id)) return 'server';
  if (group.id.startsWith('group-')) return 'local';
  return 'unknown';
}

export async function deleteRenderedConversationGroup(
  group: ConversationTreeGroupDeleteRequest
): Promise<RenderedGroupDeleteResult> {
  const authority = resolveRenderedGroupDeleteAuthority(group);
  if (authority === 'blocked_non_empty') return 'blocked_non_empty';
  if (authority === 'server') {
    await deleteAuthenticatedConversationGroup(group.id);
    return 'deleted_server';
  }
  if (authority === 'unknown') {
    throw new Error('conversation_group_delete_authority_unknown');
  }
  deleteConversationGroup(group.id);
  return 'deleted_local';
}
