/**
 * Conversation tree analytics — CustomEvent pattern (mirror sohbet analytics).
 */

import { ezaExperience } from '@/lib/eza/analytics/ezaExperienceAdapter';

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

export const BRANCH_SUGGESTION_SHOWN_EVENT = 'saina:branch-suggestion-shown';
export const BRANCH_CARD_CLICKED_EVENT = 'saina:branch-card-clicked';
export const BRANCH_CONVERSATION_CREATED_EVENT = 'saina:branch-conversation-created';
export const GUEST_TREE_CLAIMED_EVENT = 'saina:guest-tree-claimed';

export function trackBranchSuggestionShown(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BRANCH_SUGGESTION_SHOWN_EVENT, {
      detail: { conversationId, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('branch_suggestion_shown', {
    conversationId,
    context: { surface: 'conversation', source: 'branch' },
  });
}

export function trackBranchCardClicked(conversationId: string, branchTitle: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BRANCH_CARD_CLICKED_EVENT, {
      detail: { conversationId, branchTitle, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('branch_opened', {
    conversationId,
    context: { surface: 'conversation', source: 'branch' },
  });
}

export function trackBranchConversationCreated(
  parentConversationId: string,
  newConversationId: string
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BRANCH_CONVERSATION_CREATED_EVENT, {
      detail: { parentConversationId, newConversationId, at: new Date().toISOString() },
    })
  );
}

export function trackGuestTreeClaimed(claimedCount: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GUEST_TREE_CLAIMED_EVENT, {
      detail: { claimedCount, at: new Date().toISOString() },
    })
  );
  ezaExperience.track('guest_tree_claimed', {
    metrics: { claimedCount },
    context: { surface: 'conversation' },
  });
}
