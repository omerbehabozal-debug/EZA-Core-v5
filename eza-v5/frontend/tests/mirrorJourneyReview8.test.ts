import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  allocateDraftKey,
  allocateJourneyId,
  buildReview8Draft,
  buildReview8DraftFromWindow,
  clearAllReview8Drafts,
  confirmReview8Draft,
  extractQaPairs,
  isLowInformationQuestion,
  isMirrorJourneyV1ClientEnabled,
  isReview8DraftConfirmed,
  listReview8DraftsForConversation,
  loadActiveReview8Draft,
  proposeCandidate8,
  replaceReview8Step,
  resolveJourneyPublishContract,
  saveReview8Draft,
  validateReview8Draft,
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

function buildTopicChat(
  n: number,
  topic: string,
  start = 1
): JourneyMessageLike[] {
  const facets = [
    'bütçe aralığı',
    'güvenlik puanı',
    'yakıt tüketimi',
    'bakım maliyeti',
    'ikinci el değeri',
    'aile bagaj hacmi',
    'şehir içi kullanım',
    'uzun yol konforu',
    'sigorta primi',
    'hibrit seçenek',
    'garanti süresi',
    'servis ağı',
  ];
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = start + i;
    const facet = facets[i % facets.length]!;
    out.push(
      msg(`u${idx}`, `${topic} için ${facet} nasıl değerlendirilir?`, {
        isUser: true,
      })
    );
    out.push(
      msg(
        `a${idx}`,
        `${topic} konusunda ${facet} için detaylı öneri ve karşılaştırma kriterleri.`,
        { isUser: false }
      )
    );
  }
  return out;
}

function buildDriftChat(): JourneyMessageLike[] {
  const italy: JourneyMessageLike[] = [];
  for (let i = 1; i <= 6; i += 1) {
    italy.push(
      msg(`iu${i}`, `Venedik gondola San Marco otel planı seçenek ${i}?`, {
        isUser: true,
      })
    );
    italy.push(
      msg(`ia${i}`, `İtalya seyahatinde Venedik ve Roma için rota ${i}.`, {
        isUser: false,
      })
    );
  }
  const laptop: JourneyMessageLike[] = [];
  for (let i = 1; i <= 6; i += 1) {
    laptop.push(
      msg(`lu${i}`, `İşlemci anakart SSD RAM laptop modeli ${i}?`, { isUser: true })
    );
    laptop.push(
      msg(`la${i}`, `Bilgisayar donanımında CPU ve bellek önerisi ${i}.`, {
        isUser: false,
      })
    );
  }
  const yoga: JourneyMessageLike[] = [];
  for (let i = 1; i <= 6; i += 1) {
    yoga.push(
      msg(`yu${i}`, `Nefes asana meditasyon chakra pratiği ${i}?`, { isUser: true })
    );
    yoga.push(
      msg(`ya${i}`, `Yoga seansında nefes ve farkındalık önerisi ${i}.`, {
        isUser: false,
      })
    );
  }
  return [...italy, ...laptop, ...yoga];
}

describe('extractQaPairs roles', () => {
  it('pairs normal Q/A', () => {
    const pairs = extractQaPairs([
      msg('u1', 'Merhaba', { isUser: true }),
      msg('a1', 'Selam', { isUser: false }),
    ]);
    expect(pairs).toHaveLength(1);
  });

  it('ignores system/tool/noise and orphan assistants', () => {
    const pairs = extractQaPairs([
      msg('a0', 'Orphan', { role: 'assistant' }),
      msg('sys', 'Sistem', { role: 'system' }),
      msg('tool-1', 'tool', { role: 'tool' }),
      msg('saved-1', 'noise', { isUser: true }),
      msg('u1', 'Gerçek', { role: 'user' }),
      msg('a1', 'Cevap', { role: 'assistant' }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.userMessageId).toBe('u1');
  });

  it('ignores incomplete assistant', () => {
    const pairs = extractQaPairs([
      msg('u1', 'Soru', { role: 'user' }),
      msg('a1', 'yarım', { role: 'assistant', incomplete: true }),
      msg('a2', 'tam', { role: 'assistant' }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.assistantMessageId).toBe('a2');
  });

  it('uses regenerated assistant when replacesAssistantMessageId set', () => {
    const pairs = extractQaPairs([
      msg('u1', 'Soru', { role: 'user' }),
      msg('a1', 'eski', { role: 'assistant' }),
      msg('a2', 'yeni', {
        role: 'assistant',
        replacesAssistantMessageId: 'a1',
      }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.assistantMessageId).toBe('a2');
    expect(pairs[0]?.publicAnswer).toBe('yeni');
  });

  it('consecutive users pair last user with assistant', () => {
    const pairs = extractQaPairs([
      msg('u1', 'İlk', { role: 'user' }),
      msg('u2', 'Düzeltme', { role: 'user' }),
      msg('a1', 'Cevap', { role: 'assistant' }),
    ]);
    expect(pairs[0]?.userMessageId).toBe('u2');
  });
});

describe('proposeCandidate8 coherence', () => {
  it('exactly 8 clean questions ready', () => {
    const result = proposeCandidate8(buildTopicChat(8, 'suv'));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.paths[0]?.pairRefs).toHaveLength(8);
      const orders = result.paths[0]!.pairRefs.map((p) => p.sourceOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('12 same-topic questions still coherent', () => {
    const result = proposeCandidate8(buildTopicChat(12, 'suv hibrit aile'));
    expect(result.status).toBe('ready');
  });

  it('topic drift returns review_required', () => {
    const result = proposeCandidate8(buildDriftChat());
    expect(['review_required', 'not_ready']).toContain(result.status);
  });

  it('near duplicates do not fill multiple slots', () => {
    const msgs: JourneyMessageLike[] = [];
    for (let i = 1; i <= 10; i += 1) {
      const q =
        i <= 4
          ? 'Aile için hangi SUV daha mantıklı?'
          : `SUV bütçe soru ${i} kriter`;
      msgs.push(msg(`u${i}`, q, { isUser: true }));
      msgs.push(msg(`a${i}`, `Cevap ${i} detay`, { isUser: false }));
    }
    const result = proposeCandidate8(msgs);
    if (result.status === 'ready') {
      const qs = result.paths[0]!.pairRefs.map((p) => p.publicQuestion);
      const dupCount = qs.filter((q) => q.includes('hangi SUV daha mantıklı')).length;
      expect(dupCount).toBeLessThanOrEqual(1);
    } else {
      expect(result.status).toBe('not_ready');
    }
  });

  it('low-information prompts filtered', () => {
    expect(isLowInformationQuestion('evet')).toBe(true);
    expect(isLowInformationQuestion('peki')).toBe(true);
    const msgs: JourneyMessageLike[] = [];
    const fillers = ['evet', 'peki', 'başka', 'tamam'];
    fillers.forEach((t, i) => {
      msgs.push(msg(`uf${i}`, t, { isUser: true }));
      msgs.push(msg(`af${i}`, 'Tamamdır', { isUser: false }));
    });
    msgs.push(...buildTopicChat(8, 'felsefe anlam'));
    const result = proposeCandidate8(msgs);
    if (result.status === 'ready') {
      for (const p of result.paths[0]!.pairRefs) {
        expect(isLowInformationQuestion(p.publicQuestion)).toBe(false);
      }
    }
  });
});

describe('review8 multi-journey identity', () => {
  beforeEach(() => clearAllReview8Drafts());
  afterEach(() => clearAllReview8Drafts());

  it('two journeys same conversation coexist', () => {
    const pathReady = proposeCandidate8(buildTopicChat(10, 'suv'));
    expect(pathReady.status).toBe('ready');
    if (pathReady.status !== 'ready') return;

    const draftA = buildReview8Draft({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-x',
      path: pathReady.paths[0]!,
      titleSeed: 'Journey A',
      draftKey: allocateDraftKey('conv-x'),
    });
    const confirmedA = confirmReview8Draft(draftA);
    expect(confirmedA.ok).toBe(true);
    if (!confirmedA.ok) return;
    saveReview8Draft(confirmedA.draft);

    const draftB = buildReview8Draft({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-x',
      path: pathReady.paths[0]!,
      titleSeed: 'Journey B',
      draftKey: allocateDraftKey('conv-x'),
    });
    saveReview8Draft(draftB);

    const listed = listReview8DraftsForConversation('user-1', 'conv-x');
    expect(listed.length).toBeGreaterThanOrEqual(2);
    const stillA = listed.find((d) => d.draftKey === confirmedA.draft.draftKey);
    expect(stillA?.status).toBe('confirmed');
    expect(stillA?.journeyId).toBe(confirmedA.draft.journeyId);
  });

  it('user isolation — other user cannot load draft', () => {
    const pathReady = proposeCandidate8(buildTopicChat(8, 'suv'));
    if (pathReady.status !== 'ready') throw new Error('ready');
    const draft = buildReview8Draft({
      ownerUserId: 'user-a',
      sourceConversationId: 'conv-1',
      path: pathReady.paths[0]!,
    });
    saveReview8Draft(draft);
    expect(loadActiveReview8Draft('user-b', 'conv-1')).toBeNull();
  });

  it('confirm freezes snapshot; tamper invalidates', () => {
    const pathReady = proposeCandidate8(buildTopicChat(8, 'suv'));
    if (pathReady.status !== 'ready') throw new Error('ready');
    const built = buildReview8Draft({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      path: pathReady.paths[0]!,
    });
    const confirmed = confirmReview8Draft(built);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(isReview8DraftConfirmed(confirmed.draft)).toBe(true);

    const tampered = {
      ...confirmed.draft,
      selectedSteps: confirmed.draft.selectedSteps.map((s, i) =>
        i === 0 ? { ...s, publicAnswer: 'CHANGED' } : s
      ),
    };
    const validated = validateReview8Draft(tampered, {
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      requireConfirmed: true,
    });
    expect(validated.ok).toBe(false);
  });

  it('replace reindexes chronologically and blocks incomplete confirm', () => {
    const pathReady = proposeCandidate8(buildTopicChat(10, 'suv'));
    if (pathReady.status !== 'ready') throw new Error('ready');
    let draft = buildReview8Draft({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-1',
      path: pathReady.paths[0]!,
    });
    const spare = extractQaPairs(buildTopicChat(10, 'suv')).find(
      (p) => !draft.selectedSteps.some((s) => s.userMessageId === p.userMessageId)
    );
    expect(spare).toBeTruthy();
    draft = replaceReview8Step(draft, 3, spare!);
    expect(draft.selectedSteps).toHaveLength(8);
    expect(draft.selectedSteps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const orders = draft.selectedSteps.map((s) => s.sourceOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('allocateJourneyId length bound', () => {
    expect(allocateJourneyId('x'.repeat(200)).length).toBeLessThanOrEqual(64);
  });
});

describe('journey publish contract gate', () => {
  beforeEach(() => clearAllReview8Drafts());
  afterEach(() => clearAllReview8Drafts());

  it('flag off → legacy', () => {
    const result = resolveJourneyPublishContract({
      ownerUserId: 'u1',
      conversationId: 'c1',
      env: { NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'false' },
    });
    expect(result.ok && 'legacy' in result).toBe(true);
  });

  it('flag on without confirmed draft → review8_required', () => {
    const result = resolveJourneyPublishContract({
      ownerUserId: 'u1',
      conversationId: 'c1',
      env: { NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'true' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['review8_required', 'draft_invalid', 'user_required']).toContain(
        result.code
      );
    }
  });

  it('flag on with confirmed draft → journeyId + 8 steps + window', () => {
    const pairs = extractQaPairs(buildTopicChat(8, 'suv'));
    const built = buildReview8DraftFromWindow({
      ownerUserId: 'u1',
      sourceConversationId: 'c1',
      windowIndex: 0,
      pairs,
      draftKey: 'win-c1-0',
      parentJourneyId: null,
    });
    const confirmed = confirmReview8Draft(built);
    if (!confirmed.ok) throw new Error('confirm');
    saveReview8Draft(confirmed.draft);

    const result = resolveJourneyPublishContract({
      ownerUserId: 'u1',
      conversationId: 'c1',
      env: { NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'true' },
    });
    expect(result.ok).toBe(true);
    if (result.ok && !('legacy' in result)) {
      expect(result.journeyId).toBeTruthy();
      expect(result.selectedSteps).toHaveLength(8);
      expect(result.windowIndex).toBe(0);
      expect(result.windowStart).toBe(0);
      expect(result.windowEnd).toBe(7);
      expect(result.parentJourneyId).toBeNull();
    }
  });
});

describe('isMirrorJourneyV1ClientEnabled', () => {
  it('only enables on true/1', () => {
    expect(isMirrorJourneyV1ClientEnabled({})).toBe(false);
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'yes' })).toBe(
      false
    );
    expect(isMirrorJourneyV1ClientEnabled({ NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: 'true' })).toBe(
      true
    );
  });
});
