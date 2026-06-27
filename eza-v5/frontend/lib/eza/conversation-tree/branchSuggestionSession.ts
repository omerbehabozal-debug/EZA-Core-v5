const SHOWN_PREFIX = 'saina_branch_suggestion_shown:';
const DISMISSED_PREFIX = 'saina_branch_suggestion_dismissed:';

export function markBranchSuggestionShown(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${SHOWN_PREFIX}${chatId}`, '1');
}

export function isBranchSuggestionShown(chatId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`${SHOWN_PREFIX}${chatId}`) === '1';
}

export function markBranchSuggestionDismissed(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${DISMISSED_PREFIX}${chatId}`, '1');
}

export function isBranchSuggestionDismissed(chatId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`${DISMISSED_PREFIX}${chatId}`) === '1';
}

export function clearBranchSuggestionSession(chatId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${SHOWN_PREFIX}${chatId}`);
  sessionStorage.removeItem(`${DISMISSED_PREFIX}${chatId}`);
}
