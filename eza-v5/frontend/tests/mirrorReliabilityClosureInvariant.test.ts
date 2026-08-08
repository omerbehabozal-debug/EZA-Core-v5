/**
 * Mirror Reliability Closure — pure invariant fixture (no network).
 *
 * Documents LEGACY_V3 remaining intentional call sites — see also:
 * eza-v5/docs/mirror/reliability-closure-legacy-inventory.md
 */

import { describe, expect, it } from 'vitest';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import {
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
  safePublicLandingCopy,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import {
  assertSamePublicSurfaceIdentity,
  resolveMirrorPublicSurfaceIdentity,
} from '@/lib/eza/mirror-share/mirrorPublicSurfaceIdentity';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { interpretationHashSync } from '@/lib/eza/mirror/mirrorLineageHash';

/**
 * LEGACY_V3 inventory (intentional only):
 * - StandaloneObservationExperience: generationPipeline = conversationId ? D2_V5 : LEGACY_V3
 *   (Daily / no-conversation path)
 * - generateSceneApi types + backend schema allow explicit LEGACY_V3 discriminator
 * - d2FailClosedSceneGeneration.test.ts explicit LEGACY_V3 cases
 * - backend mirror_scene_prompt_guard / openai provider tests with explicit LEGACY_V3
 * - Daily path without conversationId must never be inferred — only explicit
 */

const INTERP = {
  title: 'Mardin Terrace Evening',
  interpretationSummary: 'A quiet courtyard decision at amber hour in Mardin.',
  rationale: 'User lingered on stone, chair, and clothesline.',
  imageIntent: 'A stranger should feel a lived terrace pause.',
  visualNarrative:
    'A yellow-stone courtyard at dusk with a wooden chair and a clothesline, distant minaret beyond the terrace edge.',
  exclusions: ['collage'],
  confidence: 0.92,
  topicCategory: 'travel',
};

describe('mirrorReliabilityClosureInvariant', () => {
  it('D2 interpretation → public landing → preview identity', () => {
    const built = buildCuriosityFromInterpretation(INTERP, { locale: 'tr' });
    const interpHash = interpretationHashSync(INTERP);
    expect(built.publicLanding.semanticSource).toBe('d2_interpretation');
    expect(built.publicLanding.interpretationHash).toBe(interpHash);

    const card = {
      date: '2026-08-06',
      headline: 'V3 Headline Must Not Win',
      storyTensionSummary: 'V3 story tension must not win',
      shortInsight: 'V3 insight',
      quote: 'V3 quote',
      mirrorStory: 'V3 story',
      mirrorFinalInterpretation: INTERP,
      mirrorSemanticSource: 'd2_interpretation',
      visual: {
        characterId: 'x',
        characterName: 'x',
        personaFamilyId: 'x',
        topicLabel: 'x',
        atmosphereLabel: 'x',
        emotionLabel: 'x',
        prompt: 'VISUAL NARRATIVE:\nstone',
        negativePrompt: '',
        stylePreset: 'x',
        seedHint: '1',
        sceneImageUrl: 'https://cdn.example/scene-a.png',
      },
    } as DailyMirrorCardModel;

    const preview = resolveMirrorPublicPreview(card, null);
    expect(preview.title).toBe(built.publicLanding.publicTitle);
    expect(preview.summary).toContain('yellow-stone');
    expect(preview.title).not.toBe('V3 Headline Must Not Win');
    expect(preview.summary).not.toContain('V3 story tension');

    const identity = resolveMirrorPublicSurfaceIdentity({
      landing: {
        ...built.publicLanding,
        publicLandingHash: 'plh-1',
      },
      slug: 'mardin-terrace',
      sceneImageUrl: preview.sceneImageUrl,
      publicLandingHash: 'plh-1',
    });
    expect(identity.publicTitle).toBe(preview.title);
    expect(identity.interpretationHash).toBe(interpHash);
    expect(identity.contractVersion).toBe(MIRROR_PUBLIC_LANDING_CONTRACT_VERSION);
  });

  it('V3 headline cannot appear when D2 landing present', () => {
    const built = buildCuriosityFromInterpretation(INTERP);
    const preview = resolveMirrorPublicPreview(
      {
        date: '2026-08-06',
        headline: 'Stale V3',
        storyTensionSummary: 'Stale tension',
        mirrorV3Payload: {
          mirrorTitle: 'Stale',
          mirrorText: '',
          topic: 'travel',
          curiosityBundle: built.bundle,
        },
      } as DailyMirrorCardModel,
      null
    );
    expect(preview.title).toBe(built.publicLanding.publicTitle);
    expect(preview.title).not.toBe('Stale V3');
  });

  it('Yeni Sahne: same interpretationHash/publicLandingHash, different sceneAssetId', () => {
    const built = buildCuriosityFromInterpretation(INTERP);
    const meaning = {
      ...built.publicLanding,
      publicLandingHash: 'same-landing-hash',
    };
    const first = resolveMirrorPublicSurfaceIdentity({
      landing: meaning,
      slug: 'mardin-terrace',
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/asset-a.png',
      publicLandingHash: 'same-landing-hash',
    });
    const second = resolveMirrorPublicSurfaceIdentity({
      landing: meaning,
      slug: 'mardin-terrace',
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/asset-b.png',
      publicLandingHash: 'same-landing-hash',
    });
    assertSamePublicSurfaceIdentity(first, second);
    expect(first.sceneImageUrl).not.toBe(second.sceneImageUrl);
  });

  it('safe fallback locale strings cover tr/en/ar', () => {
    expect(safePublicLandingCopy('tr').title).toBeTruthy();
    expect(safePublicLandingCopy('en').title).toMatch(/Shared|Curiosity/i);
    expect(safePublicLandingCopy('ar').title.length).toBeGreaterThan(1);
    expect(safePublicLandingCopy('en').summary).not.toBe(
      safePublicLandingCopy('tr').summary
    );
  });
});
