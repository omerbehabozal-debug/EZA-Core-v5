/**
 * Narrative Alignment Phase 1 — Production Closure E2E (publish path).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createInjectedClaimDetector,
  NARRATIVE_ALIGNMENT_PUBLISH_ERROR,
  NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR,
} from '@/lib/eza/mirror/narrativeAlignment';
import { buildPublicMirrorLandingFromInterpretation } from '@/lib/eza/mirror-network/publicMirrorLanding';
import { publishMirrorToNetwork } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { apiClient } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/lib/eza/mirror-share/resolveMirrorPublishLineage', () => ({
  resolveMirrorPublishLineage: () => ({
    lineageProofToken: null,
    guestToken: 'guest-token-abcdefghijklmnop',
  }),
}));

const suvInterp: MirrorInterpretationV1 = {
  title: 'Choosing the Right Family SUV',
  interpretationSummary: 'X3 vs GLC sessizlik ve konfor.',
  rationale: 'Compare',
  imageIntent: 'Showroom choice.',
  visualNarrative: 'A modern car showroom with BMW X3 and Mercedes GLC.',
  atmosphereHint: 'calm',
  topicCategory: 'vehicle',
  confidence: 0.9,
};

const suvEvidence = [
  { text: 'BMW X3', epistemic: 'user_stated', kind: 'entity' },
  { text: 'Mercedes GLC', epistemic: 'user_stated', kind: 'entity' },
];

const mardinInterp: MirrorInterpretationV1 = {
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary: 'Yerel mahalle hissi.',
  rationale: 'Local',
  imageIntent: 'Quiet dusk.',
  visualNarrative: 'Yellow-stone street with wooden chair and tea.',
  atmosphereHint: 'quiet',
  topicCategory: 'travel',
  confidence: 0.88,
};

const mardinEvidence = [
  { text: 'Mardin', epistemic: 'user_stated', kind: 'entity' },
  { text: 'tahta sandalye', epistemic: 'user_stated', kind: 'entity' },
];

function buildCard(interp: MirrorInterpretationV1, evidence: typeof suvEvidence): DailyMirrorCardModel {
  const landing = buildPublicMirrorLandingFromInterpretation(interp, {
    evidence,
    locale: 'tr',
  });
  return {
    date: '2026-08-08',
    headline: 'ignore-v3',
    mirrorFinalInterpretation: interp,
    mirrorSemanticSource: 'd2_interpretation',
    visual: {
      prompt: 'VISUAL NARRATIVE:\nshowroom or street',
      negativePrompt: 'text',
      seedHint: 'mirror',
      stylePreset: 'eza_mirror_professional_v1',
      qualityHints: [],
      promptContract: 'mirror-v5-prompt-contract',
      topicLabel: 'x',
    },
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
          primaryTopic: 'x',
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
}

describe('Narrative Alignment Production Closure E2E', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      slug: 'aligned-slug',
      shareUrl: 'https://saina.app/m/aligned-slug',
      cardTitle: 'aligned',
      publicTitle: 'aligned',
      publicSummary: 'summary',
    });
  });

  it('first image FAIL → second PASS → exactly one publish', async () => {
    const card = buildCard(suvInterp, suvEvidence);
    const titleBefore = card.mirrorV3Payload!.curiosityBundle!.publicLanding!.publicTitle;
    let detectN = 0;
    let regenN = 0;

    const result = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/fail.png',
      generationId: 'gen-1',
      narrativeAlignment: {
        detectClaims: createInjectedClaimDetector(() => {
          detectN += 1;
          if (detectN === 1) return [{ type: 'object', value: 'generic SUV' }];
          return [
            { type: 'product', value: 'BMW X3' },
            { type: 'product', value: 'Mercedes GLC' },
            { type: 'setting', value: 'showroom' },
          ];
        }),
        regenerateScene: async () => {
          regenN += 1;
          return {
            sceneImageUrl: 'https://cdn.example/mirror-scene-assets/pass.png',
            sceneAssetId: 'pass.png',
          };
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(regenN).toBe(1);
    expect(vi.mocked(apiClient.post)).toHaveBeenCalledTimes(1);
    const body = vi.mocked(apiClient.post).mock.calls[0][1]?.body as {
      sceneImageUrl: string;
      intelligencePrivate: {
        intelligenceBrief: {
          mirrorLineage: {
            narrativeAlignment?: { verificationState: string; retryAttempt: number };
            publicLandingHash?: string;
            interpretationHash?: string;
          };
        };
      };
      curiosityBundle: { publicLanding: { publicTitle: string; publicSummary: string } };
    };
    expect(body.sceneImageUrl).toContain('pass.png');
    expect(body.curiosityBundle.publicLanding.publicTitle).toBe(titleBefore);
    expect(body.intelligencePrivate.intelligenceBrief.mirrorLineage.narrativeAlignment)
      .toMatchObject({
        verificationState: 'verified_pass',
        retryAttempt: 1,
      });
  });

  it('two FAILs → no publish', async () => {
    const card = buildCard(suvInterp, suvEvidence);
    const result = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/fail.png',
      narrativeAlignment: {
        detectClaims: createInjectedClaimDetector([{ type: 'object', value: 'generic SUV' }]),
        regenerateScene: async () => ({
          sceneImageUrl: 'https://cdn.example/fail2.png',
        }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(NARRATIVE_ALIGNMENT_PUBLISH_ERROR);
    }
    expect(vi.mocked(apiClient.post)).not.toHaveBeenCalled();
  });

  it('vision unavailable → no publish (fail-safe)', async () => {
    const card = buildCard(suvInterp, suvEvidence);
    const result = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/any.png',
      narrativeAlignment: {
        detectClaims: async () => ({ detectedClaims: [], source: 'unavailable' }),
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(NARRATIVE_ALIGNMENT_UNAVAILABLE_ERROR);
      expect(result.narrativeAlignment?.verificationState).toBe('verification_unavailable');
    }
    expect(vi.mocked(apiClient.post)).not.toHaveBeenCalled();
  });

  it('Yeni Sahne preserves semantic hashes across scenes', async () => {
    const card = buildCard(suvInterp, suvEvidence);

    const passDetect = createInjectedClaimDetector([
      { type: 'product', value: 'BMW X3' },
      { type: 'product', value: 'Mercedes GLC' },
      { type: 'setting', value: 'showroom' },
    ]);

    const a = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/a.png',
      generationAction: 'new_scene',
      narrativeAlignment: { detectClaims: passDetect },
    });
    const b = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/b.png',
      generationAction: 'new_scene',
      narrativeAlignment: { detectClaims: passDetect },
    });

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.lineage?.interpretationHash).toBe(b.lineage?.interpretationHash);
    expect(a.lineage?.publicLandingHash).toBe(b.lineage?.publicLandingHash);
    expect(a.narrativeAlignment?.anchorsHash).toBe(b.narrativeAlignment?.anchorsHash);
    expect(a.narrativeAlignment?.anchorsHash).toBeTruthy();
    expect(a.lineage?.sceneAssetId).not.toBe(b.lineage?.sceneAssetId);
  });

  it('Aynayı Güncelle uses new semantic hashes', async () => {
    const oldCard = buildCard(mardinInterp, mardinEvidence);
    const newCard = buildCard(suvInterp, suvEvidence);
    const passMardin = createInjectedClaimDetector([{ type: 'place', value: 'Mardin' }]);
    const passSuv = createInjectedClaimDetector([
      { type: 'product', value: 'BMW X3' },
      { type: 'product', value: 'Mercedes GLC' },
      { type: 'setting', value: 'showroom' },
    ]);

    const oldPub = await publishMirrorToNetwork({
      card: oldCard,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/mardin.png',
      generationAction: 'update',
      narrativeAlignment: { detectClaims: passMardin },
    });
    const newPub = await publishMirrorToNetwork({
      card: newCard,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/suv.png',
      generationAction: 'update',
      narrativeAlignment: { detectClaims: passSuv },
    });

    expect(oldPub.ok && newPub.ok).toBe(true);
    if (!oldPub.ok || !newPub.ok) return;
    expect(oldPub.lineage?.interpretationHash).not.toBe(newPub.lineage?.interpretationHash);
    expect(oldPub.lineage?.publicLandingHash).not.toBe(newPub.lineage?.publicLandingHash);
    expect(oldPub.narrativeAlignment?.anchorsHash).not.toBe(
      newPub.narrativeAlignment?.anchorsHash
    );
  });

  it('landing copy never changes to fit a failed image', async () => {
    const card = buildCard(suvInterp, suvEvidence);
    const landing = card.mirrorV3Payload!.curiosityBundle!.publicLanding!;
    const title = landing.publicTitle;
    const summary = landing.publicSummary;

    const result = await publishMirrorToNetwork({
      card,
      sceneImageUrl: 'https://cdn.example/bad.png',
      narrativeAlignment: {
        detectClaims: createInjectedClaimDetector([]),
        regenerateScene: async () => ({ sceneImageUrl: 'https://cdn.example/bad2.png' }),
      },
    });

    expect(result.ok).toBe(false);
    expect(landing.publicTitle).toBe(title);
    expect(landing.publicSummary).toBe(summary);
    expect(result.narrativeAlignment?.missingClaims?.length).toBeGreaterThan(0);
    expect(vi.mocked(apiClient.post)).not.toHaveBeenCalled();
  });
});
