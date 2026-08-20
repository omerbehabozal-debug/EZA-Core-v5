import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConversationGroup,
  listConversationGroups,
  replaceConversationGroupsForScope,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { mergeGuestConversationTree } from '@/lib/eza/conversation-tree/mergeGuestConversationTree';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import {
  createStandaloneChat,
  readChatArchives,
  replaceChatArchivesForScope,
  upsertChatArchive,
} from '@/lib/standaloneChatArchive';
import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';
import { guestScope, userScope } from '@/lib/eza/localIdentityScope';
import { claimGuestConversationGroups } from '@/lib/eza/conversation-tree/claimGuestConversationGroups';

vi.mock('@/lib/eza/conversation-tree/claimGuestConversationGroups', () => ({
  claimGuestConversationGroups: vi.fn().mockResolvedValue({ claimed: [], merged: 0 }),
}));

const GUEST_TOKEN = 'guest-merge-token-abcdefghijklmnop';
const USER_ID = 'user-abc-123';

function asGuest(): void {
  localStorage.removeItem('eza_token');
  localStorage.removeItem('eza_user');
  localStorage.setItem(MIRROR_GUEST_TOKEN_KEY, GUEST_TOKEN);
}

function asUser(): void {
  localStorage.setItem('eza_token', 'jwt-test');
  localStorage.setItem(
    'eza_user',
    JSON.stringify({ user_id: USER_ID, email: 'a@example.com', role: 'proxy_user' })
  );
}

describe('mergeGuestConversationTree', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    asGuest();
  });

  it('binds guest groups and chats to user without duplicate headings', async () => {
    const japanGuest = createConversationGroup({
      title: 'Japonya',
      source: 'mirror',
      guestToken: GUEST_TOKEN,
    });
    const mirrorChatId = createStandaloneChat({
      groupId: japanGuest.id,
      title: 'Sokak Lambaları',
      treeMetadata: {
        groupId: japanGuest.id,
        sourceType: 'mirror',
        startedFromMirrorId: 'sokak-lambalari',
        rootMirrorId: 'sokak-lambalari',
        isGuestSession: true,
      },
    });
    const branchChatId = createStandaloneChat({
      groupId: japanGuest.id,
      title: 'Yerel kafeler',
      treeMetadata: {
        groupId: japanGuest.id,
        sourceType: 'mirror_branch',
        branchFromConversationId: mirrorChatId,
        startedFromMirrorId: 'sokak-lambalari',
        rootMirrorId: 'sokak-lambalari',
        isGuestSession: true,
      },
    });

    const result = await mergeGuestConversationTree({
      userId: USER_ID,
      guestToken: GUEST_TOKEN,
      authToken: 'jwt-test',
    });

    expect(result.merged).toBe(true);
    expect(result.groupsClaimed).toBe(1);

    asUser();
    const groups = listConversationGroups();
    expect(groups.filter((g) => g.title === 'Japonya')).toHaveLength(1);
    expect(groups.find((g) => g.title === 'Japonya')?.userId).toBe(USER_ID);

    const chats = readChatArchives();
    const mirrorChat = chats.find((c) => c.id === mirrorChatId);
    const branchChat = chats.find((c) => c.id === branchChatId);
    expect(mirrorChat?.treeMetadata?.isGuestSession).toBe(false);
    expect(branchChat?.treeMetadata?.isGuestSession).toBe(false);
    expect(mirrorChat?.groupId).toBe(japanGuest.id);
    expect(branchChat?.groupId).toBe(japanGuest.id);

    const tree = buildConversationTree(
      chats.map((c) => ({
        id: c.id,
        title: c.title,
        preview: c.preview,
        savedAt: c.savedAt,
        messageCount: c.messageCount,
        groupId: c.groupId,
        isMirrorSource: c.treeMetadata?.sourceType === 'mirror',
      })),
      groups
    );
    const japanNode = tree.find((g) => g.title === 'Japonya');
    expect(japanNode?.conversations).toHaveLength(2);
  });

  it('merges into existing user group when title matches (no duplicate Japonya)', async () => {
    asUser();
    const userJapan = createConversationGroup({
      title: 'Japonya',
      source: 'manual',
      userId: USER_ID,
    });

    asGuest();
    const guestJapan = createConversationGroup({
      title: 'Japonya',
      source: 'mirror',
      guestToken: GUEST_TOKEN,
    });
    const guestChatId = createStandaloneChat({
      groupId: guestJapan.id,
      title: 'Sokak Lambaları',
      treeMetadata: {
        groupId: guestJapan.id,
        sourceType: 'mirror',
        isGuestSession: true,
      },
    });

    const result = await mergeGuestConversationTree({
      userId: USER_ID,
      guestToken: GUEST_TOKEN,
    });

    expect(result.merged).toBe(true);
    expect(result.groupIdRemap[guestJapan.id]).toBe(userJapan.id);

    asUser();
    const groups = listConversationGroups();
    expect(groups.filter((g) => g.title.toLowerCase() === 'japonya')).toHaveLength(1);
    expect(groups.some((g) => g.id === guestJapan.id)).toBe(false);

    const chat = readChatArchives().find((c) => c.id === guestChatId);
    expect(chat?.groupId).toBe(userJapan.id);
  });

  it('is idempotent on second login merge', async () => {
    createConversationGroup({
      title: 'Japonya',
      source: 'mirror',
      guestToken: GUEST_TOKEN,
    });

    const first = await mergeGuestConversationTree({
      userId: USER_ID,
      guestToken: GUEST_TOKEN,
    });
    const second = await mergeGuestConversationTree({
      userId: USER_ID,
      guestToken: GUEST_TOKEN,
    });

    expect(first.merged).toBe(true);
    expect(second.merged).toBe(false);

    asUser();
    expect(listConversationGroups().filter((g) => g.title === 'Japonya')).toHaveLength(1);
  });

  it('preserves lineageProofToken when binding guest chat from mirrorOrigin', async () => {
    const group = createConversationGroup({
      title: 'Japonya',
      guestToken: GUEST_TOKEN,
    });
    upsertChatArchive({
      id: 'chat-lineage',
      title: 'Sokak Lambaları',
      preview: 'Kyoto',
      savedAt: new Date().toISOString(),
      messageCount: 2,
      messages: [
        { id: 'm1', text: 'Merhaba', isUser: false },
        { id: 'm2', text: 'Devam', isUser: true },
      ],
      groupId: group.id,
      mirrorOrigin: {
        startedFromMirrorId: 'slug-1',
        parentMirrorId: 'slug-1',
        rootMirrorId: 'slug-1',
        seedTopic: 'Sokak Lambaları',
        seedCategory: 'travel',
        seedMood: 'discovery',
        lineageProofToken: 'proof-token-uuid-abc',
        isGuestSession: true,
      },
    });

    await mergeGuestConversationTree({ userId: USER_ID, guestToken: GUEST_TOKEN });

    asUser();
    const chat = readChatArchives().find((c) => c.id === 'chat-lineage');
    expect(chat?.mirrorOrigin).toBeUndefined();
    expect(chat?.treeMetadata?.lineageProofToken).toBe('proof-token-uuid-abc');
    expect(chat?.treeMetadata?.startedFromMirrorId).toBe('slug-1');
    expect(chat?.messages).toHaveLength(2);
  });

  it('does not claim when local guest state is empty (no reopen churn)', async () => {
    const result = await mergeGuestConversationTree({
      userId: USER_ID,
      guestToken: GUEST_TOKEN,
      authToken: 'jwt-test',
      rotateGuestTokenAfterClaim: false,
    });
    expect(result.claimAttempted).toBe(false);
    expect(result.hadPendingGuestWork).toBe(false);
    expect(claimGuestConversationGroups).not.toHaveBeenCalled();
  });

  it('does not leak private mirror fields when binding guest chat', async () => {
    const group = createConversationGroup({
      title: 'Japonya',
      guestToken: GUEST_TOKEN,
    });
    upsertChatArchive({
      id: 'chat-private-check',
      title: 'Sokak Lambaları',
      preview: 'Kyoto',
      savedAt: new Date().toISOString(),
      messageCount: 1,
      messages: [{ id: 'm1', text: 'Kyoto', isUser: true }],
      groupId: group.id,
      mirrorOrigin: {
        startedFromMirrorId: 'slug-1',
        parentMirrorId: 'slug-1',
        rootMirrorId: 'slug-1',
        seedTopic: 'Sokak Lambaları',
        seedCategory: 'travel',
        seedMood: 'discovery',
        isGuestSession: true,
      },
      treeMetadata: {
        groupId: group.id,
        sourceType: 'mirror',
        isGuestSession: true,
      },
    });

    await mergeGuestConversationTree({ userId: USER_ID, guestToken: GUEST_TOKEN });

    asUser();
    const serialized = JSON.stringify(readChatArchives().find((c) => c.id === 'chat-private-check'));
    expect(serialized).not.toContain('mirrorBody');
    expect(serialized).not.toContain('private_payload');
    expect(serialized).not.toContain('coreCuriosity');
  });

  it('keeps user-scoped data when writing into empty guest scopes', () => {
    asUser();
    replaceConversationGroupsForScope(userScope(USER_ID), [
      {
        id: 'g-user',
        title: 'Keep',
        userId: USER_ID,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    replaceChatArchivesForScope(userScope(USER_ID), [
      {
        id: 'c-user',
        title: 'Keep chat',
        preview: '',
        savedAt: new Date().toISOString(),
        messageCount: 0,
        messages: [],
      },
    ]);
    asGuest();
    expect(listConversationGroups()).toHaveLength(0);
    expect(readChatArchives()).toHaveLength(0);
    asUser();
    expect(listConversationGroups()).toHaveLength(1);
    expect(readChatArchives()).toHaveLength(1);
    expect(guestScope(GUEST_TOKEN).kind).toBe('guest');
  });
});
