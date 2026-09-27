/**
 * Yansı summary as curiosity trailer — not a conclusion spoiler.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCuriosityCard,
  buildCuriosityTrailerSummary,
  composeCompleteTitle,
  endsIncompletely,
} from '@/lib/eza/mirror/curiosityBuilder';
import { buildSemanticAnchors } from '@/lib/eza/mirror/semanticAnchors';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { SemanticAnchorEvidenceItem } from '@/lib/eza/mirror/semanticAnchors/types';

const CONCLUSION_LEAK =
  /gösteriyor|ortaya koyuyor|sonuç olarak|belirlediğini|asıl neden|kararı\s+.+\s+belirle/i;

/** Meta anti-spoiler / summarizer-strategy language — must never reach the reader. */
const META_ANTI_SPOILER_LEAK =
  /cevabı\s+kilitlemeden|cevabı\s+vermeden|sonucu\s+söylemeden|spoiler\s+vermeden|merakı\s+koruyarak|açık\s+uç\s+bırakarak|sonucu\s+açıklamadan|cevabı\s+açık\s+etmeden|without\s+(closing|locking|settling)\s+(the\s+)?(answer|it|a\s+verdict)|rather\s+than\s+(delivering|locking)\s+(a\s+)?(verdict|answer)/i;

function adjacentEndingRepetition(summary: string): boolean {
  const sentences = summary
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/[.!?…]+$/g, '').trim())
    .filter(Boolean);
  if (sentences.length < 2) return false;
  const lemma = (s: string) => {
    const last = s.split(/\s+/).filter(Boolean).pop() || '';
    return last
      .toLowerCase()
      .replace(/[^a-zçğıöşüâîû]/gi, '')
      .replace(/(iyor|ıyor|uyor|üyor|mekte|makta)$/i, '');
  };
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = lemma(sentences[i]);
    const b = lemma(sentences[i + 1]);
    if (a && b && a === b) return true;
  }
  return false;
}

function assertTrailerShape(summary: string, title: string) {
  expect(summary.trim().length).toBeGreaterThan(24);
  expect(endsIncompletely(summary.replace(/[.!?…]+$/g, ''))).toBe(false);
  expect(summary).not.toMatch(/\S{20,}\s*$/); // no mid-word orphan via hard cut at end
  expect(CONCLUSION_LEAK.test(summary)).toBe(false);
  expect(META_ANTI_SPOILER_LEAK.test(summary)).toBe(false);
  expect(adjacentEndingRepetition(summary)).toBe(false);
  // First sentence should not merely restate the title.
  const first = summary.split(/[.!?…]/)[0] || '';
  const titleNorm = title.toLowerCase().replace(/[^a-z0-9çğıöşüâîû\s]/gi, ' ');
  const firstNorm = first.toLowerCase().replace(/[^a-z0-9çğıöşüâîû\s]/gi, ' ');
  expect(firstNorm.trim()).not.toBe(titleNorm.trim());
  const sentenceEnds = (summary.match(/[.!?…](\s|$)/g) || []).length;
  expect(sentenceEnds).toBeGreaterThanOrEqual(1);
  expect(sentenceEnds).toBeLessThanOrEqual(3);
}

function anchorsFrom(
  interpretation: MirrorInterpretationV1,
  evidence: SemanticAnchorEvidenceItem[],
  overrides?: Partial<MirrorSemanticAnchorsV1>
): MirrorSemanticAnchorsV1 {
  return {
    ...buildSemanticAnchors({
      interpretation,
      evidence,
      locale: 'tr',
    }),
    ...overrides,
  };
}

describe('curiosity trailer summary (not conclusion)', () => {
  it('A: childhood dreams — trailer with selected dimensions, no spoiler', () => {
    const interpretation: MirrorInterpretationV1 = {
      title: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
      interpretationSummary:
        'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı his ve konforun belirlediğini gösteriyor.',
      rationale: 'Childhood dreams vs present life.',
      imageIntent: 'Reflective path between then and now.',
      visualNarrative: 'A quiet room where old notebooks meet today’s calendar.',
      atmosphereHint: 'reflective',
      topicCategory: 'general_curiosity',
      confidence: 0.88,
    };
    const selectedEvidence: SemanticAnchorEvidenceItem[] = [
      { text: 'meslek', epistemic: 'user_stated', kind: 'preference' },
      { text: 'başarı', epistemic: 'user_stated', kind: 'preference' },
      { text: 'para', epistemic: 'user_stated', kind: 'preference' },
      { text: 'zaman', epistemic: 'user_stated', kind: 'preference' },
      { text: 'his', epistemic: 'user_stated', kind: 'preference' },
      { text: 'konfor', epistemic: 'user_stated', kind: 'preference' },
    ];
    const excludedEvidence: SemanticAnchorEvidenceItem[] = [
      { text: 'uzay kolonisi', epistemic: 'user_stated', kind: 'preference' },
      { text: 'kripto trading', epistemic: 'user_stated', kind: 'preference' },
    ];

    const anchors = anchorsFrom(interpretation, selectedEvidence, {
      topic: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
      question:
        'Çocukken hayal ettiğimiz hayatı mı yaşıyoruz?',
      decisionCriteria: ['meslek', 'başarı', 'para', 'zaman'],
      scene: ['eski defter', 'bugünün takvimi'],
    });

    const title = composeCompleteTitle(
      anchors.question || '',
      'tr',
      'meslek, başarı, para',
      {
        topic: anchors.topic,
        question: anchors.question,
        interpretationSummary: interpretation.interpretationSummary,
      }
    );

    const oldSpoilerBehavior = interpretation.interpretationSummary;
    expect(CONCLUSION_LEAK.test(oldSpoilerBehavior)).toBe(true);

    const card = buildCuriosityCard({
      anchors,
      interpretation,
      locale: 'tr',
    });
    expect(card.publicTitle.length).toBeGreaterThan(10);
    expect(card.publicTitle).not.toMatch(/^His,\s*konfor/i);
    assertTrailerShape(card.publicSummary, card.publicTitle);
    expect(card.publicSummary.toLowerCase()).toMatch(
      /meslek|başarı|para|zaman/
    );
    expect(card.publicSummary.toLowerCase()).toMatch(
      /hayal|yaşam|hayat|çocuk|mesafe|soru/
    );
    expect(card.publicSummary.toLowerCase()).not.toMatch(
      /uzay kolonisi|kripto/
    );

    // Report sample — actual generated trailer
    expect(card.publicTitle).toBeTruthy();
    expect(card.publicSummary).toBeTruthy();

    // Excluded Review themes must not appear when not in selected anchors.
    const landing = buildPublicMirrorLandingFromInterpretation(interpretation, {
      evidence: selectedEvidence,
      semanticAnchors: anchors,
      locale: 'tr',
    });
    expect(landing.publicSummary.toLowerCase()).not.toMatch(
      /uzay kolonisi|kripto trading/
    );
    assertTrailerShape(landing.publicSummary, landing.publicTitle);

    // Keep excluded out of a parallel card built without those dims.
    const withExcluded = buildCuriosityCard({
      anchors: anchorsFrom(interpretation, [...selectedEvidence, ...excludedEvidence], {
        decisionCriteria: ['meslek', 'başarı', 'para', 'zaman'],
        scene: ['eski defter'],
      }),
      interpretation,
      locale: 'tr',
    });
    // Even if evidence list is wider, trailer dimensions come from anchors we pass —
    // force scene/criteria without excluded labels:
    expect(withExcluded.publicSummary.toLowerCase()).not.toMatch(/uzay kolonisi/);
  });

  it('B: different topic (Mardin) stays trailer, not verdict', () => {
    const interpretation: MirrorInterpretationV1 = {
      title: "Mardin'de Sessiz Bir Akşam",
      interpretationSummary:
        'Turistik rotalardan uzak mahalle hissinin asıl çekim olduğunu gösteriyor.',
      rationale: 'Local quiet street.',
      imageIntent: 'Quiet local dusk.',
      visualNarrative: 'Sarı taşlı sokakta tahta sandalye ve çay.',
      atmosphereHint: 'quiet, local',
      topicCategory: 'travel',
      confidence: 0.85,
    };
    const card = buildCuriosityCard({
      anchors: anchorsFrom(interpretation, [
        { text: 'Mardin', epistemic: 'user_stated', kind: 'entity' },
        { text: 'çay', epistemic: 'user_stated', kind: 'entity' },
        { text: 'tahta sandalye', epistemic: 'user_stated', kind: 'entity' },
      ]),
      interpretation,
      locale: 'tr',
    });
    assertTrailerShape(card.publicSummary, card.publicTitle);
    expect(card.publicSummary.toLowerCase()).toMatch(
      /mardin|çay|sandalye|yerel|turist|sessiz|mahalle/
    );
  });

  it.each([6, 7, 8] as const)(
    'C–E: %i selected-step dimensions still produce a trailer',
    (n) => {
      const dims = [
        'meslek',
        'başarı',
        'para',
        'zaman',
        'aile',
        'özgürlük',
        'şehir',
        'huzur',
      ].slice(0, n);
      const interpretation: MirrorInterpretationV1 = {
        title: 'Hayaller ile bugün',
        interpretationSummary:
          'Hayaller ile bugün arasındaki fark, kararı konforun belirlediğini gösteriyor.',
        rationale: 'n-step fixture',
        imageIntent: 'Open path.',
        visualNarrative: 'A desk with open notebooks.',
        atmosphereHint: 'open',
        topicCategory: 'general_curiosity',
        confidence: 0.8,
      };
      const evidence = dims.map((text) => ({
        text,
        epistemic: 'user_stated' as const,
        kind: 'preference' as const,
      }));
      const card = buildCuriosityCard({
        anchors: anchorsFrom(interpretation, evidence, {
          decisionCriteria: dims.slice(0, Math.min(4, dims.length)),
          scene: dims.slice(0, 2),
          question: 'Hayaller ile bugün arasında ne değişti?',
          topic: 'Hayaller ile bugünkü yaşam',
        }),
        interpretation,
        locale: 'tr',
      });
      assertTrailerShape(card.publicSummary, card.publicTitle);
      expect(dims.some((d) => card.publicSummary.toLowerCase().includes(d))).toBe(
        true
      );
    }
  );

  it('F: excluded Review Q/A themes do not leak into summary', () => {
    const interpretation: MirrorInterpretationV1 = {
      title: 'İş ve denge',
      interpretationSummary:
        'İş ve denge üzerine konuşmak, asıl nedenin para olduğunu gösteriyor.',
      rationale: 'Work balance.',
      imageIntent: 'Office dusk.',
      visualNarrative: 'A laptop closing at dusk.',
      atmosphereHint: 'tired',
      topicCategory: 'finance',
      confidence: 0.8,
    };
    const selected = ['iş yükü', 'mola', 'aile zamanı'];
    const excluded = ['uzay kolonisi', 'formula 1 takımı'];
    const trailer = buildCuriosityTrailerSummary({
      anchors: {
        contractVersion: 'mirror-semantic-anchors-v1',
        place: null,
        scene: selected.slice(0, 2),
        emotion: ['yorgun'],
        topic: 'İş ve denge',
        userIntent: 'Daha dengeli bir tempo',
        decisionCriteria: selected,
        question: 'İş ile hayat dengesi nasıl kurulur?',
        anchorsHash: 'work-balance',
        evidenceCount: 3,
      },
      title: 'İş ve denge',
      interpretationSummary: interpretation.interpretationSummary,
      locale: 'tr',
      variant: 0,
    });
    assertTrailerShape(trailer, 'İş ve denge');
    for (const ex of excluded) {
      expect(trailer.toLowerCase()).not.toContain(ex);
    }
    for (const sel of selected.slice(0, 2)) {
      expect(trailer.toLowerCase()).toContain(sel.toLowerCase());
    }
  });

  it('G: no meta anti-spoiler language; no adjacent ending repetition', () => {
    const interpretation: MirrorInterpretationV1 = {
      title: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
      interpretationSummary:
        'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı his ve konforun belirlediğini gösteriyor.',
      rationale: 'meta guard',
      imageIntent: 'Reflective.',
      visualNarrative: 'Notebooks.',
      atmosphereHint: 'soft',
      topicCategory: 'general_curiosity',
      confidence: 0.9,
    };
    const card = buildCuriosityCard({
      anchors: anchorsFrom(
        interpretation,
        [
          { text: 'meslek', epistemic: 'user_stated', kind: 'preference' },
          { text: 'başarı', epistemic: 'user_stated', kind: 'preference' },
          { text: 'para', epistemic: 'user_stated', kind: 'preference' },
          { text: 'zaman', epistemic: 'user_stated', kind: 'preference' },
        ],
        {
          topic: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
          question: 'Çocukken hayal ettiğimiz hayatı mı yaşıyoruz?',
          decisionCriteria: ['meslek', 'başarı', 'para', 'zaman'],
          scene: [],
        }
      ),
      interpretation,
      locale: 'tr',
    });
    expect(META_ANTI_SPOILER_LEAK.test(card.publicSummary)).toBe(false);
    expect(adjacentEndingRepetition(card.publicSummary)).toBe(false);
    expect(card.publicSummary).not.toMatch(/\bilerliyor\.\s+\S.*\bilerliyor\b/i);
    expect(CONCLUSION_LEAK.test(card.publicSummary)).toBe(false);
  });

  it('childhood fixture: report actual NEW summary from generation path', () => {
    const interpretation: MirrorInterpretationV1 = {
      title: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
      interpretationSummary:
        'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark, kararı his ve konforun belirlediğini gösteriyor.',
      rationale: 'report sample',
      imageIntent: 'Reflective.',
      visualNarrative: 'Notebooks and a calendar.',
      atmosphereHint: 'soft',
      topicCategory: 'general_curiosity',
      confidence: 0.9,
    };
    const card = buildCuriosityCard({
      anchors: anchorsFrom(
        interpretation,
        [
          { text: 'meslek', epistemic: 'user_stated', kind: 'preference' },
          { text: 'başarı', epistemic: 'user_stated', kind: 'preference' },
          { text: 'para', epistemic: 'user_stated', kind: 'preference' },
          { text: 'zaman', epistemic: 'user_stated', kind: 'preference' },
        ],
        {
          topic: 'Çocukken kurduğumuz hayaller ile bugünkü yaşam arasındaki fark',
          question: 'Çocukken hayal ettiğimiz hayatı mı yaşıyoruz?',
          decisionCriteria: ['meslek', 'başarı', 'para', 'zaman'],
          scene: [],
        }
      ),
      interpretation,
      locale: 'tr',
    });
    // eslint-disable-next-line no-console — intentional report capture for forensic return
    console.log(
      JSON.stringify({
        title: card.publicTitle,
        oldSummaryBehavior: interpretation.interpretationSummary,
        newSummary: card.publicSummary,
      })
    );
    expect(card.publicSummary).toMatch(/meslek|başarı|para|zaman/i);
    expect(card.publicSummary.toLowerCase()).toMatch(
      /hayal|yaşam|hayat|çocuk|mesafe/
    );
    expect(CONCLUSION_LEAK.test(card.publicSummary)).toBe(false);
    expect(META_ANTI_SPOILER_LEAK.test(card.publicSummary)).toBe(false);
    expect(adjacentEndingRepetition(card.publicSummary)).toBe(false);
  });
});
