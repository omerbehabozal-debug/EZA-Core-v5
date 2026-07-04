/**
 * Stage 2B slice 2 — guest conversation from public mirror sohbet session.
 * Uses only public session fields + user message; no private mirror payload.
 */

import {
  createConversationGroup,
  listConversationGroups,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { inferMirrorGroupTitle } from '@/lib/eza/conversation-tree/inferMirrorGroupTitle';
import type { ConversationTreeMetadata } from '@/lib/eza/conversation-tree/types';
import { trackConversationGroupCreated } from '@/lib/eza/conversation-tree/conversationTreeAnalytics';
import {
  markDiscoverMirrorExperienced,
} from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import { buildConversationSceneIdentityFields } from '@/lib/eza/conversationSceneIdentity';
import {
  summarizeArchiveTitle,
  type ArchivedChat,
  type ArchivedChatMessage,
  type MirrorConversationOrigin,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

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
  groupId: string;
  mirrorOrigin: MirrorConversationOrigin;
};

function resolveMirrorGroupId(session: MirrorSohbetSession): string {
  const title = inferMirrorGroupTitle(session);
  const existing = listConversationGroups().find(
    (g) => g.title.toLowerCase() === title.toLowerCase()
  );
  if (existing) return existing.id;
  const group = createConversationGroup({ title, source: 'mirror' });
  trackConversationGroupCreated(group.id);
  return group.id;
}

function buildMirrorOrigin(session: MirrorSohbetSession): MirrorConversationOrigin {
  return {
    startedFromMirrorId: session.mirrorSlug,
    parentMirrorId: session.parentMirrorId,
    rootMirrorId: session.rootMirrorId,
    seedTopic: session.seedTopic,
    seedCategory: session.seedCategory,
    seedMood: session.seedMood,
    lineageProofToken: session.lineageProofToken ?? undefined,
    isGuestSession: true,
    autoReplyPending: true,
  };
}

function buildTreeMetadata(
  session: MirrorSohbetSession,
  groupId: string
): ConversationTreeMetadata {
  return {
    groupId,
    sourceType: 'mirror',
    startedFromMirrorId: session.mirrorSlug,
    parentMirrorId: session.parentMirrorId,
    rootMirrorId: session.rootMirrorId,
    seedTopic: session.seedTopic,
    seedCategory: session.seedCategory,
    seedMood: session.seedMood,
    lineageProofToken: session.lineageProofToken ?? null,
    isGuestSession: true,
    branchCandidates: session.thoughtCards.map((card) => card.label),
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
  const groupId = resolveMirrorGroupId(session);
  const chatId = `chat-mirror-${Date.now()}`;
  const mirrorOrigin = buildMirrorOrigin(session);
  mirrorOrigin.pendingUserMessage = text;

  const messages: ArchivedChatMessage[] = [buildOpeningMessage(session)];

  const sceneIdentity = buildConversationSceneIdentityFields({
    url: session.sceneImageUrl,
    source: 'mirror_guest',
    slug: session.mirrorSlug,
  });

  const entry: ArchivedChat = {
    id: chatId,
    title: summarizeArchiveTitle(text) || session.cardTitle,
    preview: text.slice(0, 80),
    savedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
    groupId,
    treeMetadata: buildTreeMetadata(session, groupId),
    mirrorOrigin,
    ...(sceneIdentity ?? {}),
  };

  upsertChatArchive(entry);

  markDiscoverMirrorExperienced(session.rootMirrorId || session.mirrorSlug);

  return { chatId, groupId, mirrorOrigin };
}

/** QA helper — ensure mirror origin JSON has no private leakage keys. */
export function mirrorOriginHasPrivateLeak(origin: MirrorConversationOrigin): boolean {
  const json = JSON.stringify(origin).toLowerCase();
  return FORBIDDEN_MIRROR_ORIGIN_KEYS.some((key) => json.includes(key.toLowerCase()));
}

export const MIRROR_GUEST_CHAT_REPLY_PARAM = 'mirrorReply';
