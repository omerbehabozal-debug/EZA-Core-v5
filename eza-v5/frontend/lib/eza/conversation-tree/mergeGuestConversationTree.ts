/**
 * Bind guest conversation tree to authenticated user on login.
 * Preserves group headings, chat IDs, and mirror lineage — no duplicate groups/chats.
 */

import {
  listConversationGroups,
  replaceConversationGroups,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { claimGuestConversationGroups } from '@/lib/eza/conversation-tree/claimGuestConversationGroups';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import {
  readChatArchives,
  replaceChatArchives,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';

export type MergeGuestConversationTreeInput = {
  userId: string;
  guestToken: string;
  authToken?: string | null;
};

export type MergeGuestConversationTreeResult = {
  merged: boolean;
  groupsClaimed: number;
  chatsUpdated: number;
  groupIdRemap: Record<string, string>;
};

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase('tr');
}

function groupBelongsToGuest(group: ConversationGroup, guestToken: string): boolean {
  if (group.userId) return false;
  if (!group.guestToken) return true;
  return group.guestToken === guestToken;
}

function isGuestChat(chat: ArchivedChat): boolean {
  return (
    chat.treeMetadata?.isGuestSession === true || chat.mirrorOrigin?.isGuestSession === true
  );
}

function bindGuestChat(chat: ArchivedChat, groupIdRemap: Record<string, string>): ArchivedChat {
  let next = chat;
  let changed = false;

  const currentGroupId = chat.groupId ?? chat.treeMetadata?.groupId ?? null;
  const remappedGroupId =
    currentGroupId && groupIdRemap[currentGroupId] ? groupIdRemap[currentGroupId] : null;

  if (remappedGroupId && remappedGroupId !== currentGroupId) {
    next = {
      ...next,
      groupId: remappedGroupId,
      treeMetadata: next.treeMetadata
        ? { ...next.treeMetadata, groupId: remappedGroupId }
        : { sourceType: 'direct', groupId: remappedGroupId },
    };
    changed = true;
  }

  if (!isGuestChat(next)) {
    return changed ? next : chat;
  }

  const treeMetadata = next.treeMetadata
    ? { ...next.treeMetadata, isGuestSession: false }
    : next.mirrorOrigin
      ? {
          groupId: next.groupId ?? null,
          sourceType: 'mirror' as const,
          startedFromMirrorId: next.mirrorOrigin.startedFromMirrorId,
          parentMirrorId: next.mirrorOrigin.parentMirrorId,
          rootMirrorId: next.mirrorOrigin.rootMirrorId,
          seedTopic: next.mirrorOrigin.seedTopic,
          seedCategory: next.mirrorOrigin.seedCategory,
          seedMood: next.mirrorOrigin.seedMood,
          isGuestSession: false,
        }
      : undefined;

  const { mirrorOrigin: _mirrorOrigin, ...withoutMirrorOrigin } = next;

  return {
    ...withoutMirrorOrigin,
    ...(treeMetadata ? { treeMetadata } : {}),
  };
}

/**
 * Idempotent: guest groups gain userId; duplicate titles merge into existing user groups.
 */
export async function mergeGuestConversationTree(
  input: MergeGuestConversationTreeInput
): Promise<MergeGuestConversationTreeResult> {
  const empty: MergeGuestConversationTreeResult = {
    merged: false,
    groupsClaimed: 0,
    chatsUpdated: 0,
    groupIdRemap: {},
  };

  if (typeof window === 'undefined') return empty;

  const userId = input.userId?.trim();
  const guestToken = input.guestToken?.trim();
  if (!userId || !guestToken) return empty;

  const groups = listConversationGroups();
  const guestGroups = groups.filter((g) => groupBelongsToGuest(g, guestToken));
  const userGroups = groups.filter((g) => g.userId === userId);
  const chats = readChatArchives();
  const hasGuestChats = chats.some(isGuestChat);

  if (guestGroups.length === 0 && !hasGuestChats) {
    return empty;
  }

  const groupIdRemap: Record<string, string> = {};
  const groupsToRemove = new Set<string>();
  let groupsClaimed = 0;

  for (const guestGroup of guestGroups) {
    const existingUserGroup = userGroups.find(
      (g) => normalizeTitle(g.title) === normalizeTitle(guestGroup.title)
    );
    if (existingUserGroup) {
      groupIdRemap[guestGroup.id] = existingUserGroup.id;
      groupsToRemove.add(guestGroup.id);
    } else if (guestGroup.userId !== userId) {
      groupsClaimed += 1;
    }
  }

  const updatedGroups = groups
    .filter((g) => !groupsToRemove.has(g.id))
    .map((g) => {
      if (g.userId === userId) return g;
      if (!groupBelongsToGuest(g, guestToken) || groupsToRemove.has(g.id)) return g;
      return { ...g, userId };
    });

  let chatsUpdated = 0;
  const updatedChats = chats.map((chat) => {
    const bound = bindGuestChat(chat, groupIdRemap);
    if (bound !== chat) chatsUpdated += 1;
    return bound;
  });

  const groupsChanged =
    groupsClaimed > 0 ||
    groupsToRemove.size > 0 ||
    updatedGroups.some((g, i) => g !== groups[i]);

  if (!groupsChanged && chatsUpdated === 0) {
    return empty;
  }

  replaceConversationGroups(updatedGroups);
  if (chatsUpdated > 0) {
    replaceChatArchives(updatedChats);
  }

  if (input.authToken) {
    try {
      await claimGuestConversationGroups(guestToken);
    } catch (error) {
      console.warn('[mergeGuestConversationTree] claim-guest failed:', error);
    }
  }

  return {
    merged: true,
    groupsClaimed,
    chatsUpdated,
    groupIdRemap,
  };
}
