import { describe, expect, it } from 'vitest';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import {
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
  type PublicMirrorLanding,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import {
  assertSamePublicSurfaceIdentity,
  resolveMirrorPublicSurfaceIdentity,
} from '@/lib/eza/mirror-share/mirrorPublicSurfaceIdentity';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const INTERP = {
  title: 'Mardin Terrace Evening',
  interpretationSummary: 'A quiet courtyard decision at amber hour.',
  rationale: 'User lingered on stone, chair, and clothesline in Mardin.',
  imageIntent: 'A stranger should feel a lived terrace pause, not tourism.',
  visualNarrative:
    'A yellow-stone courtyard at dusk with a wooden chair and a clothesline, distant minaret beyond the terrace edge.',
  exclusions: ['collage'],
  confidence: 0.92,
  topicCategory: 'travel',
};

describe('mirrorPublicSurfaceIdentity', () => {
  it('preview / discover / landing / share share the same meaning identity', () => {
    const built = buildCuriosityFromInterpretation(INTERP);
    const landing: PublicMirrorLanding = {
      ...built.publicLanding,
      publicLandingHash: 'landing-hash-1',
    };

    const previewCard = {
      date: '2026-08-06',
      headline: 'Stale V3 Must Not Appear',
      storyTensionSummary: 'V3 tension',
      mirrorFinalInterpretation: INTERP,
      mirrorSemanticSource: 'd2_interpretation',
      mirrorShare: {
        blueprint: {
          shareVoice: 'quiet_editorial_minimal',
          tone: 'editorial',
          invitationStyle: 'own_journey',
        },
        shareVoice: { text: '', preset: 'quiet_editorial_minimal' },
        shareUrl: 'https://saina.app/m/mardin-terrace',
        networkSlug: 'mardin-terrace',
        publicTitle: landing.publicTitle,
        publicSummary: landing.publicSummary,
      },
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

    const preview = resolveMirrorPublicPreview(previewCard, 'https://cdn.example/scene-a.png');
    const previewIdentity = resolveMirrorPublicSurfaceIdentity({
      landing: {
        publicTitle: preview.title,
        publicSummary: preview.summary,
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        interpretationHash: landing.interpretationHash,
        semanticSource: 'd2_interpretation',
        publicLandingHash: 'landing-hash-1',
      },
      slug: 'mardin-terrace',
      sceneImageUrl: preview.sceneImageUrl,
    });

    const discoverIdentity = resolveMirrorPublicSurfaceIdentity({
      landing,
      slug: 'mardin-terrace',
      sceneImageUrl: 'https://cdn.example/scene-a.png',
      publicLandingHash: 'landing-hash-1',
    });

    const shareIdentity = resolveMirrorPublicSurfaceIdentity({
      landing,
      slug: 'mardin-terrace',
      sceneImageUrl: 'https://cdn.example/scene-b.png', // Yeni Sahne
      publicLandingHash: 'landing-hash-1',
    });

    assertSamePublicSurfaceIdentity(previewIdentity, discoverIdentity);
    assertSamePublicSurfaceIdentity(discoverIdentity, shareIdentity);
    expect(shareIdentity.sceneImageUrl).not.toBe(discoverIdentity.sceneImageUrl);
  });

  it('throws when meaning fields diverge', () => {
    const a = resolveMirrorPublicSurfaceIdentity({
      landing: {
        publicTitle: 'A',
        publicSummary: 'Summary A',
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        interpretationHash: 'h1',
        semanticSource: 'd2_interpretation',
      },
      slug: 'x',
    });
    const b = resolveMirrorPublicSurfaceIdentity({
      landing: {
        publicTitle: 'B',
        publicSummary: 'Summary A',
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        interpretationHash: 'h1',
        semanticSource: 'd2_interpretation',
      },
      slug: 'x',
    });
    expect(() => assertSamePublicSurfaceIdentity(a, b)).toThrow(
      /public_surface_identity_mismatch:publicTitle/
    );
  });
});
