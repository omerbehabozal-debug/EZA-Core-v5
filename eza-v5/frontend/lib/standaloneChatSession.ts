import type { ArchivedChatMessage } from './standaloneChatArchive';
import type { BehavioralSnapshot } from '@/lib/types';

export interface StandaloneChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  behavioral?: BehavioralSnapshot | null;
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
    behavioral: m.behavioral ?? undefined,
    safety: m.safety,
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
    behavioral: m.behavioral ?? undefined,
    safety: m.safety,
    // ChatBubble shows SafetyBadge when safeOnlyMode — restore from durable safety.
    safeOnlyMode: Boolean(m.safety),
    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
  }));
}

/**
 * Prefer server fields; keep richer local evaluation when server metadata is absent
 * (in-flight race before persistence completes). Never invent scores.
 */
export function mergeArchivedMessageEvaluations(
  serverMessages: ArchivedChatMessage[],
  localMessages: ArchivedChatMessage[] | undefined | null
): ArchivedChatMessage[] {
  if (!localMessages?.length) return serverMessages;
  const localById = new Map(localMessages.map((m) => [m.id, m]));
  return serverMessages.map((server) => {
    const local = localById.get(server.id);
    if (!local) return server;
    const next: ArchivedChatMessage = { ...server };
    if (next.userScore == null && local.userScore != null) {
      next.userScore = local.userScore;
    }
    if (next.assistantScore == null && local.assistantScore != null) {
      next.assistantScore = local.assistantScore;
    }
    if (next.behavioral == null && local.behavioral != null) {
      next.behavioral = local.behavioral;
    }
    if (next.safety == null && local.safety != null) {
      next.safety = local.safety;
    }
    return next;
  });
}
