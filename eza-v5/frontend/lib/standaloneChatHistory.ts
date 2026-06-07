/**
 * Standalone Chat — request-level history payload for LLM context.
 * Sends role + content only; no scores or behavioral metadata.
 */

import { isArchivableMessage } from './standaloneChatSession';

export interface ChatHistoryPayloadMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_HISTORY_TOTAL_CHARS = 3200;
export const MAX_MESSAGE_CHARS = 1200;

type HistorySourceMessage = {
  id: string;
  text: string;
  isUser: boolean;
};

function truncateContent(content: string, maxChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
}

function toRole(isUser: boolean): 'user' | 'assistant' {
  return isUser ? 'user' : 'assistant';
}

export function buildChatHistoryPayload(
  messages: HistorySourceMessage[],
  options?: {
    maxMessages?: number;
    maxTotalChars?: number;
    maxMessageChars?: number;
    excludeQuery?: string;
  }
): ChatHistoryPayloadMessage[] {
  const maxMessages = options?.maxMessages ?? MAX_HISTORY_MESSAGES;
  const maxTotalChars = options?.maxTotalChars ?? MAX_HISTORY_TOTAL_CHARS;
  const maxMessageChars = options?.maxMessageChars ?? MAX_MESSAGE_CHARS;
  const excludeQuery = options?.excludeQuery?.trim();

  let items: ChatHistoryPayloadMessage[] = messages
    .filter(isArchivableMessage)
    .map((m) => ({
      role: toRole(m.isUser),
      content: truncateContent(m.text, maxMessageChars),
    }));

  if (excludeQuery && items.length > 0) {
    const last = items[items.length - 1];
    if (last.role === 'user' && last.content.trim() === excludeQuery) {
      items = items.slice(0, -1);
    }
  }

  if (items.length > maxMessages) {
    items = items.slice(-maxMessages);
  }

  let totalChars = items.reduce((sum, m) => sum + m.content.length, 0);
  while (items.length > 0 && totalChars > maxTotalChars) {
    const removed = items.shift()!;
    totalChars -= removed.content.length;
  }

  return items;
}
