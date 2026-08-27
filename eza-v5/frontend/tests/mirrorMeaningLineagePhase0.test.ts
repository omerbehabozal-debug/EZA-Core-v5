import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyDirectorPrepareToCard } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import { buildMirrorCuriosityPipeline } from '@/lib/eza/mirror-network/buildMirrorCuriosity';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import {
  publishMirrorToNetwork,
  resolvePublishCuriosityBundle,
} from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { buildShareBlueprint } from '@/lib/eza/mirror-share/buildShareBlueprint';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';

const MARDIN_INTERPRETATION: MirrorInterpretationV1 = {
  version: 'mirror-interpretation-v1',
  title: 'Quiet Moments in Mardin',
  interpretationSummary:
    'This Mirror captures the essence of exploring Mardin old city, focusing on local life away from tourist crowds.',
  rationale:
    'The scene reflects the desire for an authentic neighborhood walk with yellow stone, chairs, and a distant minaret.',
  imageIntent:
    'A stranger should feel curiosity and tranquility, wanting to explore quiet corners of Mardin.',
  visualNarrative:
    "In the heart of Mardin's old city, a narrow cobblestone street winds between ancient yellow stone houses. A wooden chair sits outside one home, with a clothesline stretching above. In the distance, a mosque minaret rises against a soft sunset sky.",
  exclusions: ['modern buildings', 'tourist crowds', 'stock imagery'],
  confidence: 0.9,
  topicCategory: 'travel',
  atmosphereHint: 'serene and inviting',
};

const ARCH_V3_PAYLOAD = {
  mirrorTitle: 'Malzeme Dokusu',
  mirrorText: 'internal only',
  sceneMetaphor: 'stone facade light',
  topic: 'architecture',
  storyTopicId: 'architecture',
  safetyLevel: 'normal',
  conversationEvidence: [
    { label: 'Malzeme ve oran', visualHint: 'facade stone light', weight: 1 },
  ],
  pipelineVersion: 'v3',
  refinementVersion: '5.0',
} as unknown as SainaMirrorV3Payload;

function buildCardWithStaleArchitectureCuriosity(): DailyMirrorCardModel {
  const pipeline = buildMirrorCuriosityPipeline(ARCH_V3_PAYLOAD);
  expect(pipeline.semanticSource).toBe('legacy_v3_fallback');
  expect(pipeline.seed.topicCategory).toBe('architecture');
  expect(pipeline.hooks.some((h) => /Taş ve ışık/i.test(h))).toBe(true);

  return {
    date: '2026-07-25',
    dayLabel: '25 Temmuz',
    headline: 'Malzeme Dokusu',
    characterName: 'biligN',
    personaFamilyId: 'balanced_calm',
    shortInsight: '',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: '',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    visual: {
      prompt: 'VISUAL NARRATIVE:\nMardin yellow stone street with chair and clothesline',
      negativePrompt: 'text',
      seedHint: 'mardin-test',
      stylePreset: 'eza_mirror_professional_v1',
      qualityHints: [],
      promptContract: MIRROR_V5_PROMPT_CONTRACT,
      topicLabel: 'travel',
    },
    mirrorV3Payload: { ...ARCH_V3_PAYLOAD, curiosityBundle: pipeline },
    mirrorShare: {
      blueprint: buildShareBlueprint(pipeline, 'architecture stone'),
      shareVoice: pipeline.shareVoice!,
      shareUrl: null,
    },
  };
}

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(() => null),
}));

vi.mock('@/lib/eza/mirror-network/guestToken', () => ({
  getOrCreateMirrorGuestToken: vi.fn(() => 'guest-token-abcdefghijklmnop'),
}));

import { apiClient } from '@/lib/apiClient';

describe('Phase 0 — D2 publish meaning lineage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('Mardin D2 interpretation publishes travel/local-life meaning, not architecture/material', () => {
    const built = buildCuriosityFromInterpretation(MARDIN_INTERPRETATION);
    expect(built.semanticSource).toBe('d2_interpretation');
    expect(built.bundle.seed.topicCategory).toBe('travel');
    expect(built.bundle.cardTitle).toMatch(/Mardin/i);
    expect(built.bundle.cardTitle).not.toMatch(/Choosing the Right|architecture/i);
    expect(built.bundle.collectionTags.join(' ')).not.toMatch(/architecture/);
    expect(built.bundle.hooks.join(' ')).not.toMatch(/Taş ve ışık bir cephede/i);
    expect(built.bundle.curiosityContext.text).not.toMatch(/mimari malzeme|Cephe malzemesi/i);
    expect(built.bundle.curiosityContext.text).not.toMatch(/güvenli bir giriş kapısıdır|sohbeti yeniden anlatmaz/i);
    expect(built.bundle.publicLanding?.publicSummary).toMatch(/Mardin|yerel|mahalle|turist|sessiz|stone|street/i);
    expect(built.bundle.seed.subtopics.some((s) => /sandalye|çamaşır|minare|sarı taş/i.test(s))).toBe(
      true
    );
  });

  it('applyDirectorPrepare rebuilds curiosity from D2 and overwrites stale V3 architecture bundle', () => {
    const card = buildCardWithStaleArchitectureCuriosity();
    const next = applyDirectorPrepareToCard(card, {
      directorEnabled: true,
      usedDirector: true,
      applyTitle: true,
      applyPrompt: true,
      directorMode: 'FULL',
      directorExecuted: true,
      directorAffectedOutput: true,
      mappedPrompt: {
        title: 'Quiet Moments in Mardin',
        topicCategory: 'travel',
        season: 'editorial_magazine',
        prompt: 'VISUAL NARRATIVE:\nyellow stone Mardin street',
        negativePrompt: 'modern buildings',
        promptContract: MIRROR_V5_PROMPT_CONTRACT,
        titleSource: 'interpretation_llm',
        artDirectionSource: 'interpretation_v1',
      },
      finalInterpretation: MARDIN_INTERPRETATION,
      metadata: {
        analysisSchemaVersion: 'mirror-interpretation-v1',
        draftSchemaVersion: 'mirror-interpretation-v1',
        reviewSchemaVersion: 'mirror-director-review-v1',
        analysisSource: 'interpretation_v1',
        draftSource: 'interpretation_llm',
        directorConfidence: 0.9,
        directorReasonCodes: [],
        revisionCount: 0,
        contentHash: 'abc123',
        topicCategory: 'travel',
      } as never,
    });

    expect(next.mirrorSemanticSource).toBe('d2_interpretation');
    expect(next.mirrorFinalInterpretation?.title).toBe('Quiet Moments in Mardin');
    expect(next.mirrorV3Payload?.curiosityBundle?.semanticSource).toBe('d2_interpretation');
    expect(next.mirrorV3Payload?.curiosityBundle?.seed.topicCategory).toBe('travel');
    expect(next.mirrorV3Payload?.curiosityBundle?.hooks.join(' ')).not.toMatch(
      /Taş ve ışık bir cephede/i
    );
    expect(next.headline).toMatch(/Mardin/i);
    expect(next.headline).not.toMatch(/Cephe|architecture/i);
  });

  it('V3 curiosity cannot override D2-backed publish metadata', async () => {
    const card = buildCardWithStaleArchitectureCuriosity();
    card.mirrorFinalInterpretation = MARDIN_INTERPRETATION;
    card.mirrorSemanticSource = 'd2_interpretation';

    const resolved = resolvePublishCuriosityBundle(card);
    expect(resolved.semanticSource).toBe('d2_interpretation');
    expect(resolved.bundle.seed.topicCategory).toBe('travel');
    expect(resolved.bundle.cardTitle).toMatch(/Mardin/i);

    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      slug: 'quiet-moments-in-mardin-abc',
      shareUrl: 'https://saina.app/m/quiet-moments-in-mardin-abc',
      cardTitle: 'Quiet Moments in Mardin',
    });

    const result = await publishMirrorToNetwork({
      card,
      conversationId: 'chat-mardin',
      sceneImageUrl:
        'https://api.ezacore.ai/api/public/mirror-scene-assets/a5cdb1be-12f9-40b9-bf29-9be992dea36a.png',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.semanticSource).toBe('d2_interpretation');
    expect(result.lineage?.sceneAssetId).toBe('a5cdb1be-12f9-40b9-bf29-9be992dea36a.png');
    expect(result.lineage?.interpretationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.lineage?.publishBundleHash).toMatch(/^[a-f0-9]{64}$/);

    const body = vi.mocked(apiClient.post).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(String(body.cardTitle)).toMatch(/Mardin/i);
    const curiosity = body.curiosityBundle as {
      seed: { topicCategory: string };
      hooks: string[];
      semanticSource: string;
      publicLanding?: {
        publicTitle: string;
        publicSummary: string;
        continuationContext: string;
        contractVersion: string;
        interpretationHash: string;
      };
    };
    expect(curiosity.semanticSource).toBe('d2_interpretation');
    expect(curiosity.seed.topicCategory).toBe('travel');
    expect(curiosity.hooks.join(' ')).not.toMatch(/Taş ve ışık bir cephede/i);
    expect(curiosity.publicLanding?.publicTitle).toMatch(/Mardin/i);
    expect(curiosity.publicLanding?.publicSummary).toBeTruthy();
    expect(curiosity.publicLanding?.continuationContext).toBeTruthy();
    expect(curiosity.publicLanding?.contractVersion).toBe('mirror-public-landing-v1');
    expect(curiosity.publicLanding?.interpretationHash).toBeTruthy();
    expect(result.lineage?.publicLandingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.lineage?.contractVersion).toBe('mirror-public-landing-v1');

    const intelligence = body.intelligencePrivate as {
      intelligenceBrief: { mirrorLineage: { semanticSource: string } };
    };
    expect(intelligence.intelligenceBrief.mirrorLineage.semanticSource).toBe('d2_interpretation');
  });

  it('legacy Mirror without D2 uses safe_fallback public landing (never evidence labels)', () => {
    const card = buildCardWithStaleArchitectureCuriosity();
    const resolved = resolvePublishCuriosityBundle(card);
    expect(resolved.semanticSource).toBe('safe_fallback');
    expect(resolved.bundle.semanticSource).toBe('safe_fallback');
    expect(resolved.bundle.publicLanding?.publicSummary).toMatch(/paylaşılan bir deneyim/i);
    expect(resolved.bundle.curiosityContext.text).not.toMatch(/Cephe malzemesi|mimari malzeme/i);
    expect(resolved.bundle.seed.subtopics).toEqual([]);
  });
});
