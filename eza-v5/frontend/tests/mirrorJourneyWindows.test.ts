import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReview8DraftFromWindow,
  canAcceptAnotherJourneyQuestion,
  canSendMoreJourneyQuestions,
  clearAllJourneyConversationStates,
  clearAllReview8Drafts,
  confirmJourneyWindow,
  confirmReview8Draft,
  countAcceptedEligibleUserQuestions,
  enterPrivateChatMode,
  extractQaPairs,
  getAwaitingDecisionWindow,
  isMirrorJourneyV1ClientEnabled,
  isPrivateChatMode,
  listPublishedJourneyChain,
  listReview8DraftsForConversation,
  markJourneyWindowReady,
  markJourneyWindowReviewing,
  pairsForWindow,
  resolveJourneyPublishContract,
  resolveParentJourneyId,
  reopenJourneyWindowDecision,
  saveJourneyConversationState,
  saveReview8Draft,
  skipJourneyWindow,
  syncJourneyConversationState,
  toggleReviewSourceOrder,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';

function msg(
  id: string,
  text: string,
  opts: Partial<JourneyMessageLike> = {}
): JourneyMessageLike {
  return {
    id,
    text,
    isUser: opts.isUser,
    role: opts.role,
    incomplete: opts.incomplete,
    replacesAssistantMessageId: opts.replacesAssistantMessageId,
  };
}

function buildPairs(n: number, start = 1): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = start + i;
    out.push(msg(`u${idx}`, `Soru ${idx} hakkında ne dersin?`, { role: 'user' }));
    out.push(
      msg(`a${idx}`, `Cevap ${idx} için net ve tamamlanmış yanıt.`, {
        role: 'assistant',
      })
    );
  }
  return out;
}

const USER = 'user-1';
const CONV = 'conv-1';

function sync(messages: JourneyMessageLike[], state = null as ReturnType<
  typeof syncJourneyConversationState
> | null) {
  return syncJourneyConversationState({
    state,
    ownerUserId: USER,
    sourceConversationId: CONV,
    messages,
  });
}

function confirmWindow(
  state: ReturnType<typeof sync>,
  windowIndex: number,
  journeyId: string
) {
  const reviewing = markJourneyWindowReviewing(state, windowIndex);
  const allPairs = extractQaPairs(
    buildPairs(Math.max(state.eligiblePairCount, (windowIndex + 1) * 8))
  );
  const windowPairs = pairsForWindow(allPairs, windowIndex);
  expect(windowPairs).toHaveLength(8);
  const draft = buildReview8DraftFromWindow({
    ownerUserId: USER,
    sourceConversationId: CONV,
    windowIndex,
    pairs: windowPairs,
    draftKey: reviewing.windows.find((w) => w.windowIndex === windowIndex)!.draftKey!,
    parentJourneyId: resolveParentJourneyId(reviewing, windowIndex),
  });
  const confirmed = confirmReview8Draft({ ...draft, journeyId });
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error('confirm failed');
  saveReview8Draft(confirmed.draft);
  return confirmJourneyWindow({
    state: reviewing,
    windowIndex,
    journeyId: confirmed.draft.journeyId!,
    draftKey: confirmed.draft.draftKey,
    selectedCount: confirmed.draft.selectedSteps.length,
  });
}

describe('Mirror Journey Phase 3.7 source blocks', () => {
  beforeEach(() => {
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
  });
  afterEach(() => {
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
  });

  it('A: 8 Q/A → create → Journey A', () => {
    let state = sync(buildPairs(8));
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(0);
    state = confirmWindow(state, 0, 'journey-a');
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.journeyId).toBe('journey-a');
    expect(state.windows[0]?.parentJourneyId).toBeNull();
    expect(listPublishedJourneyChain(state)).toHaveLength(1);
  });

  it('B: explicit Private Continue → permanent private mode', () => {
    let state = sync(buildPairs(8));
    state = enterPrivateChatMode(state, 0);
    expect(isPrivateChatMode(state)).toBe(true);
    expect(state.windows[0]?.status).toBe('skipped');
    expect(listPublishedJourneyChain(state)).toHaveLength(0);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    state = sync(buildPairs(16), state);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(isPrivateChatMode(state)).toBe(true);
  });

  it('C: 16 Q/A → create at 8 and 16 → A→B parent chain (A ready)', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    state = markJourneyWindowReady(state, 0);
    state = sync(buildPairs(16), state);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    state = confirmWindow(state, 1, 'journey-b');
    const chain = listPublishedJourneyChain(state);
    expect(chain).toHaveLength(2);
    expect(chain[0]?.journeyId).toBe('journey-a');
    expect(chain[0]?.parentJourneyId).toBeNull();
    expect(chain[1]?.journeyId).toBe('journey-b');
    expect(chain[1]?.parentJourneyId).toBe('journey-a');
  });

  it('D: Review cancel returns to decision — not Private Mode', () => {
    let state = sync(buildPairs(8));
    state = markJourneyWindowReviewing(state, 0);
    expect(state.windows[0]?.status).toBe('reviewing');
    state = reopenJourneyWindowDecision(state, 0);
    expect(state.windows[0]?.status).toBe('awaiting_decision');
    expect(isPrivateChatMode(state)).toBe(false);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(0);
  });

  it('E: Private Mode → 20 closes; Journey Mode unlimited past 20', () => {
    let privateState = sync(buildPairs(8));
    privateState = enterPrivateChatMode(privateState, 0);
    privateState = sync(buildPairs(20), privateState);
    expect(privateState.conversationClosed).toBe(true);
    expect(canSendMoreJourneyQuestions(privateState)).toBe(false);
    expect(
      canAcceptAnotherJourneyQuestion(buildPairs(20), privateState)
    ).toBe(false);

    let journeyState = sync(buildPairs(24));
    expect(journeyState.journeyMode).toBe('journey_mode');
    expect(journeyState.conversationClosed).toBe(false);
    expect(canAcceptAnotherJourneyQuestion(buildPairs(24), journeyState)).toBe(
      true
    );
    expect(getAwaitingDecisionWindow(journeyState)?.windowIndex).toBe(0);
    // Blocks 0 and 1 and 2 all full
    const awaiting = journeyState.windows.filter((w) => w.status === 'awaiting_decision');
    expect(awaiting.map((w) => w.windowIndex)).toEqual([0, 1, 2]);
  });

  it('F: create first → Private on second → one journey + private cap', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    state = sync(buildPairs(16), state);
    state = skipJourneyWindow(state, 1);
    expect(isPrivateChatMode(state)).toBe(true);
    state = sync(buildPairs(20), state);
    expect(state.conversationClosed).toBe(true);
    expect(listPublishedJourneyChain(state)).toHaveLength(1);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
  });

  it('G: refresh after Private → stays private; confirm stays generating', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    const again = sync(buildPairs(8), state);
    expect(again.windows[0]?.status).toBe('skipped');
    expect(isPrivateChatMode(again)).toBe(true);
    expect(getAwaitingDecisionWindow(again)).toBeNull();

    let confirmed = sync(buildPairs(8));
    confirmed = confirmWindow(confirmed, 0, 'journey-a');
    const refreshed = sync(buildPairs(8), confirmed);
    expect(refreshed.windows[0]?.status).toBe('generating');
    expect(getAwaitingDecisionWindow(refreshed)).toBeNull();
  });

  it('H: generation A running while Block B collects — async isolation', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    expect(state.windows[0]?.status).toBe('generating');
    state = sync(buildPairs(10), state);
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.journeyId).toBe('journey-a');
    expect(canAcceptAnotherJourneyQuestion(buildPairs(10), state)).toBe(true);
    state = sync(buildPairs(16), state);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    expect(state.windows[0]?.status).toBe('generating');
    // Parent must not invent published parent while A still generating
    expect(resolveParentJourneyId(state, 1)).toBeNull();
  });

  it('I: unlimited blocks A–D + high N', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    state = markJourneyWindowReady(state, 0);
    for (const [pairs, idx, id] of [
      [16, 1, 'journey-b'],
      [24, 2, 'journey-c'],
      [32, 3, 'journey-d'],
    ] as const) {
      state = sync(buildPairs(pairs), state);
      expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(idx);
      state = confirmWindow(state, idx, id);
      state = markJourneyWindowReady(state, idx);
    }
    expect(listPublishedJourneyChain(state)).toHaveLength(4);
    expect(listPublishedJourneyChain(state)[3]?.parentJourneyId).toBe('journey-c');

    // Synthetic high block
    state = sync(buildPairs(80), state);
    expect(state.windows.some((w) => w.windowIndex === 9)).toBe(true);
    const high = getAwaitingDecisionWindow(state);
    expect(high?.windowIndex).toBeGreaterThanOrEqual(4);
  });

  it('J: 6–8 selection confirm; 5 invalid', () => {
    const pairs = pairsForWindow(extractQaPairs(buildPairs(8)), 0);
    let draft = buildReview8DraftFromWindow({
      ownerUserId: USER,
      sourceConversationId: CONV,
      windowIndex: 0,
      pairs,
      draftKey: 'draft-1',
    });
    // deselect 2
    draft = toggleReviewSourceOrder(draft, 1);
    draft = toggleReviewSourceOrder(draft, 3);
    expect(draft.selectedSourceOrders).toHaveLength(6);
    const ok = confirmReview8Draft(draft);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.draft.selectedSteps).toHaveLength(6);
      expect(ok.draft.selectedSteps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(ok.draft.selectedSteps[0]?.sourceOrder).toBe(0);
      expect(ok.draft.selectedSteps[1]?.sourceOrder).toBe(2);
    }
    // deselect 3rd → 5
    draft = toggleReviewSourceOrder(draft, 0);
    expect(draft.selectedSourceOrders).toHaveLength(5);
    const bad = confirmReview8Draft(draft);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe('below_minimum');
    }
  });

  it('K: feature flag off → publish contract stays legacy', () => {
    expect(
      isMirrorJourneyV1ClientEnabled({
        NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: undefined,
      })
    ).toBe(false);
    const contract = resolveJourneyPublishContract({
      ownerUserId: USER,
      conversationId: CONV,
      env: { NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'false' },
    });
    expect(contract).toEqual({ ok: true, legacy: true });
  });

  it('Private Mode: Q20 pending blocks Q21 before A20 completes', () => {
    let state = sync(buildPairs(8));
    state = enterPrivateChatMode(state, 0);
    const messages: JourneyMessageLike[] = [
      ...buildPairs(19),
      msg('u20', 'Soru 20?', { role: 'user' }),
      msg('a20', 'streaming…', { role: 'assistant', incomplete: true }),
    ];
    expect(countAcceptedEligibleUserQuestions(messages)).toBe(20);
    expect(canAcceptAnotherJourneyQuestion(messages, state)).toBe(false);
    state = sync(messages, state);
    expect(state.conversationClosed).toBe(true);
  });

  it('multi-tab stale write rejected', () => {
    clearAllJourneyConversationStates();
    let state = sync(buildPairs(8));
    const first = saveJourneyConversationState(state);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('save');
    state = first.state;

    const tabA = skipJourneyWindow(state, 0);
    const tabB = confirmWindow(state, 0, 'journey-a');
    const savedB = saveJourneyConversationState(tabB);
    expect(savedB.ok).toBe(true);

    const savedA = saveJourneyConversationState(tabA);
    expect(savedA.ok).toBe(false);
    if (!savedA.ok) {
      expect(savedA.code).toBe('stale_revision');
      expect(savedA.current.windows[0]?.status).toBe('generating');
      expect(savedA.current.windows[0]?.journeyId).toBe('journey-a');
    }
  });

  it('acceptance: A then B parent chain with window identity on drafts', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    state = markJourneyWindowReady(state, 0);
    state = sync(buildPairs(16), state);
    state = confirmWindow(state, 1, 'journey-b');
    const chain = listPublishedJourneyChain(state);
    expect(chain).toEqual([
      { windowIndex: 0, journeyId: 'journey-a', parentJourneyId: null },
      { windowIndex: 1, journeyId: 'journey-b', parentJourneyId: 'journey-a' },
    ]);

    const drafts = listReview8DraftsForConversation(USER, CONV);
    const byJourney = Object.fromEntries(
      drafts.filter((d) => d.journeyId).map((d) => [d.journeyId!, d])
    );
    expect(byJourney['journey-a']?.windowIndex).toBe(0);
    expect(byJourney['journey-a']?.windowStartSequence).toBe(0);
    expect(byJourney['journey-a']?.windowEndSequence).toBe(7);
    expect(byJourney['journey-b']?.windowIndex).toBe(1);
    expect(byJourney['journey-b']?.windowStartSequence).toBe(8);
    expect(byJourney['journey-b']?.windowEndSequence).toBe(15);
    expect(byJourney['journey-b']?.parentJourneyId).toBe('journey-a');
  });
});
