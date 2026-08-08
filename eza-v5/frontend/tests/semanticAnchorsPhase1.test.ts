import { describe, expect, it } from 'vitest';
import {
  buildSemanticAnchors,
  semanticAnchorsAreGrounded,
} from '@/lib/eza/mirror/semanticAnchors';
import {
  buildPublicMirrorLandingFromInterpretation,
  enrichSceneSentenceWithAnchors,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';

const mardinInterpretation: MirrorInterpretationV1 = {
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary: 'A quiet evening curiosity about living local Mardin streets.',
  rationale: 'User asked about authentic neighborhood feeling, not tourist routes.',
  imageIntent: 'A stranger should feel a slow, local dusk pause.',
  visualNarrative:
    'A quiet Mardin street at dusk with warm yellow stone walls and a soft evening breeze.',
  atmosphereHint: 'quiet, local, slow',
  topicCategory: 'travel',
  confidence: 0.82,
};

const mardinEvidence = [
  { text: 'Mardin', epistemic: 'user_stated', kind: 'entity', speaker: 'user' },
  { text: 'tahta sandalye', epistemic: 'user_stated', kind: 'entity', speaker: 'user' },
  { text: 'çay', epistemic: 'user_stated', kind: 'entity', speaker: 'user' },
  { text: 'çamaşır ipleri', epistemic: 'user_stated', kind: 'entity', speaker: 'user' },
  { text: 'minare', epistemic: 'user_stated', kind: 'entity', speaker: 'user' },
];

describe('Semantic Anchors Phase 1', () => {
  it('extracts place, scene props, and emotion from D2 + user_stated evidence', () => {
    const anchors = buildSemanticAnchors({
      interpretation: mardinInterpretation,
      evidence: mardinEvidence,
      locale: 'tr',
    });
    expect(anchors.contractVersion).toBe('mirror-semantic-anchors-v1');
    expect(anchors.place?.toLowerCase()).toContain('mardin');
    expect(anchors.scene.join(' ').toLowerCase()).toMatch(/sandalye|çay|çamaşır|minare/);
    expect(anchors.emotion.length).toBeGreaterThan(0);
    expect(anchors.anchorsHash).toMatch(/^[a-f0-9]{8}$/);
    expect(semanticAnchorsAreGrounded(anchors)).toBe(true);
  });

  it('attaches grounded anchors; Curiosity Builder landing invites without scene inventory', () => {
    const vague: MirrorInterpretationV1 = {
      ...mardinInterpretation,
      visualNarrative: 'A quiet evening street with warm light.',
      interpretationSummary: 'Curiosity about living a city slowly.',
    };
    const landing = buildPublicMirrorLandingFromInterpretation(vague, {
      evidence: mardinEvidence,
      locale: 'tr',
    });
    expect(landing.semanticAnchors?.place?.toLowerCase()).toContain('mardin');
    expect(landing.semanticAnchors?.scene.join(' ').toLowerCase()).toMatch(
      /sandalye|çay|çamaşır|minare/
    );
    expect(landing.publicTitle).toMatch(/Mardin/i);
    expect(landing.publicSummary.toLowerCase()).toMatch(/mardin|yerel|turist|mahalle|sessiz/);
    expect(landing.publicTitle).not.toMatch(/Choosing the Right|travel guide/i);
  });

  it('extracts topic / intent / criteria for Curiosity Builder', () => {
    const anchors = buildSemanticAnchors({
      interpretation: {
        title: 'Choosing the Right Family SUV',
        interpretationSummary: 'X3 vs GLC for family quiet long trips.',
        imageIntent: 'Calm cabin decision.',
        visualNarrative: 'Showroom aisle with two SUVs.',
        atmosphereHint: 'calm',
      },
      evidence: [
        { text: 'BMW X3', epistemic: 'user_stated', kind: 'entity' },
        { text: 'Mercedes GLC', epistemic: 'user_stated', kind: 'entity' },
        { text: 'sessizlik', epistemic: 'user_stated', kind: 'preference' },
        { text: 'uzun yol', epistemic: 'user_stated', kind: 'preference' },
      ],
    });
    expect(anchors.topic).toMatch(/BMW X3 vs Mercedes GLC/i);
    expect(anchors.decisionCriteria.join(' ')).toMatch(/sessizlik|uzun yol/i);
    expect(anchors.question || anchors.topic).toBeTruthy();
  });

  it('enrichSceneSentenceWithAnchors does not duplicate already-present props', () => {
    const anchors = buildSemanticAnchors({
      interpretation: mardinInterpretation,
      evidence: mardinEvidence,
    });
    const once = enrichSceneSentenceWithAnchors(
      'Mardin street with tahta sandalye and çay.',
      anchors
    );
    const twice = enrichSceneSentenceWithAnchors(once, anchors);
    expect(twice.toLowerCase().split('çay').length).toBeLessThanOrEqual(3);
  });

  it('ignores assistant_suggestion evidence for place/scene preference', () => {
    const anchors = buildSemanticAnchors({
      interpretation: {
        title: 'A Quiet Evening',
        interpretationSummary: 'A soft evening curiosity.',
        imageIntent: 'Feel calm dusk.',
        visualNarrative: 'A soft evening street under warm lamps.',
        atmosphereHint: 'calm',
      },
      evidence: [
        {
          text: 'Spiral Museum Glass Atrium',
          epistemic: 'assistant_suggestion',
          kind: 'entity',
        },
        { text: 'wooden chair', epistemic: 'user_stated', kind: 'entity' },
      ],
    });
    expect(anchors.scene.join(' ').toLowerCase()).toContain('wooden chair');
    expect(anchors.scene.join(' ').toLowerCase()).not.toContain('spiral');
  });
});
