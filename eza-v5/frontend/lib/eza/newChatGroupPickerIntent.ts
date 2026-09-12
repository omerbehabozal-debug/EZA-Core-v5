/**
 * Authenticated New Chat group/title picker — INTENT-DRIVEN visibility.
 *
 * Product invariant: the picker opens only from an explicit "Yeni Sohbet"
 * (or equivalent leave→new) intent. Missing groupId / chatId / title,
 * first-message persistence, hydration, or archive refresh must never reopen it.
 */

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
