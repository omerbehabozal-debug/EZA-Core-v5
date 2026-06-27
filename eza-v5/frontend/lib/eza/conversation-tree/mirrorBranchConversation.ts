/**
 * Start a new mirror-branch conversation under the same group.
 */

import { buildBranchSuggestionCards } from '@/lib/eza/conversation-tree/buildBranchSuggestionCards';
import type { ConversationTreeMetadata } from '@/lib/eza/conversation-tree/types';
import {
  trackBranchConversationCreated,
} from '@/lib/eza/conversation-tree/conversationTreeAnalytics';
import {
  type ArchivedChat,
  type ArchivedChatMessage,
  summarizeArchiveTitle,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';

export type StartMirrorBranchConversationInput = {
  parentChat: ArchivedChat;
  branchTitle: string;
};

export type StartMirrorBranchConversationResult = {
  chatId: string;
  openingMessage: string;
};

function resolveParentMetadata(chat: ArchivedChat): ConversationTreeMetadata | null {
  if (chat.treeMetadata) return chat.treeMetadata;
  if (!chat.mirrorOrigin) return null;
  const o = chat.mirrorOrigin;
  return {
    groupId: chat.groupId ?? null,
    sourceType: 'mirror',
    startedFromMirrorId: o.startedFromMirrorId,
    parentMirrorId: o.parentMirrorId,
    rootMirrorId: o.rootMirrorId,
    seedTopic: o.seedTopic,
    seedCategory: o.seedCategory,
    seedMood: o.seedMood,
    isGuestSession: o.isGuestSession,
  };
}

export function buildBranchOpeningMessage(branchTitle: string): string {
  return `Bu yolculuk "${branchTitle}" kolundan devam ediyor.\n\nİstersen buradan başlayalım.`;
}

export function startMirrorBranchConversation(
  input: StartMirrorBranchConversationInput
): StartMirrorBranchConversationResult | null {
  if (typeof window === 'undefined') return null;

  const branchTitle = input.branchTitle.trim();
  if (!branchTitle) return null;

  const parent = input.parentChat;
  const parentMeta = resolveParentMetadata(parent);
  if (!parentMeta?.groupId) return null;

  const chatId = `chat-branch-${Date.now()}`;
  const openingMessage = buildBranchOpeningMessage(branchTitle);
  const pendingUserMessage = `${branchTitle} hakkında bilgi almak istiyorum.`;

  const treeMetadata: ConversationTreeMetadata = {
    ...parentMeta,
    groupId: parentMeta.groupId,
    sourceType: 'mirror_branch',
    parentConversationId: parent.id,
    branchFromConversationId: parent.id,
    branchTitle,
    seedTopic: branchTitle,
    startedFromMirrorId: parentMeta.startedFromMirrorId,
    parentMirrorId: parentMeta.startedFromMirrorId ?? parentMeta.parentMirrorId,
    rootMirrorId: parentMeta.rootMirrorId,
  };

  const messages: ArchivedChatMessage[] = [
    {
      id: `mirror-branch-open-${Date.now()}`,
      text: openingMessage,
      isUser: false,
      timestamp: new Date().toISOString(),
    },
  ];

  const entry: ArchivedChat = {
    id: chatId,
    title: summarizeArchiveTitle(branchTitle) || branchTitle,
    preview: branchTitle.slice(0, 80),
    savedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
    groupId: parentMeta.groupId,
    treeMetadata,
    mirrorOrigin: parent.mirrorOrigin
      ? {
          ...parent.mirrorOrigin,
          autoReplyPending: true,
          pendingUserMessage,
        }
      : undefined,
  };

  upsertChatArchive(entry);
  trackBranchConversationCreated(parent.id, chatId);

  return { chatId, openingMessage };
}

export function resolveBranchCardsForChat(chat: ArchivedChat | null): string[] {
  if (!chat) return buildBranchSuggestionCards({});
  const meta = chat.treeMetadata;
  return buildBranchSuggestionCards({
    thoughtCards: meta?.branchCandidates,
    seedQuestions: meta?.branchCandidates,
  });
}
