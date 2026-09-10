/**
 * Active conversation delete detection — React id, URL param, or persisted active id.
 */

export function isConversationActiveForDelete(input: {
  targetId: string;
  chatId?: string | null;
  chatIdFromUrl?: string | null;
  activeChatId?: string | null;
}): boolean {
  const id = (input.targetId || '').trim();
  if (!id) return false;
  return (
    (input.chatId || '').trim() === id ||
    (input.chatIdFromUrl || '').trim() === id ||
    (input.activeChatId || '').trim() === id
  );
}
