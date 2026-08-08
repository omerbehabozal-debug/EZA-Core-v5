import { describe, expect, it } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import {
  SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY,
  SAFE_PUBLIC_LANDING_FALLBACK_TITLE,
  safePublicLandingCopy,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import { MIRROR_PUBLIC_LANDING_CONTRACT_VERSION } from '@/lib/eza/mirror-network/publicMirrorLanding';

function baseCard(overrides: Partial<DailyMirrorCardModel> = {}): DailyMirrorCardModel {
  return {
    date: '2026-08-06',
    dayLabel: '6 Ağustos',
    headline: 'Gece Garaj Işığı',
    characterName: 'Karar Veren',
    personaFamilyId: 'decision_direction',
    shortInsight: 'Seçenekleri yan yana koydun.',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: 'orta',
    confidence: 'yüksek',
    energyLabel: 'odak',
    energyScore: 72,
    shareEnabled: true,
    privacyText: '',
    storyTensionSummary: 'BMW X3 ile Mercedes GLC arasında kaldın.',
    quote: 'V3 quote must not win',
    mirrorStory: 'V3 mirror story must not win',
    visual: {
      characterId: 'x',
      characterName: 'x',
      personaFamilyId: 'decision_direction',
      topicLabel: 'vehicle',
      atmosphereLabel: 'garage',
      emotionLabel: 'focus',
      prompt: 'test',
      negativePrompt: '',
      stylePreset: 'editorial',
      seedHint: '1',
      sceneImageUrl: 'https://example.com/scene.jpg',
    },
    ...overrides,
  };
}

const D2_INTERP = {
  title: 'Choosing the Right Family SUV',
  interpretationSummary: 'Two family SUVs under showroom light, a quiet decision.',
  rationale: 'User compared BMW X3 and Mercedes GLC for family use.',
  imageIntent: 'A stranger should feel a calm showroom choice, not a sales collage.',
  visualNarrative:
    'Inside a modern car showroom, two SUVs are parked side by side under cool ceiling lights.',
  exclusions: ['collage'],
  confidence: 0.9,
  topicCategory: 'vehicle',
};

describe('resolveMirrorPublicPreview', () => {
  it('uses safe unavailable copy — never V3 headline or story tension', () => {
    const preview = resolveMirrorPublicPreview(baseCard(), null);
    expect(preview.title).toBe(SAFE_PUBLIC_LANDING_FALLBACK_TITLE);
    expect(preview.summary).toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
    expect(preview.title).not.toBe('Gece Garaj Işığı');
    expect(preview.summary).not.toContain('BMW X3');
    expect(preview.sceneImageUrl).toBe('https://example.com/scene.jpg');
  });

  it('prefers explicit scene url argument', () => {
    const preview = resolveMirrorPublicPreview(baseCard(), 'https://cdn.example/live.png');
    expect(preview.sceneImageUrl).toBe('https://cdn.example/live.png');
  });

  it('prefers published Discover landing over V3 headline after remount', () => {
    const preview = resolveMirrorPublicPreview(
      baseCard({
        mirrorShare: {
          blueprint: {
            shareVoice: 'quiet_editorial_minimal',
            tone: 'editorial',
            invitationStyle: 'own_journey',
          },
          shareVoice: { text: '', preset: 'quiet_editorial_minimal' },
          shareUrl: 'https://saina.app/m/family-suv',
          networkSlug: 'family-suv',
          publicTitle: 'Choosing the Right Family SUV',
          publicSummary:
            'Inside a modern car showroom, two SUVs are parked side by side.',
        },
      }),
      null
    );
    expect(preview.title).toBe('Choosing the Right Family SUV');
    expect(preview.summary).toContain('car showroom');
  });

  it('builds from D2 interpretation when present', () => {
    const preview = resolveMirrorPublicPreview(
      baseCard({
        mirrorFinalInterpretation: D2_INTERP,
        mirrorSemanticSource: 'd2_interpretation',
      }),
      null
    );
    expect(preview.title).toBe('Choosing the Right Family SUV');
    expect(preview.summary.toLowerCase()).toContain('showroom');
    expect(preview.summary).not.toContain('BMW X3 ile Mercedes');
  });

  it('published parity — published landing wins over live D2', () => {
    const preview = resolveMirrorPublicPreview(
      baseCard({
        mirrorFinalInterpretation: D2_INTERP,
        mirrorShare: {
          blueprint: {
            shareVoice: 'quiet_editorial_minimal',
            tone: 'editorial',
            invitationStyle: 'own_journey',
          },
          shareVoice: { text: '', preset: 'quiet_editorial_minimal' },
          shareUrl: 'https://saina.app/m/published',
          networkSlug: 'published',
          publicTitle: 'Published Title Wins',
          publicSummary: 'Published summary from Discover payload.',
        },
      }),
      null
    );
    expect(preview.title).toBe('Published Title Wins');
    expect(preview.summary).toContain('Published summary');
  });

  it('stale V3 headline cannot win when D2 landing is on curiosityBundle', () => {
    const preview = resolveMirrorPublicPreview(
      baseCard({
        headline: 'Stale V3 Headline',
        storyTensionSummary: 'Stale V3 tension',
        mirrorV3Payload: {
          mirrorTitle: 'Stale V3',
          mirrorText: '',
          topic: 'vehicle',
          curiosityBundle: {
            seed: {
              primaryTopic: 'SUV',
              topicCategory: 'vehicle',
              mood: 'comparison',
              subtopics: [],
              curiosityHooks: [],
              seedQuestions: [],
              locale: 'tr',
            },
            cardTitle: 'D2 Bundle Title',
            coreCuriosity: 'x',
            curiosityContext: { text: 'D2 bundle summary about the showroom choice.' },
            hooks: [],
            landingContext: 'D2 bundle summary about the showroom choice.',
            seedQuestions: [],
            discoverySignals: [],
            collectionTags: [],
            semanticSource: 'd2_interpretation',
            publicLanding: {
              publicTitle: 'D2 Bundle Title',
              publicSummary:
                'Inside a quiet showroom, two family SUVs wait under soft lights while a decision settles.',
              continuationContext: 'Continue this curiosity.',
              topicCategory: 'vehicle',
              semanticSource: 'd2_interpretation',
              interpretationHash: 'abc',
              contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
            },
          },
        } as DailyMirrorCardModel['mirrorV3Payload'],
      }),
      null
    );
    expect(preview.title).toBe('D2 Bundle Title');
    expect(preview.title).not.toBe('Stale V3 Headline');
    expect(preview.summary).toContain('showroom');
    expect(preview.summary).not.toContain('Stale V3');
  });

  it('semantic D2 without landing stays safe unavailable', () => {
    const preview = resolveMirrorPublicPreview(
      baseCard({
        mirrorSemanticSource: 'd2_interpretation',
      }),
      null
    );
    expect(preview.title).toBe(SAFE_PUBLIC_LANDING_FALLBACK_TITLE);
    expect(preview.summary).toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
  });

  it('locale-aware safe fallback for en', () => {
    const en = safePublicLandingCopy('en');
    const preview = resolveMirrorPublicPreview(
      baseCard({
        mirrorV3Payload: {
          mirrorTitle: 'x',
          mirrorText: '',
          topic: 'general_curiosity',
          curiosityBundle: {
            seed: {
              primaryTopic: 'x',
              topicCategory: 'general_curiosity',
              mood: 'discovery',
              subtopics: [],
              curiosityHooks: [],
              seedQuestions: [],
              locale: 'en',
            },
            cardTitle: 'x',
            coreCuriosity: 'x',
            curiosityContext: { text: 'x' },
            hooks: [],
            landingContext: 'x',
            seedQuestions: [],
            discoverySignals: [],
            collectionTags: [],
            semanticSource: 'safe_fallback',
          },
        } as DailyMirrorCardModel['mirrorV3Payload'],
      }),
      null
    );
    expect(preview.title).toBe(en.title);
    expect(preview.summary).toBe(en.summary);
  });
});
