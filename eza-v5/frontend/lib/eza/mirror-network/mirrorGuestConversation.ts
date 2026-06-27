/**
 * Stage 2B slice 2 — guest conversation from public mirror sohbet session.
 * Uses only public session fields + user message; no private mirror payload.
 */

import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import {
  summarizeArchiveTitle,
  type ArchivedChat,
  type ArchivedChatMessage,
  type MirrorConversationOrigin,
} from '@/lib/standaloneChatArchive';

const CHATS_UPDATED_EVENT = 'eza-standalone-archive-updated';
const STORAGE_KEY = 'eza_standalone_chat_archive';
const ACTIVE_CHAT_ID_KEY = 'eza_standalone_active_chat_id';
const MAX_CHATS = 30;

const FORBIDDEN_MIRROR_ORIGIN_KEYS = [
  'userId',
  'conversationId',
  'mirrorBody',
  'topicSummary',
  'private_payload',
  'coreCuriosity',
  'behavioralSnapshot',
  'intelligenceBrief',
] as const;

export type StartMirrorGuestChatInput = {
  session: MirrorSohbetSession;
  firstUserMessage: string;
};

export type StartMirrorGuestChatResult = {
  chatId: string;
  mirrorOrigin: MirrorConversationOrigin;
};

function readAllRaw(): ArchivedChat[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: ArchivedChat[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...list].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted.slice(0, MAX_CHATS)));
    window.dispatchEvent(new CustomEvent(CHATS_UPDATED_EVENT));
  } catch {
    /* quota */
  }
}

function buildMirrorOrigin(session: MirrorSohbetSession): MirrorConversationOrigin {
  return {
    startedFromMirrorId: session.mirrorSlug,
    parentMirrorId: session.parentMirrorId,
    rootMirrorId: session.rootMirrorId,
    seedTopic: session.seedTopic,
    seedCategory: session.seedCategory,
    seedMood: session.seedMood,
    isGuestSession: true,
    autoReplyPending: true,
  };
}

function buildOpeningMessage(session: MirrorSohbetSession): ArchivedChatMessage {
  const now = new Date().toISOString();
  return {
    id: `mirror-open-${Date.now()}`,
    text: session.openingMessage,
    isUser: false,
    timestamp: now,
  };
}

/**
 * Creates a guest standalone chat with mirror opening + pending first user message.
 * User message is delivered via standalone auto-reply (not textarea prefill).
 */
export function startMirrorGuestChat(
  input: StartMirrorGuestChatInput
): StartMirrorGuestChatResult | null {
  if (typeof window === 'undefined') return null;

  const text = input.firstUserMessage.trim();
  if (!text) return null;

  const { session } = input;
  const chatId = `chat-mirror-${Date.now()}`;
  const mirrorOrigin = buildMirrorOrigin(session);
  mirrorOrigin.pendingUserMessage = text;

  const messages: ArchivedChatMessage[] = [buildOpeningMessage(session)];

  const entry: ArchivedChat = {
    id: chatId,
    title: summarizeArchiveTitle(text) || session.cardTitle,
    preview: text.slice(0, 80),
    savedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
    mirrorOrigin,
  };

  writeAll([entry, ...readAllRaw()]);
  try {
    localStorage.setItem(ACTIVE_CHAT_ID_KEY, chatId);
  } catch {
    /* ignore */
  }

  return { chatId, mirrorOrigin };
}

/** QA helper — ensure mirror origin JSON has no private leakage keys. */
export function mirrorOriginHasPrivateLeak(origin: MirrorConversationOrigin): boolean {
  const json = JSON.stringify(origin).toLowerCase();
  return FORBIDDEN_MIRROR_ORIGIN_KEYS.some((key) => json.includes(key.toLowerCase()));
}

export const MIRROR_GUEST_CHAT_REPLY_PARAM = 'mirrorReply';
