import type { ConversationSourceType } from '@/lib/eza/conversation-tree/types';

export const BRANCH_SUGGESTION_INACTIVITY_MS = 5 * 60 * 1000;

export type BranchSuggestionGateInput = {
  sourceType?: ConversationSourceType;
  assistantIsDone: boolean;
  isLoading: boolean;
  isTyping: boolean;
  isComposerFocused?: boolean;
  lastUserMessageAt?: number | null;
  now?: number;
  dismissed: boolean;
  shownInSession: boolean;
  isActiveConversation: boolean;
};

export function shouldShowBranchSuggestion(input: BranchSuggestionGateInput): boolean {
  if (input.sourceType !== 'mirror') return false;
  if (!input.isActiveConversation) return false;
  if (!input.assistantIsDone) return false;
  if (input.isLoading || input.isTyping) return false;
  if (input.isComposerFocused) return false;
  if (input.dismissed || input.shownInSession) return false;
  if (!input.lastUserMessageAt) return false;

  const now = input.now ?? Date.now();
  return now - input.lastUserMessageAt >= BRANCH_SUGGESTION_INACTIVITY_MS;
}
