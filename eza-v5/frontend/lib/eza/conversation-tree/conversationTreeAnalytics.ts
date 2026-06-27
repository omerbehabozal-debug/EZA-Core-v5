/**
 * Conversation tree analytics — CustomEvent pattern (mirror sohbet analytics).
 */

export const GROUP_CREATED_EVENT = 'saina:conversation-group-created';
export const CONVERSATION_IN_GROUP_EVENT = 'saina:conversation-created-in-group';

export function trackConversationGroupCreated(groupId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GROUP_CREATED_EVENT, { detail: { groupId, at: new Date().toISOString() } })
  );
  if (process.env.NODE_ENV === 'development') {
    console.info('[SAINA] conversation group created', groupId);
  }
}

export function trackConversationCreatedInGroup(conversationId: string, groupId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CONVERSATION_IN_GROUP_EVENT, {
      detail: { conversationId, groupId, at: new Date().toISOString() },
    })
  );
  if (process.env.NODE_ENV === 'development') {
    console.info('[SAINA] conversation in group', { conversationId, groupId });
  }
}
