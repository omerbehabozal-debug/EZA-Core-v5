import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  allocateJourneyId,
  buildReview8Draft,
  confirmReview8Draft,
  extractQaPairs,
  isMirrorJourneyV1ClientEnabled,
  isReview8DraftConfirmed,
  proposeCandidate8,
  replaceReview8Step,
  saveReview8Draft,
  loadReview8DraftForConversation,
  clearReview8Draft,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';

function msg(id: string, text: string, isUser: boolean): JourneyMessageLike {
  return { id, text, isUser };
}

function buildLongChat(n: number): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push(msg(`u${i}`, `Soru ${i} aile SUV bütçe rota`, true));
    out.push(msg(`a${i}`, `Cevap ${i} detaylı öneri ve kriterler burada.`, false));
  }
  return out;
}

describe('extractQaPairs', () => {
  it('pairs each assistant with nearest prior unused user', () => {
    const pairs = extractQaPairs([
      msg('u1', 'Merhaba', true),
      msg('a1', 'Selam', false),
      msg('u2', 'SUV öner', true),
      msg('a2', 'Hibrit bak', false),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toMatchObject({
      userMessageId: 'u1',
      assistantMessageId: 'a1',
      publicQuestion: 'Merhaba',
      publicAnswer: 'Selam',
    });
  });

  it('skips orphan assistants and noise ids', () => {
    const pairs = extractQaPairs([
      msg('a0', 'Orphan', false),
      msg('saved-1', 'Sistem', true),
      msg('u1', 'Gerçek soru', true),
      msg('limit-x', 'Limit', false),
      msg('a1', 'Gerçek cevap', false),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.userMessageId).toBe('u1');
    expect(pairs[0]?.assistantMessageId).toBe('a1');
  });

  it('does not reuse the same user turn for two assistants', () => {
    const pairs = extractQaPairs([
      msg('u1', 'Tek soru', true),
      msg('a1', 'Cevap 1', false),
      msg('a2', 'Cevap 2 devam', false),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.assistantMessageId).toBe('a1');
  });

  it('skips consecutive users without answer until assistant arrives', () => {
    const pairs = extractQaPairs([
      msg('u1', 'İlk', true),
      msg('u2', 'Düzeltme', true),
      msg('a1', 'Son soruya cevap', false),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.userMessageId).toBe('u2');
  });
});

describe('proposeCandidate8', () => {
  it('returns not_ready when fewer than 8 pairs', () => {
    const result = proposeCandidate8(buildLongChat(5));
    expect(result.status).toBe('not_ready');
    if (result.status === 'not_ready') {
      expect(result.pairCount).toBe(5);
      expect(result.needed).toBe(8);
    }
  });

  it('proposes exactly 8 pairs when enough exist', () => {
    const result = proposeCandidate8(buildLongChat(12));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.paths.length).toBeGreaterThanOrEqual(1);
      expect(result.paths[0]?.pairRefs).toHaveLength(8);
      const ids = result.paths[0]!.pairRefs.map((p) => p.userMessageId);
      expect(new Set(ids).size).toBe(8);
    }
  });
});

describe('review8 draft', () => {
  beforeEach(() => {
    clearReview8Draft();
  });
  afterEach(() => {
    clearReview8Draft();
  });

  it('confirm freezes text and allocates journeyId', () => {
    const result = proposeCandidate8(buildLongChat(8));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    const draft = buildReview8Draft({
      sourceConversationId: 'conv-1',
      path: result.paths[0]!,
      titleSeed: 'Aile SUV',
    });
    expect(draft.status).toBe('reviewing');
    expect(draft.journeyId).toBeNull();

    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.journeyId).toMatch(/^aile-suv-/);
    expect(confirmed.selectedSteps).toHaveLength(8);
    expect(isReview8DraftConfirmed(confirmed)).toBe(true);

    saveReview8Draft(confirmed);
    const loaded = loadReview8DraftForConversation('conv-1');
    expect(loaded?.journeyId).toBe(confirmed.journeyId);
  });

  it('replace step resets confirmed status to reviewing', () => {
    const result = proposeCandidate8(buildLongChat(10));
    if (result.status !== 'ready') throw new Error('expected ready');
    let draft = confirmReview8Draft(
      buildReview8Draft({
        sourceConversationId: 'conv-2',
        path: result.paths[0]!,
      })
    );
    const spare = extractQaPairs(buildLongChat(10)).find(
      (p) => !draft.selectedSteps.some((s) => s.userMessageId === p.userMessageId)
    );
    expect(spare).toBeTruthy();
    draft = replaceReview8Step(draft, 3, spare!);
    expect(draft.status).toBe('reviewing');
    expect(draft.selectedSteps[2]?.userMessageId).toBe(spare!.userMessageId);
  });

  it('allocateJourneyId stays within slug length', () => {
    const id = allocateJourneyId('x'.repeat(200));
    expect(id.length).toBeLessThanOrEqual(64);
  });
});

describe('isMirrorJourneyV1ClientEnabled', () => {
  it('only enables on true/1', () => {
    expect(isMirrorJourneyV1ClientEnabled({})).toBe(false);
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'false' })).toBe(
      false
    );
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'yes' })).toBe(
      false
    );
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'true' })).toBe(
      true
    );
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: '1' })).toBe(true);
  });
});
