/**
 * Bind guest conversation tree to authenticated user on login/register.
 * Preserves group headings, chat IDs, chat bodies, and mirror lineage proof.
 *
 * Phase 8.3.1: rebind between identity-scoped localStorage buckets.
 */

import {
  listConversationGroupsForScope,
  replaceConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { claimGuestConversationGroups } from '@/lib/eza/conversation-tree/claimGuestConversationGroups';
import { migrateGuestEzaPrefsToUser } from '@/lib/eza/conversation-tree/migrateGuestEzaPrefs';
import { migrateGuestJourneyStateToUser } from '@/lib/eza/mirror/journey/migrateGuestJourneyState';
import { rotateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import {
  clearPendingGuestClaim,
  guestScope,
  readPendingGuestClaim,
  userScope,
  writePendingGuestClaim,
} from '@/lib/eza/localIdentityScope';
import {
  readActiveChatIdForScope,
  readChatArchivesForScope,
  replaceChatArchivesForScope,
  writeActiveChatIdForScope,
  type ArchivedChat,
} from '@/lib/standaloneChatArchive';

export type MergeGuestConversationTreeInput = {
  userId: string;
  guestToken: string;
  authToken?: string | null;
  /** When true (default), rotate guest token after successful claim attempt. */
  rotateGuestTokenAfterClaim?: boolean;
};

export type MergeGuestConversationTreeResult = {
  merged: boolean;
  groupsClaimed: number;
  chatsUpdated: number;
  groupIdRemap: Record<string, string>;
  claimAttempted: boolean;
  claimOk: boolean;
  guestTokenRotated: boolean;
  /** True when local guest work existed or pending claim marker matched. */
  hadPendingGuestWork: boolean;
};

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase('tr');
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

  const lineageProofToken =
    next.treeMetadata?.lineageProofToken ?? next.mirrorOrigin?.lineageProofToken ?? null;

  const treeMetadata = next.treeMetadata
    ? {
        ...next.treeMetadata,
        isGuestSession: false,
        ...(lineageProofToken ? { lineageProofToken } : {}),
      }
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
          lineageProofToken,
          isGuestSession: false,
        }
      : undefined;

  const { mirrorOrigin: _mirrorOrigin, ...withoutMirrorOrigin } = next;

  return {
    ...withoutMirrorOrigin,
    ...(treeMetadata ? { treeMetadata } : {}),
  };
}

function chatIdSet(chats: ArchivedChat[]): Set<string> {
  return new Set(chats.map((c) => c.id));
}

/**
 * Idempotent: guest groups/chats move into user:{userId} scope.
 * Server claim runs only when local guest work or a pending-claim marker exists.
 */
export async function mergeGuestConversationTree(
  input: MergeGuestConversationTreeInput
): Promise<MergeGuestConversationTreeResult> {
  const empty: MergeGuestConversationTreeResult = {
    merged: false,
    groupsClaimed: 0,
    chatsUpdated: 0,
    groupIdRemap: {},
    claimAttempted: false,
    claimOk: false,
    guestTokenRotated: false,
    hadPendingGuestWork: false,
  };

  if (typeof window === 'undefined') return empty;

  const userId = input.userId?.trim();
  const guestToken = input.guestToken?.trim();
  if (!userId || !guestToken) return empty;

  const gScope = guestScope(guestToken);
  const uScope = userScope(userId);

  const guestGroups = listConversationGroupsForScope(gScope);
  const userGroups = listConversationGroupsForScope(uScope);
  const guestChats = readChatArchivesForScope(gScope);
  const userChats = readChatArchivesForScope(uScope);
  const guestActiveId = readActiveChatIdForScope(gScope);

  const pending = readPendingGuestClaim();
  const pendingMatches =
    Boolean(pending) &&
    pending!.guestToken === guestToken &&
    pending!.userId === userId;

  // Phase 8.7 — rebind guest Journey/Ayna drafts before token rotate (same-device).
  migrateGuestJourneyStateToUser({ guestToken, userId });

  const claimableGuestGroups = guestGroups;
  const hasGuestChats = guestChats.length > 0;
  const hasGuestGroups = guestGroups.length > 0;
  const hadPendingGuestWork = hasGuestChats || hasGuestGroups || pendingMatches;

  if (!hadPendingGuestWork) {
    return empty;
  }

  const groupIdRemap: Record<string, string> = {};
  const groupsToRemove = new Set<string>();
  let groupsClaimed = 0;

  for (const guestGroup of claimableGuestGroups) {
    const existingUserGroup = userGroups.find(
      (g) => normalizeTitle(g.title) === normalizeTitle(guestGroup.title)
    );
    if (existingUserGroup) {
      groupIdRemap[guestGroup.id] = existingUserGroup.id;
      groupsToRemove.add(guestGroup.id);
    } else {
      groupsClaimed += 1;
    }
  }

  const reboundGuestGroups = claimableGuestGroups
    .filter((g) => !groupsToRemove.has(g.id))
    .map((g) => ({ ...g, userId, guestToken: null }));

  const mergedGroups = [
    ...userGroups,
    ...reboundGuestGroups.filter((g) => !userGroups.some((u) => u.id === g.id)),
  ];

  let chatsUpdated = 0;
  const userIds = chatIdSet(userChats);
  const reboundGuestChats = guestChats.map((chat) => {
    const bound = bindGuestChat(chat, groupIdRemap);
    if (bound !== chat || !userIds.has(chat.id)) chatsUpdated += 1;
    return bound;
  });

  // Additive + idempotent: keep existing user chats; add guest chats not already present.
  const mergedChats = [
    ...userChats,
    ...reboundGuestChats.filter((c) => !userIds.has(c.id)),
  ].map((chat) => {
    // Remap group ids on already-present user chats if needed (rare).
    if (!userIds.has(chat.id)) return chat;
    const remapped = bindGuestChat(chat, groupIdRemap);
    return remapped;
  });

  // For chats that existed only in guest and collide by id with user — keep user copy (no dup).
  replaceConversationGroupsForScope(uScope, mergedGroups);
  replaceChatArchivesForScope(uScope, mergedChats);

  // Clear guest scope so a future guest identity cannot see prior work.
  replaceConversationGroupsForScope(gScope, []);
  replaceChatArchivesForScope(gScope, []);
  writeActiveChatIdForScope(gScope, null);

  if (guestActiveId && mergedChats.some((c) => c.id === guestActiveId)) {
    const existingUserActive = readActiveChatIdForScope(uScope);
    if (!existingUserActive) {
      writeActiveChatIdForScope(uScope, guestActiveId);
    }
  }

  migrateGuestEzaPrefsToUser(userId);

  let claimAttempted = false;
  let claimOk = false;
  if (input.authToken && hadPendingGuestWork) {
    claimAttempted = true;
    try {
      await claimGuestConversationGroups(guestToken);
      claimOk = true;
      clearPendingGuestClaim();
    } catch {
      claimOk = false;
      writePendingGuestClaim({ guestToken, userId });
    }
  }

  let guestTokenRotated = false;
  const shouldRotate = input.rotateGuestTokenAfterClaim !== false;
  if (shouldRotate && claimOk) {
    rotateMirrorGuestToken();
    guestTokenRotated = true;
  }

  return {
    merged: true,
    groupsClaimed,
    chatsUpdated,
    groupIdRemap,
    claimAttempted,
    claimOk,
    guestTokenRotated,
    hadPendingGuestWork,
  };
}
