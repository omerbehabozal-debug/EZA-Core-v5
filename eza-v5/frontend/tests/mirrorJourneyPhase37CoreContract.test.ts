import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReview8DraftFromWindow,
  clearAllReview8Drafts,
  computeSourceBlockHash,
  confirmReview8Draft,
  extractQaPairs,
  listJourneyGenerationArtifactsForConversation,
  pairsForWindow,
  resolveScopedJourneyMeaning,
  saveJourneyGenerationArtifact,
  clearJourneyGenerationArtifactsForUser,
  toggleReviewSourceOrder,
  type JourneyGenerationLineage,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';

function buildPairs(n: number): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({ id: `u${i}`, text: `Soru ${i}?`, role: 'user' });
    out.push({ id: `a${i}`, text: `Cevap ${i}.`, role: 'assistant' });
  }
  return out;
}

describe('Mirror Journey Phase 3.7 core contract (frontend)', () => {
  beforeEach(() => {
    clearAllReview8Drafts();
    clearJourneyGenerationArtifactsForUser('user-1');
  });
  afterEach(() => {
    clearAllReview8Drafts();
    clearJourneyGenerationArtifactsForUser('user-1');
  });

  it('sourceBlockHash stable across 8/7/6; scoped messages exclude deselected', () => {
    const pairs = pairsForWindow(extractQaPairs(buildPairs(8)), 0);
    const blockHash = computeSourceBlockHash(pairs);

    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      windowIndex: 0,
      pairs,
      draftKey: 'd1',
    });
    const c8 = confirmReview8Draft(draft);
    expect(c8.ok).toBe(true);
    if (!c8.ok) throw new Error('c8');
    const m8 = resolveScopedJourneyMeaning(c8.draft);
    expect(m8.ok).toBe(true);
    if (!m8.ok) throw new Error('m8');
    expect(m8.sourceBlockHash).toBe(blockHash);
    expect(m8.messages).toHaveLength(16);

    draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      windowIndex: 0,
      pairs,
      draftKey: 'd2',
    });
    draft = toggleReviewSourceOrder(draft, 2);
    const c7 = confirmReview8Draft(draft);
    expect(c7.ok).toBe(true);
    if (!c7.ok) throw new Error('c7');
    const m7 = resolveScopedJourneyMeaning(c7.draft);
    expect(m7.ok).toBe(true);
    if (!m7.ok) throw new Error('m7');
    expect(m7.sourceBlockHash).toBe(blockHash);
    expect(m7.messages).toHaveLength(14);
    expect(m7.scopedInputHash).not.toBe(m8.scopedInputHash);
    expect(m7.messages.some((x) => x.text === 'Soru 3?')).toBe(false);

    draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      windowIndex: 0,
      pairs,
      draftKey: 'd3',
    });
    draft = toggleReviewSourceOrder(draft, 1);
    draft = toggleReviewSourceOrder(draft, 4);
    const c6 = confirmReview8Draft(draft);
    expect(c6.ok).toBe(true);
    if (!c6.ok) throw new Error('c6');
    const m6 = resolveScopedJourneyMeaning(c6.draft);
    expect(m6.ok).toBe(true);
    if (!m6.ok) throw new Error('m6');
    expect(m6.sourceBlockHash).toBe(blockHash);
    expect(m6.messages).toHaveLength(12);
    expect(m6.selectedCount).toBe(6);
  });

  it('multi-artifact store keeps A and B isolated', () => {
    const base = {
      contractVersion: 'journey_generation_lineage_v1' as const,
      journeyVersion: 1,
      sourceConversationId: 'conv-multi',
      windowStart: 0,
      windowEnd: 7,
      windowHash: 'h1',
      scopedInputHash: 's1',
      selectedStepsHash: 't1',
      interpretationHash: 'i1',
      publicLandingHash: 'p1',
      mappedPromptHash: 'm1',
      sealedAt: new Date().toISOString(),
      selectedSteps: Array.from({ length: 8 }, (_, i) => ({
        stepIndex: i + 1,
        sourceOrder: i,
        sourceUserMessageId: `u${i}`,
        sourceAssistantMessageId: `a${i}`,
        publicQuestion: `Q${i}?`,
        publicAnswer: `A${i}.`,
      })),
    };
    const a: JourneyGenerationLineage = {
      ...base,
      journeyId: 'journey-a',
      windowIndex: 0,
      blockIndex: 0,
      generationId: 'gen-a',
    };
    const b: JourneyGenerationLineage = {
      ...base,
      journeyId: 'journey-b',
      windowIndex: 1,
      windowStart: 8,
      windowEnd: 15,
      blockIndex: 1,
      generationId: 'gen-b',
      selectedStepsHash: 't2',
      selectedSteps: base.selectedSteps.map((s) => ({
        ...s,
        sourceOrder: s.sourceOrder + 8,
      })),
    };
    saveJourneyGenerationArtifact('user-1', a);
    saveJourneyGenerationArtifact('user-1', b);
    const listed = listJourneyGenerationArtifactsForConversation(
      'user-1',
      'conv-multi'
    );
    expect(listed).toHaveLength(2);
    expect(listed[0]?.journeyId).toBe('journey-a');
    expect(listed[1]?.journeyId).toBe('journey-b');
    expect(listed[0]?.generationId).toBe('gen-a');
    expect(listed[1]?.generationId).toBe('gen-b');
  });
});
