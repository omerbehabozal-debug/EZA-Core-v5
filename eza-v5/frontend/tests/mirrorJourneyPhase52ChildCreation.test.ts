/**
 * Phase 5.2 — child Yansı from live continuation (reuse Phase 3.7 engine).
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReview8DraftFromWindow,
  confirmJourneyWindow,
  confirmReview8Draft,
  extractQaPairs,
  getAwaitingDecisionWindow,
  markJourneyWindowReady,
  pairsForWindow,
  resolveParentJourneyId,
  skipJourneyWindow,
  syncJourneyConversationState,
  toggleReviewSourceOrder,
  type JourneyConversationState,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import {
  clearAllJourneyConversationStates,
} from '@/lib/eza/mirror/journey/journeyWindowStore';
import { clearAllReview8Drafts } from '@/lib/eza/mirror/journey/review8DraftStore';

const USER = 'bob';
const CONV = 'chat-mirror-from-a';
const ORIGIN_A = 'yansi-a';

function msg(
  id: string,
  text: string,
  opts: Partial<JourneyMessageLike> = {}
): JourneyMessageLike {
  return {
    id,
    text,
    isUser: opts.isUser,
    incomplete: opts.incomplete,
    role: opts.role,
  };
}

function livePairs(n: number): JourneyMessageLike[] {
  const opening = msg('mirror-open-1', 'Bu Ayna, merakından doğdu.', { isUser: false });
  const out: JourneyMessageLike[] = [opening];
  for (let i = 0; i < n; i += 1) {
    out.push(msg(`u-${i}`, `Bob soru ${i + 1} tam metin?`, { isUser: true }));
    out.push(msg(`a-${i}`, `Bob cevap ${i + 1} birebir.`, { isUser: false }));
  }
  return out;
}

function sync(
  messages: JourneyMessageLike[],
  state: JourneyConversationState | null = null,
  originating = ORIGIN_A
): JourneyConversationState {
  return syncJourneyConversationState({
    state,
    ownerUserId: USER,
    sourceConversationId: CONV,
    messages,
    originatingParentJourneyId: originating,
  });
}

describe('Phase 5.2 continuation parent seeding', () => {
  beforeEach(() => {
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
  });
  afterEach(() => {
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
  });

  it('replay/opening is excluded from live 8-count', () => {
    const before = sync([msg('mirror-open-1', 'opening', { isUser: false })]);
    expect(before.eligiblePairCount).toBe(0);
    expect(extractQaPairs(livePairs(0))).toHaveLength(0);

    const q1 = sync(livePairs(1));
    expect(q1.eligiblePairCount).toBe(1);
    expect(extractQaPairs(livePairs(1))[0]?.publicQuestion).toContain('Bob soru 1');
  });

  it('first child parent = originating A, not null', () => {
    const state = sync(livePairs(8));
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(0);
    expect(resolveParentJourneyId(state, 0)).toBe(ORIGIN_A);
    const confirmed = confirmJourneyWindow({
      state,
      windowIndex: 0,
      journeyId: 'journey-b',
      draftKey: 'draft-b',
      selectedCount: 6,
    });
    expect(confirmed.windows[0]?.parentJourneyId).toBe(ORIGIN_A);
  });

  it('legacy chat without origin stays root', () => {
    const state = syncJourneyConversationState({
      state: null,
      ownerUserId: USER,
      sourceConversationId: 'plain-chat',
      messages: livePairs(8),
    });
    expect(resolveParentJourneyId(state, 0)).toBeNull();
  });

  it('same conversation later block: A → B → C', () => {
    let state = sync(livePairs(8));
    state = confirmJourneyWindow({
      state,
      windowIndex: 0,
      journeyId: 'journey-b',
      draftKey: 'd0',
    });
    state = markJourneyWindowReady(state, 0);
    state = sync(livePairs(16), state);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    expect(resolveParentJourneyId(state, 1)).toBe('journey-b');
    state = confirmJourneyWindow({
      state,
      windowIndex: 1,
      journeyId: 'journey-c',
      draftKey: 'd1',
    });
    expect(state.windows[1]?.parentJourneyId).toBe('journey-b');
  });

  it('async generating B: C parent falls back to originating A', () => {
    let state = sync(livePairs(8));
    state = confirmJourneyWindow({
      state,
      windowIndex: 0,
      journeyId: 'journey-b',
      draftKey: 'd0',
    });
    expect(state.windows[0]?.status).toBe('generating');
    state = sync(livePairs(16), state);
    expect(resolveParentJourneyId(state, 1)).toBe(ORIGIN_A);
  });

  it('review selected steps are live Bob Q/A only (6/7/8 valid, 5 reject)', () => {
    const messages = livePairs(8);
    const pairs = pairsForWindow(extractQaPairs(messages), 0);
    expect(pairs).toHaveLength(8);
    expect(pairs.every((p) => p.publicQuestion.startsWith('Bob soru'))).toBe(true);
    expect(pairs.some((p) => p.publicQuestion.includes('Ayna'))).toBe(false);

    let draft = buildReview8DraftFromWindow({
      ownerUserId: USER,
      sourceConversationId: CONV,
      windowIndex: 0,
      pairs,
      draftKey: 'draft-1',
      parentJourneyId: ORIGIN_A,
    });
    expect(draft.parentJourneyId).toBe(ORIGIN_A);

    draft = toggleReviewSourceOrder(draft, 7);
    draft = toggleReviewSourceOrder(draft, 6);
    expect(draft.selectedSourceOrders).toHaveLength(6);
    expect(confirmReview8Draft(draft).ok).toBe(true);

    draft = toggleReviewSourceOrder(draft, 6);
    expect(draft.selectedSourceOrders).toHaveLength(7);
    expect(confirmReview8Draft(draft).ok).toBe(true);

    draft = toggleReviewSourceOrder(draft, 7);
    expect(draft.selectedSourceOrders).toHaveLength(8);
    expect(confirmReview8Draft(draft).ok).toBe(true);

    draft = toggleReviewSourceOrder(draft, 0);
    draft = toggleReviewSourceOrder(draft, 1);
    draft = toggleReviewSourceOrder(draft, 2);
    expect(draft.selectedSourceOrders).toHaveLength(5);
    const bad = confirmReview8Draft(draft);
    expect(bad.ok).toBe(false);
  });

  it('private continue from origin creates no child parent chain', () => {
    let state = sync(livePairs(8));
    state = skipJourneyWindow(state, 0);
    expect(state.journeyMode).toBe('private_chat_mode');
    const later = sync(livePairs(8), state);
    expect(getAwaitingDecisionWindow(later)).toBeNull();
    expect(later.windows[0]?.journeyId).toBeNull();
  });
});
