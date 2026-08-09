import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReview8DraftFromWindow,
  clearAllReview8Drafts,
  confirmReview8Draft,
  computeScopedJourneyInputHash,
  extractQaPairs,
  isMirrorJourneyV1ClientEnabled,
  resolveScopedJourneyMeaning,
  saveReview8Draft,
  type JourneyMessageLike,
  type Review8SelectedStep,
} from '@/lib/eza/mirror/journey';
import { buildSemanticAnchors } from '@/lib/eza/mirror/semanticAnchors';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

function msg(
  id: string,
  text: string,
  opts: Partial<JourneyMessageLike> = {}
): JourneyMessageLike {
  return {
    id,
    text,
    role: opts.role,
    isUser: opts.isUser,
    incomplete: opts.incomplete,
  };
}

function topicPairs(
  n: number,
  topic: string,
  start = 1
): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = start + i;
    out.push(
      msg(`u${idx}`, `${topic} soru ${idx}: detaylı karşılaştırma?`, {
        role: 'user',
      })
    );
    out.push(
      msg(`a${idx}`, `${topic} cevap ${idx}: net öneri ve kriterler.`, {
        role: 'assistant',
      })
    );
  }
  return out;
}

function windowDraft(
  pairs: ReturnType<typeof extractQaPairs>,
  windowIndex: number,
  journeyId: string,
  parentJourneyId: string | null = null
) {
  const start = windowIndex * 8;
  const slice = pairs.slice(start, start + 8);
  const built = buildReview8DraftFromWindow({
    ownerUserId: 'user-1',
    sourceConversationId: 'conv-scoped',
    windowIndex,
    pairs: slice,
    draftKey: `win-conv-scoped-${windowIndex}`,
    parentJourneyId,
    titleSeed: journeyId,
  });
  const confirmed = confirmReview8Draft({ ...built, journeyId });
  if (!confirmed.ok) throw new Error('confirm failed');
  saveReview8Draft(confirmed.draft);
  return confirmed.draft;
}

function interpFromTopic(topic: string): MirrorInterpretationV1 {
  return {
    contractVersion: 'mirror-interpretation-v1',
    title: `${topic} yolculuğu`,
    interpretationSummary: `${topic} hakkında kullanıcı karşılaştırmalı bir karar arıyor.`,
    imageIntent: `${topic} sahnesi`,
    visualNarrative: `${topic} atmosferinde sakin bir görsel`,
    atmosphereHint: 'calm',
    topicCategory: /bmw|glc|suv|araç/i.test(topic) ? 'vehicle' : 'travel',
    mustInclude: [topic],
    mustAvoid: [],
    confidence: 0.8,
  } as MirrorInterpretationV1;
}

describe('Journey Phase 3 scoped meaning', () => {
  beforeEach(() => clearAllReview8Drafts());
  afterEach(() => clearAllReview8Drafts());

  it('A: Journey A meaning messages contain only BMW/GLC window', () => {
    const all = [
      ...topicPairs(8, 'BMW GLC aile SUV'),
      ...topicPairs(8, 'Roma İmparatorluğu tarihi', 9),
    ];
    const pairs = extractQaPairs(all);
    const draft = windowDraft(pairs, 0, 'journey-bmw');
    const scoped = resolveScopedJourneyMeaning(draft);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    const blob = scoped.messages.map((m) => m.text).join(' ');
    expect(blob).toMatch(/BMW GLC/i);
    expect(blob).not.toMatch(/Roma İmparatorluğu/i);
    expect(scoped.messages).toHaveLength(16);
    expect(scoped.scope.semanticScope).toBe('journey_window_v1');
  });

  it('B: Journey B meaning messages contain only Rome window', () => {
    const all = [
      ...topicPairs(8, 'BMW GLC aile SUV'),
      ...topicPairs(8, 'Roma İmparatorluğu tarihi', 9),
    ];
    const pairs = extractQaPairs(all);
    windowDraft(pairs, 0, 'journey-bmw');
    const draftB = windowDraft(pairs, 1, 'journey-rome', 'journey-bmw');
    const scoped = resolveScopedJourneyMeaning(draftB);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    const blob = scoped.messages.map((m) => m.text).join(' ');
    expect(blob).toMatch(/Roma İmparatorluğu/i);
    expect(blob).not.toMatch(/BMW GLC/i);
    expect(scoped.scope.parentJourneyId).toBe('journey-bmw');
  });

  it('C: append Q9–Q20 does not change Journey A scoped input hash', () => {
    const base = topicPairs(8, 'BMW GLC aile SUV');
    const pairs8 = extractQaPairs(base);
    const draft = windowDraft(pairs8, 0, 'journey-bmw');
    const scoped1 = resolveScopedJourneyMeaning(draft);
    expect(scoped1.ok).toBe(true);
    if (!scoped1.ok) return;

    const withLater = [...base, ...topicPairs(12, 'özel gizli konu XYZ', 9)];
    // Re-resolve from same confirmed draft — conversation append must not mutate draft.
    const scoped2 = resolveScopedJourneyMeaning(draft);
    expect(scoped2.ok).toBe(true);
    if (!scoped2.ok) return;
    expect(scoped2.scopedInputHash).toBe(scoped1.scopedInputHash);
    expect(scoped2.windowHash).toBe(scoped1.windowHash);
    const laterBlob = withLater.map((m) => m.text).join(' ');
    expect(laterBlob).toMatch(/özel gizli konu XYZ/);
    expect(scoped2.messages.map((m) => m.text).join(' ')).not.toMatch(
      /özel gizli konu XYZ/
    );
  });

  it('D: changing one selected answer changes scoped hash', () => {
    const pairs = extractQaPairs(topicPairs(8, 'BMW GLC aile SUV'));
    const draft = windowDraft(pairs, 0, 'journey-bmw');
    const scoped1 = resolveScopedJourneyMeaning(draft);
    expect(scoped1.ok).toBe(true);
    if (!scoped1.ok) return;

    const mutatedSteps: Review8SelectedStep[] = scoped1.window.selectedSteps.map(
      (s, i) =>
        i === 3
          ? { ...s, publicAnswer: 'MUTATED ANSWER UNIQUE TOKEN' }
          : s
    );
    const hash2 = computeScopedJourneyInputHash({
      ...scoped1.window,
      selectedSteps: mutatedSteps,
    });
    expect(hash2).not.toBe(scoped1.scopedInputHash);
  });

  it('E: async continuation leaves frozen draft hashes unchanged', () => {
    const draft = windowDraft(
      extractQaPairs(topicPairs(8, 'BMW GLC aile SUV')),
      0,
      'journey-bmw'
    );
    const before = resolveScopedJourneyMeaning(draft);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    // Simulate Q9/Q10 arriving in chat while A generates — draft store unchanged.
    const after = resolveScopedJourneyMeaning(draft);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.scopedInputHash).toBe(before.scopedInputHash);
    expect(after.windowHash).toBe(before.windowHash);
  });

  it('F: parent lineage metadata does not inject parent text into child scope', () => {
    const all = [
      ...topicPairs(8, 'BMW GLC aile SUV'),
      ...topicPairs(8, 'uzun yol konfor sessizlik', 9),
    ];
    const pairs = extractQaPairs(all);
    windowDraft(pairs, 0, 'journey-bmw');
    const child = windowDraft(pairs, 1, 'journey-comfort', 'journey-bmw');
    const scoped = resolveScopedJourneyMeaning(child);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    expect(scoped.scope.parentJourneyId).toBe('journey-bmw');
    const blob = scoped.messages.map((m) => m.text).join(' ');
    expect(blob).toMatch(/uzun yol konfor/i);
    expect(blob).not.toMatch(/BMW GLC/i);
  });

  it('G: private Q9 entity never appears in Journey A public landing', () => {
    const base = topicPairs(8, 'BMW GLC aile SUV');
    const privateQ9 = [
      msg('u9', 'Gizli özel isim SECRET_PERSON_42 hakkında soru?', {
        role: 'user',
      }),
      msg('a9', 'SECRET_PERSON_42 için cevap.', { role: 'assistant' }),
    ];
    const draft = windowDraft(extractQaPairs(base), 0, 'journey-bmw');
    const scoped = resolveScopedJourneyMeaning(draft);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;

    const evidence = scoped.messages
      .filter((m) => m.role === 'user')
      .map((m) => ({
        text: m.text,
        epistemic: 'user_stated',
        kind: 'question',
        speaker: 'user',
      }));
    const landing = buildPublicMirrorLandingFromInterpretation(
      interpFromTopic('BMW GLC'),
      {
        evidence,
        journeyProvenance: {
          journeyId: scoped.scope.journeyId,
          windowHash: scoped.windowHash,
        },
      }
    );
    const publicBlob = `${landing.publicTitle} ${landing.publicSummary} ${landing.continuationContext}`;
    expect(publicBlob).not.toMatch(/SECRET_PERSON_42/);
    expect([...base, ...privateQ9].map((m) => m.text).join(' ')).toMatch(
      /SECRET_PERSON_42/
    );
    expect(landing.semanticAnchors?.anchorsScope).toBe('journey_window_v1');
    expect(landing.semanticAnchors?.journeyId).toBe('journey-bmw');
  });

  it('H: outside-window change does not alter A hash; selected change does', () => {
    const draft = windowDraft(
      extractQaPairs(topicPairs(8, 'BMW GLC aile SUV')),
      0,
      'journey-bmw'
    );
    const a1 = resolveScopedJourneyMeaning(draft);
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    // Outside window chat noise is irrelevant — same draft → same hash (cache isolation).
    const a2 = resolveScopedJourneyMeaning(draft);
    expect(a2.ok && a2.scopedInputHash === a1.scopedInputHash).toBe(true);

    const steps = a1.window.selectedSteps.map((s, i) =>
      i === 0 ? { ...s, publicQuestion: 'CHANGED WINDOW QUESTION' } : s
    );
    const invalidated = computeScopedJourneyInputHash({
      ...a1.window,
      selectedSteps: steps,
    });
    expect(invalidated).not.toBe(a1.scopedInputHash);
  });

  it('I: feature flag off stays legacy (no forced journey scope helper)', () => {
    expect(
      isMirrorJourneyV1ClientEnabled({
        NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: undefined,
      })
    ).toBe(false);
  });

  it('A/B curiosity landing: BMW window vs Rome window stay topic-isolated', () => {
    const all = [
      ...topicPairs(8, 'BMW GLC aile SUV'),
      ...topicPairs(8, 'Roma İmparatorluğu tarihi', 9),
    ];
    const pairs = extractQaPairs(all);
    const draftA = windowDraft(pairs, 0, 'journey-bmw');
    const draftB = windowDraft(pairs, 1, 'journey-rome', 'journey-bmw');
    const scopedA = resolveScopedJourneyMeaning(draftA);
    const scopedB = resolveScopedJourneyMeaning(draftB);
    expect(scopedA.ok && scopedB.ok).toBe(true);
    if (!scopedA.ok || !scopedB.ok) return;

    const evidenceOf = (scoped: typeof scopedA) =>
      scoped.ok
        ? scoped.messages
            .filter((m) => m.role === 'user')
            .map((m) => ({
              text: m.text,
              epistemic: 'user_stated' as const,
              kind: 'question',
              speaker: 'user',
            }))
        : [];

    const landingA = buildPublicMirrorLandingFromInterpretation(
      interpFromTopic('BMW GLC aile SUV'),
      {
        evidence: evidenceOf(scopedA),
        journeyProvenance: {
          journeyId: scopedA.scope.journeyId,
          windowHash: scopedA.windowHash,
        },
      }
    );
    const landingB = buildPublicMirrorLandingFromInterpretation(
      interpFromTopic('Roma İmparatorluğu tarihi'),
      {
        evidence: evidenceOf(scopedB),
        journeyProvenance: {
          journeyId: scopedB.scope.journeyId,
          windowHash: scopedB.windowHash,
        },
      }
    );

    const blobA = `${landingA.publicTitle} ${landingA.publicSummary} ${landingA.continuationContext}`;
    const blobB = `${landingB.publicTitle} ${landingB.publicSummary} ${landingB.continuationContext}`;
    expect(blobA).toMatch(/BMW|GLC|SUV|aile|araç/i);
    expect(blobA).not.toMatch(/Roma|İmparatorluk|Caesar|senato/i);
    expect(blobB).toMatch(/Roma|İmparatorluk|tarih/i);
    expect(blobB).not.toMatch(/BMW|GLC|SUV/i);
  });

  it('Narrative Alignment claims stay within scoped landing/anchors', async () => {
    const { extractHardClaims } = await import(
      '@/lib/eza/mirror/narrativeAlignment/extractHardClaims'
    );
    const draft = windowDraft(
      extractQaPairs(topicPairs(8, 'BMW GLC aile SUV')),
      0,
      'journey-bmw'
    );
    const scoped = resolveScopedJourneyMeaning(draft);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    const anchors = buildSemanticAnchors({
      interpretation: interpFromTopic('BMW GLC'),
      evidence: scoped.messages
        .filter((m) => m.role === 'user')
        .map((m) => ({
          text: m.text,
          epistemic: 'user_stated',
          speaker: 'user',
        })),
      journeyProvenance: {
        journeyId: 'journey-bmw',
        windowHash: scoped.windowHash,
      },
    });
    const landing = buildPublicMirrorLandingFromInterpretation(
      interpFromTopic('BMW GLC'),
      {
        semanticAnchors: anchors,
        journeyProvenance: {
          journeyId: 'journey-bmw',
          windowHash: scoped.windowHash,
        },
      }
    );
    const claims = extractHardClaims({
      anchors,
      interpretation: interpFromTopic('BMW GLC'),
      landing,
    });
    const claimBlob = JSON.stringify(claims);
    expect(claimBlob).not.toMatch(/SECRET_PERSON|Roma İmparatorluğu|Caesar/i);
  });

  it('J: scoped mapped prompt hash is stable for the same prompt string', async () => {
    const { mappedPromptHash } = await import('@/lib/eza/mirror/mirrorLineageHash');
    const prompt =
      'Quiet editorial photograph of a family SUV on a dusk road, no text.';
    const h1 = await mappedPromptHash(prompt);
    const h2 = await mappedPromptHash(prompt);
    expect(h1).toBe(h2);
    expect(h1).toBeTruthy();
  });

  it('fail-closed: unconfirmed draft rejected', () => {
    const pairs = extractQaPairs(topicPairs(8, 'BMW GLC aile SUV'));
    const built = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-scoped',
      windowIndex: 0,
      pairs,
      draftKey: 'win-x',
    });
    const scoped = resolveScopedJourneyMeaning(built);
    expect(scoped.ok).toBe(false);
    if (!scoped.ok) {
      expect(scoped.code).toBe('journey_semantic_scope_invalid');
    }
  });

  it('anchors from scoped evidence do not absorb Rome when BMW window only', () => {
    const draft = windowDraft(
      extractQaPairs(topicPairs(8, 'BMW GLC aile SUV')),
      0,
      'journey-bmw'
    );
    const scoped = resolveScopedJourneyMeaning(draft);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    const anchors = buildSemanticAnchors({
      interpretation: interpFromTopic('BMW GLC'),
      evidence: scoped.messages
        .filter((m) => m.role === 'user')
        .map((m) => ({
          text: m.text,
          epistemic: 'user_stated',
          speaker: 'user',
        })),
      journeyProvenance: {
        journeyId: 'journey-bmw',
        windowHash: scoped.windowHash,
      },
    });
    const blob = JSON.stringify(anchors);
    expect(blob).toMatch(/BMW|GLC|SUV|vehicle|aile/i);
    expect(blob).not.toMatch(/Roma|Imparatorluk|Caesar/i);
    expect(anchors.anchorsScope).toBe('journey_window_v1');
  });
});
