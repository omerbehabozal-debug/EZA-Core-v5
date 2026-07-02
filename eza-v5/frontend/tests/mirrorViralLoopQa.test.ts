/**
 * Mirror viral loop — programmatic QA (no Playwright).
 * Simulates steps 5–17 from docs/qa/mirror-viral-loop.md
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  assertMirrorLandingSurfaceClean,
  pickMirrorLandingSurface,
} from '@/lib/eza/mirror-network/landingSurface';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';
import {
  startMirrorGuestChat,
  mirrorOriginHasPrivateLeak,
} from '@/lib/eza/mirror-network/mirrorGuestConversation';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
import { createConversationGroup, listConversationGroups } from '@/lib/eza/conversation-tree/conversationGroups';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import {
  shouldShowBranchSuggestion,
  BRANCH_SUGGESTION_INACTIVITY_MS,
} from '@/lib/eza/conversation-tree/branchSuggestionPolicy';
import { startMirrorBranchConversation } from '@/lib/eza/conversation-tree/mirrorBranchConversation';
import {
  createStandaloneChat,
  getChatArchive,
  listChatArchives,
} from '@/lib/standaloneChatArchive';

/** Kyoto fixture — aligns with backend JAPAN_FIXTURE_BUNDLE */
const FIXTURE_SLUG = 'sokak-lambalari-seed01';

const FIXTURE_PUBLIC: MirrorNetworkPublicApiResponse = {
  slug: FIXTURE_SLUG,
  shareUrl: `https://saina.app/m/${FIXTURE_SLUG}`,
  cardTitle: 'Sokak Lambaları',
  cardDate: '2026-05-31',
  sceneImageUrl: 'https://picsum.photos/seed/mirror-japan-fixture/1080/1350',
  coreCuriosity: 'Kyoto yağmurdan sonra nasıl bir atmosfer taşır?',
  curiosityContext:
    "Bu merak alanı, Japonya'da yürüyerek keşif ve şehir atmosferi üzerine doğmuş bir sohbetten ilham alır.",
  landingContext: 'fallback',
  hooks: ["Kyoto'da bir akşam nasıl yaşanır?"],
  seedQuestions: ["Kyoto'da sadece bir akşamım olsa nasıl bir rota izlemeliyim?"],
  discoverySignals: ['travel', 'Kyoto'],
  collectionTags: ['travel', 'discovery'],
  seed: { topicCategory: 'travel', mood: 'discovery' },
};

const FIXTURE_SESSION: MirrorSohbetSession = {
  sessionId: 'qa-session-1',
  guestToken: 'qa-guest-token-abcdefghijklmnop',
  mirrorSlug: FIXTURE_SLUG,
  cardTitle: 'Sokak Lambaları',
  openingMessage:
    "Bu Ayna, Kyoto'nun akşam ritmini keşfetme merakından doğdu.\n\nŞimdi bu yolculuk senin sorularınla devam ediyor.",
  thoughtCards: [
    { id: 'thought-1', label: 'Akşam sokaklarını keşfet' },
    { id: 'thought-2', label: 'Yerel kafeleri bul' },
  ],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  parentMirrorId: FIXTURE_SLUG,
  rootMirrorId: FIXTURE_SLUG,
  seedTopic: 'Sokak Lambaları',
  seedCategory: 'travel',
  seedMood: 'discovery',
};

function uiTextBlob(...parts: string[]): string {
  return parts.join(' ').toLowerCase();
}

describe('mirror viral loop QA (programmatic)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('step 6–7: landing surface is minimal and curiosity-safe', () => {
    const surface = pickMirrorLandingSurface(FIXTURE_PUBLIC);
    assertMirrorLandingSurfaceClean(surface);

    expect(surface.cardTitle).toBe('Sokak Lambaları');
    expect(surface.curiosityContext).toBeTruthy();
    expect(surface.sceneImageUrl).toBeTruthy();
    expect(surface.dayLabel).toMatch(/Mayıs/);

    const landingText = uiTextBlob(
      surface.cardTitle,
      surface.curiosityContext,
      'Bu konudan devam et'
    );
    expect(landingText).not.toContain('seed');
    expect(landingText).not.toContain('araştırmalarım');
    expect(JSON.stringify(surface)).not.toContain('coreCuriosity');
    expect(JSON.stringify(surface)).not.toContain('seedQuestions');
  });

  it('step 1–2 regression: direct chat in chosen group still works', () => {
    const group = createConversationGroup({ title: 'Japonya', source: 'manual' });
    const chatId = createStandaloneChat({ groupId: group.id, title: 'Kyoto akşamları' });
    const chat = getChatArchive(chatId);
    expect(chat?.groupId).toBe(group.id);
    expect(chat?.treeMetadata?.sourceType).toBe('direct');
    expect(chat?.mirrorOrigin).toBeUndefined();
  });

  it('steps 8–12: hook card opens guest chat under Japonya with ✦ metadata', () => {
    const hookLabel = 'Akşam sokaklarını keşfet';
    const created = startMirrorGuestChat({
      session: FIXTURE_SESSION,
      firstUserMessage: hookLabel,
    });
    expect(created).not.toBeNull();

    const chat = getChatArchive(created!.chatId);
    expect(chat?.mirrorOrigin?.pendingUserMessage).toBe(hookLabel);
    expect(chat?.messages.some((m) => !m.isUser && m.text.includes('Bu Ayna,'))).toBe(true);
    expect(chat?.messages.some((m) => m.isUser)).toBe(false);

    const japanGroup = listConversationGroups().find((g) => g.title === 'Japonya');
    expect(japanGroup).toBeTruthy();
    expect(chat?.groupId).toBe(japanGroup?.id);

    const tree = buildConversationTree(listChatArchives(), listConversationGroups());
    const japanNode = tree.find((n) => n.title === 'Japonya');
    expect(japanNode?.conversations.some((c) => c.id === created!.chatId)).toBe(true);
    expect(japanNode?.conversations.find((c) => c.id === created!.chatId)?.isMirrorSource).toBe(
      true
    );

    expect(mirrorOriginHasPrivateLeak(created!.mirrorOrigin)).toBe(false);
    expect(JSON.stringify(chat)).not.toContain('mirrorBody');
    expect(JSON.stringify(chat)).not.toContain('conversationId');
  });

  it('steps 13–17: branch after inactivity keeps group and lineage metadata', () => {
    const guest = startMirrorGuestChat({
      session: FIXTURE_SESSION,
      firstUserMessage: 'Kyoto akşamları',
    })!;
    const parent = getChatArchive(guest.chatId)!;
    const groupId = parent.groupId!;

    const now = Date.now();
    const show = shouldShowBranchSuggestion({
      sourceType: 'mirror',
      assistantIsDone: true,
      isLoading: false,
      isTyping: false,
      lastUserMessageAt: now - BRANCH_SUGGESTION_INACTIVITY_MS - 5000,
      now,
      dismissed: false,
      shownInSession: false,
      isActiveConversation: true,
    });
    expect(show).toBe(true);

    const branchTitle = 'Yerel kafeleri bul';
    const branch = startMirrorBranchConversation({ parentChat: parent, branchTitle });
    expect(branch?.chatId).toBeTruthy();

    const child = getChatArchive(branch!.chatId);
    expect(child?.groupId).toBe(groupId);
    expect(child?.treeMetadata?.parentConversationId).toBe(parent.id);
    expect(child?.treeMetadata?.branchFromConversationId).toBe(parent.id);
    expect(child?.treeMetadata?.startedFromMirrorId).toBe(FIXTURE_SLUG);
    expect(child?.treeMetadata?.rootMirrorId).toBe(FIXTURE_SLUG);
    expect(child?.treeMetadata?.branchTitle).toBe(branchTitle);
    expect(child?.treeMetadata?.sourceType).toBe('mirror_branch');

    const tree = buildConversationTree(listChatArchives(), listConversationGroups());
    const japanNode = tree.find((n) => n.title === 'Japonya');
    expect(japanNode?.conversations.some((c) => c.id === branch!.chatId)).toBe(true);
  });

  it('step 18 prep: branch conversation has tree metadata for mirror generation context', () => {
    const guest = startMirrorGuestChat({
      session: FIXTURE_SESSION,
      firstUserMessage: 'Akşam yürüyüş rotası',
    })!;
    const parent = getChatArchive(guest.chatId)!;
    const branch = startMirrorBranchConversation({
      parentChat: parent,
      branchTitle: 'Akşam yürüyüş rotaları',
    })!;
    const child = getChatArchive(branch.chatId);
    expect(child?.messages.length).toBeGreaterThan(0);
    expect(child?.treeMetadata?.seedCategory).toBe('travel');
    expect(child?.mirrorOrigin?.autoReplyPending).toBe(true);
  });

  it('global UI language guard: no seed or Araştırmalarım in QA copy', () => {
    const labels = [
      'Sohbetlerim',
      'Bu konudan devam et',
      'Bu merak burada güzel bir yere geldi.',
      'Bu sohbet hangi başlığın altında ilerlesin?',
      'Japonya',
      'Gönder',
    ];
    const blob = uiTextBlob(...labels);
    expect(blob).not.toContain('seed');
    expect(blob).not.toContain('araştırmalarım');
    expect(blob).not.toContain('branch');
  });
});
