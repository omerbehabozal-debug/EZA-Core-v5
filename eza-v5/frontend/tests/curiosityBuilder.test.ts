import { describe, expect, it } from 'vitest';
import {
  buildCuriosityCard,
  curiosityCardFingerprint,
  runCuriosityClickTest,
} from '@/lib/eza/mirror/curiosityBuilder';
import { buildSemanticAnchors } from '@/lib/eza/mirror/semanticAnchors';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

const suvInterpretation: MirrorInterpretationV1 = {
  title: 'Choosing the Right Family SUV',
  interpretationSummary:
    'Aile için X3 ile GLC arasında sessizlik, uzun yol ve konfor üzerinden karar aranıyor.',
  rationale: 'User comparing two SUVs for family use.',
  imageIntent: 'Showroom choice framed by calm cabin feel, not brochure specs.',
  visualNarrative:
    'A modern showroom aisle where two compact luxury SUVs face a quiet decision.',
  atmosphereHint: 'calm, considered',
  topicCategory: 'vehicle_compare',
  confidence: 0.9,
};

const suvEvidence = [
  { text: 'BMW X3', epistemic: 'user_stated', kind: 'entity' },
  { text: 'Mercedes GLC', epistemic: 'user_stated', kind: 'entity' },
  { text: 'aile için SUV', epistemic: 'user_stated', kind: 'preference' },
  { text: 'sessizlik', epistemic: 'user_stated', kind: 'preference' },
  { text: 'uzun yol konforu', epistemic: 'user_stated', kind: 'preference' },
];

const mardinInterpretation: MirrorInterpretationV1 = {
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary: 'Turistik rotalardan uzakta mahalle hissini arıyor.',
  rationale: 'Local quiet street.',
  imageIntent: 'Quiet local dusk away from tourist routes.',
  visualNarrative: 'Sarı taşlı sokakta tahta sandalye ve çay.',
  atmosphereHint: 'quiet, local, slow',
  topicCategory: 'travel',
  confidence: 0.85,
};

const mardinEvidence = [
  { text: 'Mardin', epistemic: 'user_stated', kind: 'entity' },
  { text: 'tahta sandalye', epistemic: 'user_stated', kind: 'entity' },
  { text: 'çay', epistemic: 'user_stated', kind: 'entity' },
];

describe('Curiosity Builder + Click Test', () => {
  it('SUV anchors produce curiosity title, not blog/catalog title', () => {
    const anchors = buildSemanticAnchors({
      interpretation: suvInterpretation,
      evidence: suvEvidence,
      locale: 'tr',
    });
    expect(anchors.topic).toMatch(/BMW X3 vs Mercedes GLC/i);
    expect(anchors.decisionCriteria.join(' ')).toMatch(/sessizlik|konfor|uzun yol|aile/i);

    const card = buildCuriosityCard({
      anchors,
      interpretation: suvInterpretation,
      locale: 'tr',
    });
    expect(card.clickTestPassed).toBe(true);
    expect(card.publicTitle).toMatch(/X3|GLC|huzurlu|sportif|sessizlik/i);
    expect(card.publicTitle).not.toMatch(/Choosing the Right|Luxury SUV|Car Review/i);
    expect(card.publicSummary).not.toMatch(/^(Bu Mirror|This conversation|This content)/i);
    expect(card.publicSummary).not.toMatch(/insights|analysis|explores/i);
    expect(card.publicSummary.toLowerCase()).toMatch(/huzur|sessizlik|konfor|kabin|his/);
  });

  it('same Semantic Anchors → same curiosity fingerprint', () => {
    const anchors = buildSemanticAnchors({
      interpretation: suvInterpretation,
      evidence: suvEvidence,
      locale: 'tr',
    });
    const a = buildCuriosityCard({ anchors, interpretation: suvInterpretation, locale: 'tr' });
    const b = buildCuriosityCard({ anchors, interpretation: suvInterpretation, locale: 'tr' });
    expect(curiosityCardFingerprint(a)).toBe(curiosityCardFingerprint(b));
    expect(a.variant).toBe(b.variant);
  });

  it('landing uses Curiosity Builder — answers why enter, not scene inventory', () => {
    const landing = buildPublicMirrorLandingFromInterpretation(suvInterpretation, {
      evidence: suvEvidence,
      locale: 'tr',
    });
    expect(landing.publicTitle).not.toBe('Choosing the Right Family SUV');
    expect(landing.publicTitle).toMatch(/X3|GLC|huzurlu|sportif/i);
    expect(landing.publicSummary.toLowerCase()).not.toMatch(/^bu mirror|^this conversation/);
    expect(landing.semanticAnchors?.topic).toMatch(/X3|GLC/i);
  });

  it('Mardin card invites local evening curiosity without AI report tone', () => {
    const landing = buildPublicMirrorLandingFromInterpretation(mardinInterpretation, {
      evidence: mardinEvidence,
      locale: 'tr',
    });
    expect(landing.publicTitle).toMatch(/Mardin/i);
    expect(landing.publicTitle).not.toMatch(/^travel$/i);
    expect(landing.publicSummary.toLowerCase()).toMatch(/mardin|yerel|mahalle|turist|sessiz|çay|sandalye/);
    expect(runCuriosityClickTest(landing).passed).toBe(true);
  });

  it('Click Test rejects blog title + AI opening', () => {
    const fail = runCuriosityClickTest({
      publicTitle: 'Choosing the Right Family SUV',
      publicSummary: 'This conversation discusses decision making process and insights.',
    });
    expect(fail.passed).toBe(false);
    expect(fail.failures.join(' ')).toMatch(/blog_title|ai_opening|forbidden/);
  });

  it('does not ship Bu ayna product-meta titles or mechanical etiketten summaries', () => {
    const sleepInterpretation: MirrorInterpretationV1 = {
      title: 'Bu ayna uykunun kalitesi ve süresinin',
      interpretationSummary:
        'Bu ayna uykunun kalitesi ve süresinin insanların dinlenmiş hissetmesi — ilginç tarafı, his ve konforun düzgün bir etiketten daha ağır basması',
      rationale: 'Sleep quality versus duration.',
      imageIntent: 'A dim bedroom at night with a quiet phone glow.',
      visualNarrative:
        'A still bedroom where sleep is interrupted by a faint screen in the dark.',
      atmosphereHint: 'tired, dim, nocturnal',
      topicCategory: 'health',
      confidence: 0.8,
    };
    const landing = buildPublicMirrorLandingFromInterpretation(sleepInterpretation, {
      evidence: [
        { text: '8 saat uyku', epistemic: 'user_stated', kind: 'preference' },
        { text: 'dinlenmiş uyanmak', epistemic: 'user_stated', kind: 'preference' },
      ],
      locale: 'tr',
    });
    expect(landing.publicTitle.toLowerCase()).not.toMatch(/^bu ayna/);
    expect(landing.publicSummary.toLowerCase()).not.toMatch(/^bu ayna/);
    expect(landing.publicSummary).not.toMatch(/düzgün bir etiket/i);
    expect(landing.publicSummary).not.toMatch(/ilginç tarafı/i);
    expect(landing.publicTitle.split(/\s+/).length).toBeGreaterThanOrEqual(3);
  });
});
