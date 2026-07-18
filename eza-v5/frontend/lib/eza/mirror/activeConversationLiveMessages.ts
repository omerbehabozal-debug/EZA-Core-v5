/**
 * In-memory live chat messages for Mirror build input.
 * ChatInner publishes; ObservationExperience merges with archive.
 * Does not change chat persistence / autosave behavior.
 */

export type LiveConversationMessage = {
  id: string;
  text: string;
  isUser: boolean;
};

const liveByChatId = new Map<string, readonly LiveConversationMessage[]>();

export function setActiveConversationLiveMessages(
  chatId: string | null | undefined,
  messages: readonly LiveConversationMessage[]
): void {
  if (!chatId) return;
  liveByChatId.set(
    chatId,
    messages.map((m) => ({
      id: m.id,
      text: m.text,
      isUser: Boolean(m.isUser),
    }))
  );
}

export function clearActiveConversationLiveMessages(
  chatId?: string | null
): void {
  if (chatId) {
    liveByChatId.delete(chatId);
    return;
  }
  liveByChatId.clear();
}

export function getActiveConversationLiveMessages(
  chatId: string
): readonly LiveConversationMessage[] {
  return liveByChatId.get(chatId) ?? [];
}
