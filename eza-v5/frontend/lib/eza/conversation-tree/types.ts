/**
 * Conversation Tree — shared types (internal names; UI never says "seed" or "branch").
 */

export type ConversationGroupSource = 'manual' | 'inferred' | 'mirror' | 'imported';

export type ConversationGroup = {
  id: string;
  userId: string | null;
  guestToken?: string | null;
  title: string;
  source: ConversationGroupSource;
  parentGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number;
};

export type ConversationSourceType = 'direct' | 'mirror' | 'mirror_branch';

export type ConversationTreeMetadata = {
  groupId?: string | null;
  sourceType: ConversationSourceType;
  startedFromMirrorId?: string | null;
  parentMirrorId?: string | null;
  rootMirrorId?: string | null;
  parentConversationId?: string | null;
  branchFromConversationId?: string | null;
  branchTitle?: string | null;
  seedTopic?: string | null;
  seedCategory?: string | null;
  seedMood?: string | null;
  isGuestSession?: boolean;
  /** Editorial thought-card labels for inactivity branch suggestions. */
  branchCandidates?: string[];
};

export type ConversationTreeGroupNode = {
  id: string;
  title: string;
  updatedAt: string;
  sortOrder: number;
  conversations: ConversationTreeChatItem[];
};

export type ConversationTreeChatItem = {
  id: string;
  title: string;
  preview: string;
  time: string;
  thumbGradient: string;
  savedAt: string;
  isMirrorSource: boolean;
};

export const UNGROUPED_CONVERSATION_GROUP_ID = '__ungrouped__';
