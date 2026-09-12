/**
 * Authenticated New Chat group/title picker — INTENT-DRIVEN visibility.
 *
 * Product invariant: the picker opens only from an explicit "Yeni Sohbet"
 * (or equivalent leave→new) intent. Missing groupId / chatId / title,
 * first-message persistence, hydration, or archive refresh must never reopen it.
 *
 * Intent is durable in sessionStorage so a remount while still on `?new=1`
 * after group/title selection cannot reopen the picker.
 */

export const NEW_CHAT_PICKER_INTENT_STORAGE_KEY =
  'saina.authenticatedNewChatPicker.intent';

export const NEW_CHAT_DRAFT_GROUP_STORAGE_KEY =
  'saina.authenticatedNewChatPicker.draftGroupId';

export type StoredNewChatPickerIntent = 'pending' | 'consumed';

export type NewChatPickerUrlEffectInput = {
  isNewChatRequest: boolean;
  /** True when chatId is set or messages already exist on the canvas. */
  hasLiveConversation: boolean;
  /** One-shot intent from beginAuthenticatedNewChatPickerIntent(). */
  hasPendingNewChatIntent: boolean;
};

/**
 * Soft-nav `?new=1` may clear a leftover live canvas only while a new-chat
 * intent is still pending. After the user chooses a group (intent consumed),
 * the first message may briefly keep `?new=1` while chatId exists — that must
 * NOT wipe the chat or reopen the picker.
 */
export function shouldClearLiveConversationOnNewChatUrl(
  input: NewChatPickerUrlEffectInput
): boolean {
  return (
    input.isNewChatRequest &&
    input.hasLiveConversation &&
    input.hasPendingNewChatIntent
  );
}

/** Guests never see the title/group prompt. */
export function shouldAllowNewChatGroupPicker(isServerBacked: boolean): boolean {
  return isServerBacked;
}

export function readStoredNewChatPickerIntent(): StoredNewChatPickerIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(NEW_CHAT_PICKER_INTENT_STORAGE_KEY);
    if (value === 'pending' || value === 'consumed') return value;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

export function writeStoredNewChatPickerIntent(
  state: StoredNewChatPickerIntent | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (state == null) {
      window.sessionStorage.removeItem(NEW_CHAT_PICKER_INTENT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(NEW_CHAT_PICKER_INTENT_STORAGE_KEY, state);
  } catch {
    // ignore
  }
}

export function readStoredNewChatDraftGroupId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(NEW_CHAT_DRAFT_GROUP_STORAGE_KEY);
    if (value == null || value === '') return null;
    return value;
  } catch {
    return null;
  }
}

export function writeStoredNewChatDraftGroupId(groupId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (groupId == null || groupId === '') {
      window.sessionStorage.removeItem(NEW_CHAT_DRAFT_GROUP_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(NEW_CHAT_DRAFT_GROUP_STORAGE_KEY, groupId);
  } catch {
    // ignore
  }
}

/**
 * Cold/remount on `?new=1`: open picker only when intent is not already consumed.
 * Discover/Pattern navigate with only `?new=1` (no prior begin) → treat as pending.
 */
export function shouldOpenPickerOnNewChatMount(options: {
  isServerBacked: boolean;
  storedIntent: StoredNewChatPickerIntent | null;
}): boolean {
  if (!shouldAllowNewChatGroupPicker(options.isServerBacked)) return false;
  return options.storedIntent !== 'consumed';
}
