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
  extractQaPairs,
  getAwaitingDecisionWindow,
  isMirrorJourneyV1ClientEnabled,
  listPublishedJourneyChain,
  listReview8DraftsForConversation,
  markJourneyWindowReady,
  markJourneyWindowReviewing,
  pairsForWindow,
  resolveJourneyPublishContract,
  resolveParentJourneyId,
  saveJourneyConversationState,
  saveReview8Draft,
  skipJourneyWindow,
  syncJourneyConversationState,
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
  });
}

describe('Mirror Journey deterministic windows', () => {
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

  it('B: 8 Q/A → skip → no journey', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    expect(state.windows[0]?.status).toBe('skipped');
    expect(listPublishedJourneyChain(state)).toHaveLength(0);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
  });

  it('C: 16 Q/A → create at 8 and 16 → A→B parent chain', () => {
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

  it('D: 16 Q/A → skip first → create second → only one journey', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    state = sync(buildPairs(16), state);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    state = confirmWindow(state, 1, 'journey-only');
    const chain = listPublishedJourneyChain(state);
    expect(chain).toHaveLength(1);
    expect(chain[0]?.journeyId).toBe('journey-only');
    expect(chain[0]?.parentJourneyId).toBeNull();
    // Second window pairs are Q9–Q16, not mixed with skipped Q1–Q8
    const pairs = extractQaPairs(buildPairs(16));
    const w1 = pairsForWindow(pairs, 1);
    expect(w1[0]?.userMessageId).toBe('u9');
    expect(w1[7]?.userMessageId).toBe('u16');
  });

  it('E: 20 Q/A → skip both → conversation ends → zero journeys', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    state = sync(buildPairs(16), state);
    state = skipJourneyWindow(state, 1);
    state = sync(buildPairs(20), state);
    expect(state.conversationClosed).toBe(true);
    expect(canSendMoreJourneyQuestions(state)).toBe(false);
    expect(listPublishedJourneyChain(state)).toHaveLength(0);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
  });

  it('F: 20 Q/A → create first → skip second → one journey', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    state = sync(buildPairs(16), state);
    state = skipJourneyWindow(state, 1);
    state = sync(buildPairs(20), state);
    expect(state.conversationClosed).toBe(true);
    expect(listPublishedJourneyChain(state)).toHaveLength(1);
  });

  it('G: refresh after Q8 decision → decision not duplicated', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    const again = sync(buildPairs(8), state);
    expect(again.windows[0]?.status).toBe('skipped');
    expect(getAwaitingDecisionWindow(again)).toBeNull();

    let confirmed = sync(buildPairs(8));
    confirmed = confirmWindow(confirmed, 0, 'journey-a');
    const refreshed = sync(buildPairs(8), confirmed);
    expect(refreshed.windows[0]?.status).toBe('generating');
    expect(getAwaitingDecisionWindow(refreshed)).toBeNull();
  });

  it('H: generation A running while Q9/Q10 arrive → next window independent', () => {
    let state = sync(buildPairs(8));
    state = confirmWindow(state, 0, 'journey-a');
    expect(state.windows[0]?.status).toBe('generating');
    state = sync(buildPairs(10), state);
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.journeyId).toBe('journey-a');
    expect(state.windows.find((w) => w.windowIndex === 1)).toBeUndefined();
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    state = sync(buildPairs(16), state);
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    expect(state.windows[0]?.status).toBe('generating');
  });

  it('I: system/tool/noise messages do not advance count', () => {
    const messages: JourneyMessageLike[] = [
      msg('sys', 'Sistem', { role: 'system' }),
      msg('tool-1', 'tool', { role: 'tool' }),
      msg('saved-1', 'noise', { isUser: true }),
      msg('limit-1', 'limit', { isUser: false }),
      ...buildPairs(7),
    ];
    const state = sync(messages);
    expect(state.eligiblePairCount).toBe(7);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
  });

  it('J: incomplete assistant answer does not advance count', () => {
    const messages: JourneyMessageLike[] = [
      ...buildPairs(7),
      msg('u8', 'Soru 8?', { role: 'user' }),
      msg('a8', 'yarım', { role: 'assistant', incomplete: true }),
    ];
    const state = sync(messages);
    expect(state.eligiblePairCount).toBe(7);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
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

  it('Q20 pending blocks Q21 before A20 completes', () => {
    const messages: JourneyMessageLike[] = [
      ...buildPairs(19),
      msg('u20', 'Soru 20?', { role: 'user' }),
      msg('a20', 'streaming…', { role: 'assistant', incomplete: true }),
    ];
    expect(countAcceptedEligibleUserQuestions(messages)).toBe(20);
    expect(canAcceptAnotherJourneyQuestion(messages)).toBe(false);
    const state = sync(messages);
    expect(state.conversationClosed).toBe(true);
    expect(state.eligiblePairCount).toBe(19);

    const completed = [
      ...buildPairs(19),
      msg('u20', 'Soru 20?', { role: 'user' }),
      msg('a20', 'Cevap 20 tamam.', { role: 'assistant' }),
    ];
    expect(countAcceptedEligibleUserQuestions(completed)).toBe(20);
    expect(canAcceptAnotherJourneyQuestion(completed)).toBe(false);
    const closed = sync(completed, state);
    expect(closed.conversationClosed).toBe(true);
    expect(closed.eligiblePairCount).toBe(20);
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

  it('acceptance: skip first → second parent null', () => {
    let state = sync(buildPairs(8));
    state = skipJourneyWindow(state, 0);
    state = sync(buildPairs(16), state);
    state = confirmWindow(state, 1, 'journey-only');
    const chain = listPublishedJourneyChain(state);
    expect(chain).toHaveLength(1);
    expect(chain[0]?.parentJourneyId).toBeNull();
  });
});
