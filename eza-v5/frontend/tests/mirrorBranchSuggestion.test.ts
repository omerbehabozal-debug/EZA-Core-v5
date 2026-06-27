import { describe, expect, it, beforeEach, vi } from 'vitest';
import { buildBranchSuggestionCards } from '@/lib/eza/conversation-tree/buildBranchSuggestionCards';
import {
  shouldShowBranchSuggestion,
  BRANCH_SUGGESTION_INACTIVITY_MS,
} from '@/lib/eza/conversation-tree/branchSuggestionPolicy';
import {
  clearBranchSuggestionSession,
  isBranchSuggestionShown,
  markBranchSuggestionShown,
} from '@/lib/eza/conversation-tree/branchSuggestionSession';
import { startMirrorBranchConversation } from '@/lib/eza/conversation-tree/mirrorBranchConversation';
import { createConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import { getChatArchive, upsertChatArchive } from '@/lib/standaloneChatArchive';

describe('mirror branch suggestions (Stage 3 commit 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('builds max 3 editorial cards without seed UI language', () => {
    const cards = buildBranchSuggestionCards({
      seedQuestions: [
        "Kyoto'da gizli tapınaklar?",
        'Yerel kafeler',
        'Akşam yürüyüş rotaları',
        'Ekstra',
      ],
      discoverySignals: ['travel'],
    });
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(cards[0]).not.toContain('?');
    const blob = JSON.stringify(cards).toLowerCase();
    expect(blob).not.toContain('seed');
    expect(blob).not.toContain('branch');
  });

  it('shows suggestion only after inactivity when assistant is done', () => {
    const now = Date.now();
    const lastUser = now - BRANCH_SUGGESTION_INACTIVITY_MS - 1000;

    expect(
      shouldShowBranchSuggestion({
        sourceType: 'mirror',
        assistantIsDone: true,
        isLoading: false,
        isTyping: false,
        lastUserMessageAt: lastUser,
        now,
        dismissed: false,
        shownInSession: false,
        isActiveConversation: true,
      })
    ).toBe(true);

    expect(
      shouldShowBranchSuggestion({
        sourceType: 'mirror',
        assistantIsDone: true,
        isLoading: true,
        isTyping: false,
        lastUserMessageAt: lastUser,
        now,
        dismissed: false,
        shownInSession: false,
        isActiveConversation: true,
      })
    ).toBe(false);
  });

  it('tracks shown-once per session', () => {
    markBranchSuggestionShown('chat-1');
    expect(isBranchSuggestionShown('chat-1')).toBe(true);
    clearBranchSuggestionSession('chat-1');
    expect(isBranchSuggestionShown('chat-1')).toBe(false);
  });

  it('creates branch conversation with parent metadata in same group', () => {
    const group = createConversationGroup({ title: 'Japonya', source: 'mirror' });
    const parentId = 'chat-parent-1';
    const parent = {
      id: parentId,
      title: 'Kyoto',
      preview: 'test',
      savedAt: new Date().toISOString(),
      messageCount: 2,
      messages: [],
      groupId: group.id,
      treeMetadata: {
        groupId: group.id,
        sourceType: 'mirror' as const,
        startedFromMirrorId: 'mirror-slug',
        parentMirrorId: 'mirror-slug',
        rootMirrorId: 'mirror-slug',
        seedCategory: 'travel',
        isGuestSession: true,
        branchCandidates: ['Yerel kafeler', 'Akşam yürüyüş rotaları'],
      },
    };
    upsertChatArchive(parent);

    const created = startMirrorBranchConversation({
      parentChat: parent,
      branchTitle: 'Yerel kafeler',
    });
    expect(created?.chatId).toBeTruthy();
    const child = getChatArchive(created!.chatId);
    expect(child?.groupId).toBe(group.id);
    expect(child?.treeMetadata?.parentConversationId).toBe(parentId);
    expect(child?.treeMetadata?.branchTitle).toBe('Yerel kafeler');
    expect(child?.treeMetadata?.sourceType).toBe('mirror_branch');
    expect(JSON.stringify(child)).not.toContain('mirrorBody');
  });
});
