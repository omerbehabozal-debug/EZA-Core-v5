import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishMirrorToNetwork } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import { completeJourneyGenerationLineageSeal } from '@/lib/eza/mirror/journey/completeJourneyGenerationLineageSeal';
import { runNarrativeAlignmentPublishGate } from '@/lib/eza/mirror/narrativeAlignment/publishGate';
import { canonicalMirrorSceneAssetIdFromUrl } from '@/lib/eza/mirror/sceneAssetIdentity';
import type { JourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: apiMocks,
}));

vi.mock('@/lib/standaloneChatArchive', () => ({
  getChatArchive: vi.fn(() => null),
}));

vi.mock('@/lib/eza/mirror-network/guestToken', () => ({
  getOrCreateMirrorGuestToken: vi.fn(() => 'guest-token-abcdefghijklmnop'),
}));

const ASSET = 'a5cdb1be-12f9-40b9-bf29-9be992dea36a';
const ASSET_B = 'b40de21e-40a0-40e7-ab7e-bd39fce2c761';
const SCENE_URL = `https://api.ezacore.ai/api/public/mirror-scene-assets/${ASSET}.png?cache=1`;

function steps() {
  return Array.from({ length: 8 }, (_, index) => ({
    stepIndex: index + 1,
    sourceOrder: index,
    sourceUserMessageId: `u-${index}`,
    sourceAssistantMessageId: `a-${index}`,
    publicQuestion: `Soru ${index + 1}?`,
    publicAnswer: `Yanıt ${index + 1}.`,
  }));
}

function lineage(overrides: Partial<JourneyGenerationLineage> = {}): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: 'journey-scene-contract',
    journeyVersion: 1,
    sourceConversationId: 'chat-scene-contract',
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: 'window-hash',
    sourceBlockHash: 'source-block-hash',
    scopedInputHash: 'scoped-input-hash',
    selectedStepsHash: 'selected-steps-hash',
    interpretationHash: 'interpretation-hash',
    publicLandingHash: 'public-landing-hash',
    mappedPromptHash: 'mapped-prompt-hash',
    generationId: 'generation-scene-contract',
    sceneAssetId: `${ASSET}.png`,
    selectedSteps: steps(),
    sealedAt: '2026-09-28T00:00:00.000Z',
    ...overrides,
  };
}

function card(overrides: Partial<JourneyGenerationLineage> = {}) {
  return {
    date: '2026-09-28',
    headline: 'Kişilik ve Değişim',
    mirrorJourneyGenerationLineage: lineage(overrides),
    mirrorV3Payload: {
      mirrorTitle: 'Kişilik ve Değişim',
      mirrorText: 'private',
      topic: 'identity',
      curiosityBundle: {
        semanticSource: 'd2_interpretation',
        publicLanding: {
          publicTitle: 'Kişilik ve Değişim',
          publicSummary: 'Değişim hissinin kişilikte bıraktığı iz.',
          continuationContext: 'Bu değişim sende neyi görünür kılıyor?',
          contractVersion: 'mirror-public-landing-v1',
          semanticSource: 'd2_interpretation',
        },
        cardTitle: 'Kişilik ve Değişim',
      },
    },
  } as any;
}

describe('canonical Yansı scene identity contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.post.mockResolvedValue({
      ok: true,
      data: {
        ok: true,
        slug: 'kisilik-ve-degisim',
        shareUrl: 'https://saina.app/m/kisilik-ve-degisim',
        cardTitle: 'Kişilik ve Değişim',
      },
    });
  });

  it('derives canonical UUID stem from supported Mirror scene URLs', () => {
    expect(canonicalMirrorSceneAssetIdFromUrl(SCENE_URL)).toBe(ASSET);
    expect(
      canonicalMirrorSceneAssetIdFromUrl(
        `/api/public/mirror-scene-assets/${ASSET.toUpperCase()}.PNG`
      )
    ).toBe(ASSET);
    expect(
      canonicalMirrorSceneAssetIdFromUrl(
        `https://api.ezacore.ai/api/public/mirror-scene-assets/${ASSET_B}.jpg`
      )
    ).toBe(ASSET_B);
    expect(canonicalMirrorSceneAssetIdFromUrl(`https://cdn.example/${ASSET}.png`)).toBe(ASSET);
  });

  it('seals new READY lineage with UUID stem instead of filename', async () => {
    const sealed = await completeJourneyGenerationLineageSeal({
      card: card({ sceneAssetId: `${ASSET}.png` }),
      sceneImageUrl: SCENE_URL,
      generationId: 'generation-scene-contract',
      ownerUserId: 'user-scene-contract',
    });
    expect(sealed.mirrorJourneyGenerationLineage?.sceneAssetId).toBe(ASSET);
  });

  it('publishes historical READY lineage using canonical flat and nested sceneAssetId', async () => {
    await publishMirrorToNetwork({
      card: card({ sceneAssetId: `${ASSET}.png` }),
      conversationId: 'chat-scene-contract',
      ownerUserId: 'user-scene-contract',
      journeyId: 'journey-scene-contract',
      sceneImageUrl: SCENE_URL,
    });

    const body = apiMocks.post.mock.calls[0][1]?.body as any;
    expect(body.sceneAssetId).toBe(ASSET);
    expect(body.journeyGenerationLineage.sceneAssetId).toBe(ASSET);
    expect(body.sceneAssetId).not.toBe(`${ASSET}.png`);
  });

  it('Narrative Alignment observability uses UUID stem for historical filename ids', async () => {
    const result = await runNarrativeAlignmentPublishGate({
      anchors: {
        contractVersion: 'mirror-semantic-anchors-v1',
        place: null,
        scene: [],
        emotion: [],
        topic: null,
        userIntent: null,
        decisionCriteria: [],
        question: null,
        anchorsHash: 'anchors-empty',
        evidenceCount: 0,
      },
      landing: {
        publicTitle: 'Kişilik ve Değişim',
        publicSummary: 'Değişim hissinin kişilikte bıraktığı iz.',
      },
      sceneImageUrl: SCENE_URL,
      sceneAssetId: `${ASSET}.png`,
      detectClaims: vi.fn(async () => ({
        detectedClaims: [],
        source: 'injected',
      })),
      allowDegradedPublishWhenUnavailable: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sceneAssetId).toBe(ASSET);
      expect(result.observability.sceneAssetId).toBe(ASSET);
    }
  });
});
