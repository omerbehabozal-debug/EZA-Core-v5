import type { ArchivedChatMessage } from './standaloneChatArchive';

export interface StandaloneChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp: Date;
}

function isSystemMessageId(id: string): boolean {
  return id.startsWith('saved-') || id.startsWith('limit-');
}

export function isArchivableMessage(msg: StandaloneChatMessage): boolean {
  if (isSystemMessageId(msg.id)) return false;
  if (!msg.isUser && !msg.text.trim()) return false;
  return true;
}

export function hasMeaningfulChat(messages: StandaloneChatMessage[]): boolean {
  const archivable = messages.filter(isArchivableMessage);
  return (
    archivable.some((m) => m.isUser) &&
    archivable.some((m) => !m.isUser && m.text.trim().length > 0)
  );
}

export function toArchivedMessages(messages: StandaloneChatMessage[]): ArchivedChatMessage[] {
  return messages.filter(isArchivableMessage).map((m) => ({
    id: m.id,
    text: m.text,
    isUser: m.isUser,
    userScore: m.userScore,
    assistantScore: m.assistantScore,
    timestamp: m.timestamp?.toISOString(),
  }));
}

export function fromArchivedMessages(messages: ArchivedChatMessage[]): StandaloneChatMessage[] {
  return messages.map((m) => ({
    id: m.id,
    text: m.text,
    isUser: m.isUser,
    userScore: m.userScore,
    assistantScore: m.assistantScore,
    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
  }));
}
