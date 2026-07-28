/**
 * Landing-v1 acceptance: new Mardin test conversation → full public surface chain.
 *
 * Pipeline under test (no production migration):
 * Conversation → V3 payload → D2 Interpretation → Prompt → Image URL
 * → Public Title/Summary → Discover card model → /m/{slug} landing surface
 *
 * Production migration is intentionally out of scope for this sprint.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConversationMirrorEntries } from '@/lib/eza/mirror/conversationMirrorEntries';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';
import { applyDirectorPrepareToCard } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import {
  FORBIDDEN_INTERNAL_LABELS,
  FORBIDDEN_PUBLIC_LANDING_PHRASES,
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import { pickMirrorLandingSurface } from '@/lib/eza/mirror-network/landingSurface';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';
import {
  publishMirrorToNetwork,
  resolvePublishCuriosityBundle,
} from '@/lib/eza/mirror-share/publishMirrorToNetwork';

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

/** Fresh Mardin chat — not the legacy aksam-rotasi production slug. */
const MARDIN_TEST_CONVERSATION = [
  {
    id: 'u1',
    text: 'Hiç Mardin’de oldun mu? Sarı taşlı sokaklarda, turistik yerlerden uzak mahallelerde dolaşmak istiyorum.',
    isUser: true,
    userScore: 88,
  },
  {
    id: 'a1',
    text: 'Mardin’de akşamüzeri sarı taş sokaklar ve uzak minare silueti çok sakin bir ritim kurar. Yerel bir mahalle köşesinde oturup şehri izlemek güzel bir başlangıç olabilir.',
    isUser: false,
    assistantScore: 91,
  },
  {
    id: 'u2',
    text: 'Tahta sandalyede çay içmek, çamaşır ipleri ve uzaktaki minare… Kalabalıktan uzak, yavaş bir akşam arıyorum.',
    isUser: true,
    userScore: 90,
  },
  {
    id: 'a2',
    text: 'O zaman rota haritadan önce yürüyerek hissedilen bir mahalle akşamına kayabilir: taş sokak, sandalye, çay ve sessiz bir köşe.',
    isUser: false,
    assistantScore: 92,
  },
  {
    id: 'u3',
    text: 'Turistik kartpostalardan uzak, sadece mahalle hissi. Bu Ayna’da o akşamı görmek isterim.',
    isUser: true,
    userScore: 89,
  },
  {
    id: 'a3',
    text: 'O zaman görüntü, sarı taş, sandalye ve uzaktaki minare ile o sakin mahalle akşamını tutsun.',
    isUser: false,
    assistantScore: 93,
  },
] as const;

const MARDIN_D2: MirrorInterpretationV1 = {
  version: 'mirror-interpretation-v1',
  title: "Mardin'de Sessiz Bir Akşam",
  interpretationSummary:
    "Turistik rotalardan uzakta Mardin'in mahalle hissini ve sakin bir çay anını arıyor.",
  rationale:
    'User seeks a quiet local Mardin evening with yellow stone streets, tea, chair, laundry, and distant minaret.',
  imageIntent:
    'Turistik olmayan şehir köşeleri, yerel mahalle atmosferi ve sessiz şehir deneyimleri üzerine konuşmayı sürdür.',
  visualNarrative:
    'Sarı taşlı bir sokakta, çamaşır ipleri ve uzaktaki minareler arasında tahta sandalyede içilen sakin bir çay anı.',
  exclusions: ['modern buildings', 'tourist crowds', 'stock imagery'],
  confidence: 0.92,
  topicCategory: 'travel',
  atmosphereHint: 'serene and inviting',
};

const SCENE_URL =
  'https://api.ezacore.ai/api/public/mirror-scene-assets/mardin-landing-v1-acceptance.png';

function assertNoForbiddenPublicCopy(text: string) {
  for (const label of FORBIDDEN_INTERNAL_LABELS) {
    expect(text).not.toContain(label);
  }
  for (const phrase of FORBIDDEN_PUBLIC_LANDING_PHRASES) {
    expect(text.toLowerCase()).not.toContain(phrase);
  }
}

describe('Mardin landing-v1 pipeline acceptance', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('validates Conversation → D2 → Prompt → Image → Public landing → Discover → /m', async () => {
    // 1) Conversation → entries + V3 payload
    const entries = buildConversationMirrorEntries([...MARDIN_TEST_CONVERSATION]);
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const cueBlob = entries.flatMap((e) => e.mirrorCueHints ?? []).join(' ');
    expect(cueBlob.toLowerCase()).toMatch(/mardin|minare|taş|rota|harita/);

    const conversationTexts = MARDIN_TEST_CONVERSATION.map((m) => m.text);
    const payload = buildMirrorPayloadV3(entries, {
      conversationId: 'chat-mardin-landing-v1-acceptance',
      seed: 'mardin-landing-v1-acceptance',
      conversationTexts,
    });
    expect(payload.conversationEvidence?.length).toBeGreaterThan(0);

    const state = buildMirrorStateV3(entries, {
      conversationId: 'chat-mardin-landing-v1-acceptance',
      seed: 'mardin-landing-v1-acceptance',
      conversationTexts,
    });
    const cardBase = state.dailyMirrorCard;
    const staleV3Bundle = cardBase.mirrorV3Payload?.curiosityBundle;

    // 2) D2 Interpretation applied (director prepare)
    const mappedPrompt = [
      'VISUAL NARRATIVE:',
      MARDIN_D2.visualNarrative,
      'ATMOSPHERE:',
      MARDIN_D2.atmosphereHint,
      'EXCLUSIONS:',
      ...(MARDIN_D2.exclusions ?? []),
    ].join('\n');

    const withD2 = applyDirectorPrepareToCard(cardBase, {
      directorEnabled: true,
      usedDirector: true,
      applyTitle: true,
      applyPrompt: true,
      directorMode: 'FULL',
      directorExecuted: true,
      directorAffectedOutput: true,
      mappedPrompt: {
        title: MARDIN_D2.title,
        topicCategory: 'travel',
        season: 'editorial_magazine',
        prompt: mappedPrompt,
        negativePrompt: 'modern buildings, tourist crowds, text, watermark',
        promptContract: MIRROR_V5_PROMPT_CONTRACT,
        titleSource: 'interpretation_llm',
        artDirectionSource: 'interpretation_v1',
      },
      finalInterpretation: MARDIN_D2,
      metadata: {
        analysisSchemaVersion: 'mirror-interpretation-v1',
        draftSchemaVersion: 'mirror-interpretation-v1',
        reviewSchemaVersion: 'mirror-director-review-v1',
        analysisSource: 'interpretation_v1',
        draftSource: 'interpretation_llm',
        directorConfidence: 0.92,
        directorReasonCodes: [],
        revisionCount: 0,
        contentHash: 'mardin-landing-v1-content',
        topicCategory: 'travel',
      },
    });

    expect(withD2.mirrorFinalInterpretation?.title).toBe("Mardin'de Sessiz Bir Akşam");
    expect(withD2.headline).toBe("Mardin'de Sessiz Bir Akşam");
    expect(withD2.visual?.prompt).toContain('Sarı taşlı bir sokakta');
    expect(withD2.visual?.prompt).toMatch(/çay|sandalye|minare|çamaşır/i);
    expect(withD2.mirrorSemanticSource).toBe('d2_interpretation');

    const card: DailyMirrorCardModel = withD2;

    // 3) Public landing from D2 (not V3 evidence labels)
    const resolved = resolvePublishCuriosityBundle(card);
    expect(resolved.semanticSource).toBe('d2_interpretation');
    const landing = resolved.bundle.publicLanding!;
    expect(landing.contractVersion).toBe(MIRROR_PUBLIC_LANDING_CONTRACT_VERSION);
    expect(landing.publicTitle).toBe("Mardin'de Sessiz Bir Akşam");
    expect(landing.publicSummary).toMatch(/sarı taş|çay|minare|sokak/i);
    expect(landing.publicSummary).toMatch(/Mardin|mahalle|turistik|Ayna/i);
    expect(landing.continuationContext.length).toBeGreaterThan(20);
    expect(landing.continuationContext).not.toMatch(
      /üzerine konuşmayı sürdür\s+üzerine konuşmayı sürdür/i
    );
    assertNoForbiddenPublicCopy(landing.publicSummary);
    assertNoForbiddenPublicCopy(landing.publicTitle);

    // V3 may still carry architecture/material cues — they must not leak into public copy
    const staleLabels = [
      ...(staleV3Bundle?.seed.subtopics ?? []),
      ...(payload.conversationEvidence ?? []).map((e) => e.label),
    ].join(' ');
    for (const label of ['Cephe malzemesi', 'Malzeme seçimi', 'Işık ve gölge', 'Malzeme ve oran']) {
      if (staleLabels.includes(label)) {
        expect(landing.publicSummary).not.toContain(label);
      }
    }

    // 4) Publish → Discover + /m surfaces
    vi.mocked(apiClient.post).mockResolvedValue({
      ok: true,
      slug: 'mardin-de-sessiz-bir-aksam-test01',
      shareUrl: 'https://saina.app/m/mardin-de-sessiz-bir-aksam-test01',
      cardTitle: landing.publicTitle,
      cardDate: card.date,
      publicTitle: landing.publicTitle,
      publicSummary: landing.publicSummary,
      curiosityContext: landing.publicSummary,
      landingContext: landing.publicSummary,
      continuationContext: landing.continuationContext,
      contractVersion: landing.contractVersion,
      interpretationHash: landing.interpretationHash,
      sceneImageUrl: SCENE_URL,
      coreCuriosity: landing.continuationContext,
      seed: { topicCategory: 'travel', mood: 'discovery' },
    });

    const published = await publishMirrorToNetwork({
      card,
      conversationId: 'chat-mardin-landing-v1-acceptance',
      sceneImageUrl: SCENE_URL,
      generationId: 'gen-mardin-landing-v1',
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    expect(published.slug).toBe('mardin-de-sessiz-bir-aksam-test01');
    expect(published.lineage?.contractVersion).toBe(MIRROR_PUBLIC_LANDING_CONTRACT_VERSION);
    expect(published.lineage?.publicLandingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(published.lineage?.interpretationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(published.lineage?.sceneAssetId).toBe('mardin-landing-v1-acceptance.png');
    expect(published.semanticSource).toBe('d2_interpretation');

    const body = vi.mocked(apiClient.post).mock.calls[0][1]?.body as {
      cardTitle: string;
      sceneImageUrl: string;
      curiosityBundle: {
        publicLanding: {
          publicTitle: string;
          publicSummary: string;
          continuationContext: string;
          contractVersion: string;
        };
      };
    };
    expect(body.cardTitle).toBe("Mardin'de Sessiz Bir Akşam");
    expect(body.sceneImageUrl).toBe(SCENE_URL);
    expect(body.curiosityBundle.publicLanding.publicSummary).toBe(landing.publicSummary);
    expect(body.curiosityBundle.publicLanding.contractVersion).toBe(
      MIRROR_PUBLIC_LANDING_CONTRACT_VERSION
    );

    // Discover card model (API item shape)
    const discoverItem = {
      slug: published.slug,
      title: published.publicPayload.publicTitle || published.publicPayload.cardTitle,
      description: published.publicPayload.publicSummary || published.publicPayload.curiosityContext,
      sceneImageUrl: published.publicPayload.sceneImageUrl ?? SCENE_URL,
      yansiCount: 0,
    };
    expect(discoverItem.title).toBe("Mardin'de Sessiz Bir Akşam");
    expect(discoverItem.description).toMatch(/sarı taş|çay|minare/i);
    assertNoForbiddenPublicCopy(discoverItem.description || '');
    expect(discoverItem.sceneImageUrl).toBe(SCENE_URL);

    // /m/{slug} landing surface
    const apiPayload = published.publicPayload as MirrorNetworkPublicApiResponse;
    const surface = pickMirrorLandingSurface(apiPayload);
    expect(surface.cardTitle).toBe("Mardin'de Sessiz Bir Akşam");
    expect(surface.curiosityContext).toBe(landing.publicSummary);
    expect(surface.publicSummary).toBe(landing.publicSummary);
    expect(JSON.stringify(surface)).not.toContain('continuationContext');
    assertNoForbiddenPublicCopy(surface.curiosityContext);
  });
});
