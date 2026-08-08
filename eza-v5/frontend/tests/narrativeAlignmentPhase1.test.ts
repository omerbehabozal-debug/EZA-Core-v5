/**
 * Narrative Alignment Phase 1 — claim extract, match, publish gate.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  claimsEquivalent,
  createInjectedClaimDetector,
  extractHardClaims,
  matchClaims,
  runNarrativeAlignment,
  runNarrativeAlignmentPublishGate,
  NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
} from '@/lib/eza/mirror/narrativeAlignment';
import { buildSemanticAnchors } from '@/lib/eza/mirror/semanticAnchors';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import { publishMirrorToNetwork } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { apiClient } from '@/lib/apiClient';

const suvInterp: MirrorInterpretationV1 = {
  title: 'Choosing the Right Family SUV',
  interpretationSummary:
    'Aile için X3 ile GLC arasında sessizlik ve konfor üzerinden karar.',
  rationale: 'Compare two SUVs',
  imageIntent: 'Showroom choice by cabin feel.',
  visualNarrative:
    'A modern car showroom aisle where BMW X3 and Mercedes GLC face a quiet decision.',
  atmosphereHint: 'calm',
  topicCategory: 'vehicle',
  confidence: 0.9,
};

const suvEvidence = [
  { text: 'BMW X3', epistemic: 'user_stated', kind: 'entity' },
  { text: 'Mercedes GLC', epistemic: 'user_stated', kind: 'entity' },
  { text: 'sessizlik', epistemic: 'user_stated', kind: 'preference' },
];

const mardinInterp: MirrorInterpretationV1 = {
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary: 'Turistik rotalardan uzakta mahalle hissi.',
  rationale: 'Local evening',
  imageIntent: 'Quiet local dusk.',
  visualNarrative:
    'A yellow-stone street at dusk with a wooden chair, tea glass, laundry line, and a distant minaret.',
  atmosphereHint: 'quiet, local',
  topicCategory: 'travel',
  confidence: 0.88,
};

const mardinEvidence = [
  { text: 'Mardin', epistemic: 'user_stated', kind: 'entity' },
  { text: 'tahta sandalye', epistemic: 'user_stated', kind: 'entity' },
  { text: 'çay', epistemic: 'user_stated', kind: 'entity' },
  { text: 'minare', epistemic: 'user_stated', kind: 'entity' },
  { text: 'çamaşır ipleri', epistemic: 'user_stated', kind: 'entity' },
];

function buildLanding(interp: MirrorInterpretationV1, evidence: typeof suvEvidence) {
  return buildPublicMirrorLandingFromInterpretation(interp, {
    evidence,
    locale: 'tr',
  });
}

describe('Narrative Alignment Phase 1', () => {
  it('BMW PASS when both brands + showroom detected', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const anchors = landing.semanticAnchors!;
    const extracted = extractHardClaims({
      anchors,
      interpretation: suvInterp,
      landing,
    });
    expect(extracted.requiredClaims.some((c) => /bmw|x3/i.test(c.value))).toBe(true);
    expect(extracted.requiredClaims.some((c) => /mercedes|glc/i.test(c.value))).toBe(true);
    expect(extracted.requiredClaims.some((c) => c.type === 'setting')).toBe(true);
    expect(extracted.softClaims.join(' ')).toMatch(/calm|sessizlik|quiet|konfor|comfort/i);

    const { result } = await runNarrativeAlignment({
      anchors,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/bmw-pass.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'vehicle_brand', value: 'BMW' },
        { type: 'product', value: 'BMW X3' },
        { type: 'vehicle_brand', value: 'Mercedes-Benz' },
        { type: 'product', value: 'Mercedes GLC' },
        { type: 'setting', value: 'car showroom' },
      ]),
    });
    expect(result.status).toBe('PASS');
    expect(result.missingClaims).toHaveLength(0);
  });

  it('BMW generic SUV FAIL — does not match brand claims', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const { result } = await runNarrativeAlignment({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/generic-suv.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'object', value: 'generic SUV' },
        { type: 'setting', value: 'parking lot' },
      ]),
    });
    expect(result.status).toBe('FAIL');
    expect(result.missingClaims.length).toBeGreaterThan(0);
    expect(claimsEquivalent('BMW', 'generic SUV')).toBe(false);
  });

  it('Mardin PASS with place + supporting objects detected', async () => {
    const landing = buildLanding(mardinInterp, mardinEvidence);
    const anchors = landing.semanticAnchors!;
    expect(anchors.place?.toLowerCase()).toContain('mardin');

    const { result } = await runNarrativeAlignment({
      anchors,
      interpretation: mardinInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/mardin-pass.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'place', value: 'Mardin' },
        { type: 'setting', value: 'stone street' },
        { type: 'object', value: 'wooden chair' },
        { type: 'object', value: 'tea glass' },
        { type: 'landmark', value: 'minaret' },
      ]),
    });
    expect(result.status).toBe('PASS');
  });

  it('Mardin atrium FAIL — missing place cues', async () => {
    const landing = buildLanding(mardinInterp, mardinEvidence);
    const { result } = await runNarrativeAlignment({
      anchors: landing.semanticAnchors!,
      interpretation: mardinInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/atrium.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'setting', value: 'modern glass atrium' },
        { type: 'object', value: 'spiral staircase' },
      ]),
    });
    expect(result.status).toBe('FAIL');
    expect(result.missingClaims.some((c) => c.type === 'place')).toBe(true);
  });

  it('soft emotion missing does not fail', () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const extracted = extractHardClaims({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
    });
    const matched = matchClaims({
      extracted,
      detectedClaims: [
        { type: 'product', value: 'BMW X3' },
        { type: 'product', value: 'Mercedes GLC' },
        { type: 'setting', value: 'showroom' },
      ],
    });
    // soft calm/comfort not in detected — still PASS if required met
    expect(matched.status).toBe('PASS');
    expect(extracted.softClaims.length).toBeGreaterThan(0);
  });

  it('alias matching: Mercedes-Benz ↔ Mercedes, tea glass ↔ çay', () => {
    expect(claimsEquivalent('Mercedes-Benz', 'Mercedes')).toBe(true);
    expect(claimsEquivalent('tea glass', 'çay')).toBe(true);
    expect(claimsEquivalent('minaret', 'mosque minaret')).toBe(true);
    expect(claimsEquivalent('BMW', 'SUV')).toBe(false);
  });

  it('supporting claims missing do not fail publish match', () => {
    const landing = buildLanding(mardinInterp, mardinEvidence);
    const extracted = extractHardClaims({
      anchors: landing.semanticAnchors!,
      interpretation: mardinInterp,
      landing,
    });
    // Only satisfy required (typically place); leave supporting objects undetected
    const requiredOnly = matchClaims({
      extracted,
      detectedClaims: [{ type: 'place', value: 'Mardin' }],
    });
    expect(requiredOnly.missingClaims.every((c) => c.importance === 'required')).toBe(true);
    if (extracted.supportingClaims.length > 0) {
      expect(requiredOnly.status).toBe(
        extracted.requiredClaims.every((c) =>
          requiredOnly.matchedClaims.some((m) => m.key === c.key)
        )
          ? 'PASS'
          : 'FAIL'
      );
    }
  });

  it('first FAIL then second PASS via regenerate', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    let attempt = 0;
    const detector = createInjectedClaimDetector(() => {
      attempt += 1;
      if (attempt === 1) {
        return [{ type: 'object', value: 'generic SUV' }];
      }
      return [
        { type: 'product', value: 'BMW X3' },
        { type: 'product', value: 'Mercedes GLC' },
        { type: 'setting', value: 'showroom' },
      ];
    });

    const gate = await runNarrativeAlignmentPublishGate({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/fail.png',
      detectClaims: detector,
      regenerateScene: async () => ({
        sceneImageUrl: 'https://cdn.example/mirror-scene-assets/pass-scene.png',
        sceneAssetId: 'pass-scene.png',
      }),
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.sceneImageUrl).toContain('pass-scene');
      expect(gate.alignment.retryAttempt).toBe(1);
      expect(gate.alignment.verificationState).toBe('verified_pass');
      expect(gate.landingSnapshot.publicTitle).toBe(landing.publicTitle);
      expect(gate.landingSnapshot.publicSummary).toBe(landing.publicSummary);
    }
  });

  it('vision unavailable → fail-safe block (not silent PASS)', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const gate = await runNarrativeAlignmentPublishGate({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/any.png',
      detectClaims: async () => ({ detectedClaims: [], source: 'unavailable' }),
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.code).toBe('narrative_alignment_verification_unavailable');
      expect(gate.observability.verificationState).toBe('verification_unavailable');
      expect(gate.observability.alignmentStatus).toBe('UNAVAILABLE');
    }
  });

  it('vision unavailable + allowDegraded → publish allowed with UNAVAILABLE state', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const gate = await runNarrativeAlignmentPublishGate({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/any.png',
      detectClaims: async () => ({ detectedClaims: [], source: 'unavailable' }),
      allowDegradedPublishWhenUnavailable: true,
    });
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.degradedVerification).toBe(true);
      expect(gate.observability.verificationState).toBe('verification_unavailable');
    }
  });

  it('two FAILs → publish blocked', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const gate = await runNarrativeAlignmentPublishGate({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/fail1.png',
      detectClaims: createInjectedClaimDetector([{ type: 'object', value: 'generic SUV' }]),
      regenerateScene: async () => ({
        sceneImageUrl: 'https://cdn.example/fail2.png',
      }),
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.code).toBe(NARRATIVE_ALIGNMENT_PUBLISH_ERROR);
      expect(gate.attempts).toBe(2);
      expect(gate.landingSnapshot.publicTitle).toBe(landing.publicTitle);
    }
  });

  it('landing text is never rewritten to match bad image', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const titleBefore = landing.publicTitle;
    const summaryBefore = landing.publicSummary;
    const gate = await runNarrativeAlignmentPublishGate({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/bad.png',
      detectClaims: createInjectedClaimDetector([]),
    });
    expect(gate.ok).toBe(false);
    expect(gate.landingSnapshot.publicTitle).toBe(titleBefore);
    expect(gate.landingSnapshot.publicSummary).toBe(summaryBefore);
    expect(landing.publicTitle).toBe(titleBefore);
  });

  it('V3 fields cannot affect claim extraction', () => {
    const anchors = buildSemanticAnchors({
      interpretation: suvInterp,
      evidence: suvEvidence,
    });
    const landing = {
      publicTitle: 'BMW X3 mü Mercedes GLC mi?',
      publicSummary: 'Aile SUV’sinde asıl ayrım sessizlik.',
    };
    const extracted = extractHardClaims({ anchors, interpretation: suvInterp, landing });
    const labels = extracted.requiredClaims.map((c) => c.value).join(' ');
    expect(labels).not.toMatch(/Cephe malzemesi|facade_material|vehicle_compare/);
  });

  it('Yeni Sahne: meaning hashes stable across sceneAssetId change', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const anchorsHash = landing.semanticAnchors!.anchorsHash;
    const a = await runNarrativeAlignment({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/scene-a.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'product', value: 'BMW X3' },
        { type: 'product', value: 'Mercedes GLC' },
        { type: 'setting', value: 'showroom' },
      ]),
      interpretationHash: 'interp-same',
      publicLandingHash: 'landing-same',
      sceneAssetId: 'scene-a.png',
    });
    const b = await runNarrativeAlignment({
      anchors: landing.semanticAnchors!,
      interpretation: suvInterp,
      landing,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/scene-b.png',
      detectClaims: createInjectedClaimDetector([
        { type: 'product', value: 'BMW X3' },
        { type: 'product', value: 'Mercedes GLC' },
        { type: 'setting', value: 'showroom' },
      ]),
      interpretationHash: 'interp-same',
      publicLandingHash: 'landing-same',
      sceneAssetId: 'scene-b.png',
    });
    expect(a.result.anchorsHash).toBe(anchorsHash);
    expect(b.result.anchorsHash).toBe(anchorsHash);
    expect(a.result.interpretationHash).toBe(b.result.interpretationHash);
    expect(a.result.publicLandingHash).toBe(b.result.publicLandingHash);
    expect(a.result.sceneAssetId).not.toBe(b.result.sceneAssetId);
  });

  it('Aynayı Güncelle uses new anchors hash for new meaning', () => {
    const oldLanding = buildLanding(mardinInterp, mardinEvidence);
    const newLanding = buildLanding(suvInterp, suvEvidence);
    expect(oldLanding.semanticAnchors!.anchorsHash).not.toBe(
      newLanding.semanticAnchors!.anchorsHash
    );
    expect(oldLanding.publicTitle).not.toBe(newLanding.publicTitle);
  });

  it('publishMirrorToNetwork blocks when alignment FAIL (opt-in)', async () => {
    const landing = buildLanding(suvInterp, suvEvidence);
    const card = {
      date: '2026-08-08',
      headline: 'ignore',
      mirrorFinalInterpretation: suvInterp,
      mirrorV3Payload: {
        mirrorTitle: 'ignore',
        mirrorText: '',
        topic: 'vehicle',
        curiosityBundle: {
          cardTitle: landing.publicTitle,
          coreCuriosity: '',
          curiosityContext: { text: landing.publicSummary },
          hooks: [],
          seedQuestions: [],
          discoverySignals: [],
          collectionTags: [],
          seed: {
            primaryTopic: 'vehicle',
            topicCategory: 'vehicle',
            mood: 'comparison',
            subtopics: [],
            curiosityHooks: [],
            seedQuestions: [],
            locale: 'tr',
          },
          publicLanding: landing,
          semanticSource: 'd2_interpretation',
        },
      },
    } as DailyMirrorCardModel;

    const postSpy = vi.spyOn(apiClient, 'post');
    const result = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/bad.png',
      narrativeAlignment: {
        detectClaims: createInjectedClaimDetector([{ type: 'object', value: 'generic SUV' }]),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(NARRATIVE_ALIGNMENT_PUBLISH_ERROR);
    }
    expect(postSpy).not.toHaveBeenCalled();
    postSpy.mockRestore();
  });
});
