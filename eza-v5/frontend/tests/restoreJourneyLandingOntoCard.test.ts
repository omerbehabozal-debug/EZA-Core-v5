/**
 * Remount must restore sealed READY Journey title/summary onto the thin
 * entry-rebuilt card — never degrade to SAFE "Paylaşılan Merak" when
 * canonical artifact metadata still exists.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';
import {
  SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY,
  SAFE_PUBLIC_LANDING_FALLBACK_TITLE,
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import {
  clearAllMirrorJourneyArtifactsForTests,
  markMirrorJourneyArtifactReadyFromLineage,
  listJourneyArtifactsForConversation,
  upsertMirrorJourneyArtifact,
  type JourneyGenerationLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { artifactFromServerYansiPreparation } from '@/lib/eza/mirror/journey/hydrateYansiPreparationsFromServer';
import {
  artifactHasCanonicalLanding,
  restoreJourneyLandingOntoCard,
  restoreRemountCardLandingFromJourneyArtifacts,
  selectJourneyArtifactForRemountLanding,
} from '@/lib/eza/mirror/journey/restoreJourneyLandingOntoCard';

const TITLE = 'İstanbul Semtleri';
const SUMMARY =
  "İstanbul'da yaşamak için en iyi semtlerin keşfi üzerine bir sohbet.";
const SCENE = 'https://cdn.example/mirror-scene-assets/istanbul-semtleri.png';
const CONV = 'conv-istanbul';
const OTHER_CONV = 'conv-other';
const OWNER = 'user-1';

function lineage(
  tag: string,
  opts: { blockIndex?: number; version?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: opts.version ?? 1,
    sourceConversationId: opts.conv ?? CONV,
    windowIndex: block,
    windowStart: block * 8,
    windowEnd: block * 8 + 7,
    blockIndex: block,
    windowHash: `h-${tag}`,
    sourceBlockHash: `b-${tag}`,
    scopedInputHash: `s-${tag}`,
    selectedStepsHash: `t-${tag}`,
    selectedCount: 8,
    interpretationHash: `i-${tag}`,
    publicLandingHash: `p-${tag}`,
    mappedPromptHash: `m-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `asset-${tag}`,
    sealedAt: '2026-09-13T00:00:00.000Z',
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: block * 8 + i,
      sourceUserMessageId: `u-${tag}-${i}`,
      sourceAssistantMessageId: `a-${tag}-${i}`,
      publicQuestion: `Q ${tag} ${i}?`,
      publicAnswer: `A ${tag} ${i}.`,
    })),
  };
}

function thinRemountCard(
  overrides: Partial<DailyMirrorCardModel> = {}
): DailyMirrorCardModel {
  return {
    date: '2026-09-13',
    dayLabel: '13 Eylül',
    // Conversation-ish title — must NOT win over artifact for Yansı preview.
    headline: 'Sohbet Başlığı',
    dailyThemeTitle: 'Sohbet Başlığı',
    characterName: '',
    personaFamilyId: 'balanced_calm',
    shortInsight: 'V3 insight must not win',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: '',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    storyTensionSummary: 'V3 tension must not win',
    visual: {
      characterId: 'x',
      characterName: 'x',
      personaFamilyId: 'balanced_calm',
      topicLabel: 'travel',
      atmosphereLabel: 'city',
      emotionLabel: 'curious',
      prompt: 'test',
      negativePrompt: '',
      stylePreset: 'editorial',
      seedHint: '1',
      sceneImageUrl: SCENE,
    },
    ...overrides,
  };
}

function sealReady(tag: string, opts?: {
  title?: string;
  summary?: string;
  conv?: string;
  blockIndex?: number;
  scene?: string | null;
}) {
  return markMirrorJourneyArtifactReadyFromLineage(OWNER, {
    lineage: lineage(tag, {
      blockIndex: opts?.blockIndex,
      conv: opts?.conv,
    }),
    sceneImageUrl: opts?.scene === null ? null : opts?.scene ?? SCENE,
    publicTitle: opts?.title ?? TITLE,
    publicSummary: opts?.summary ?? SUMMARY,
    continuationContext: 'Devam et',
    sealedPublicLanding: {
      publicTitle: opts?.title ?? TITLE,
      publicSummary: opts?.summary ?? SUMMARY,
      continuationContext: 'Devam et',
      topicCategory: 'travel',
      semanticSource: 'd2_interpretation',
      interpretationHash: `i-${tag}`,
      publicLandingHash: `p-${tag}`,
      contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
    },
  });
}

describe('restoreJourneyLandingOntoCard — remount title/summary', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('1. READY sealed artifact → remount preview restores exact title/summary', () => {
    const artifact = sealReady('a');
    expect(artifact?.publicTitle).toBe(TITLE);
    expect(artifact?.sealedPublicLanding?.publicTitle).toBe(TITLE);

    const restored = restoreRemountCardLandingFromJourneyArtifacts({
      card: thinRemountCard(),
      ownerUserId: OWNER,
      conversationId: CONV,
      sceneImageUrl: SCENE,
    });
    const preview = resolveMirrorPublicPreview(restored, SCENE);
    expect(preview.title).toBe(TITLE);
    expect(preview.summary).toBe(SUMMARY);
  });

  it('2. Thin card + sealed artifact → SAFE fallback is NOT used', () => {
    sealReady('a');
    const preview = resolveMirrorPublicPreview(
      restoreRemountCardLandingFromJourneyArtifacts({
        card: thinRemountCard(),
        ownerUserId: OWNER,
        conversationId: CONV,
      }),
      SCENE
    );
    expect(preview.title).not.toBe(SAFE_PUBLIC_LANDING_FALLBACK_TITLE);
    expect(preview.summary).not.toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
    expect(preview.title).toBe(TITLE);
  });

  it('3. Scene-only cache URL + sealed metadata → image and titles both restore', () => {
    sealReady('a', { scene: SCENE });
    const restored = restoreRemountCardLandingFromJourneyArtifacts({
      card: thinRemountCard({
        visual: {
          ...thinRemountCard().visual!,
          sceneImageUrl: SCENE,
        },
      }),
      ownerUserId: OWNER,
      conversationId: CONV,
      sceneImageUrl: SCENE,
    });
    const preview = resolveMirrorPublicPreview(restored, SCENE);
    expect(preview.sceneImageUrl).toBe(SCENE);
    expect(preview.title).toBe(TITLE);
    expect(preview.summary).toBe(SUMMARY);
  });

  it('4. No Journey artifact / no semantic landing → SAFE fallback still allowed', () => {
    const preview = resolveMirrorPublicPreview(
      restoreRemountCardLandingFromJourneyArtifacts({
        card: thinRemountCard(),
        ownerUserId: OWNER,
        conversationId: CONV,
      }),
      SCENE
    );
    expect(preview.title).toBe(SAFE_PUBLIC_LANDING_FALLBACK_TITLE);
    expect(preview.summary).toBe(SAFE_PUBLIC_LANDING_FALLBACK_SUMMARY);
  });

  it('5. Conversation title differs from artifact → artifact title wins for preview', () => {
    sealReady('a');
    const preview = resolveMirrorPublicPreview(
      restoreRemountCardLandingFromJourneyArtifacts({
        card: thinRemountCard({
          headline: 'Tamamen Farklı Sohbet',
          dailyThemeTitle: 'Tamamen Farklı Sohbet',
        }),
        ownerUserId: OWNER,
        conversationId: CONV,
      }),
      null
    );
    expect(preview.title).toBe(TITLE);
    expect(preview.title).not.toBe('Tamamen Farklı Sohbet');
  });

  it('6. Artifact for another conversation must NOT overlay', () => {
    sealReady('other', { conv: OTHER_CONV, title: 'Başka Konuşma', summary: 'Başka özet.' });
    const preview = resolveMirrorPublicPreview(
      restoreRemountCardLandingFromJourneyArtifacts({
        card: thinRemountCard(),
        ownerUserId: OWNER,
        conversationId: CONV,
      }),
      SCENE
    );
    expect(preview.title).toBe(SAFE_PUBLIC_LANDING_FALLBACK_TITLE);
    expect(
      selectJourneyArtifactForRemountLanding({
        artifacts: listJourneyArtifactsForConversation(OWNER, OTHER_CONV),
        sourceConversationId: CONV,
      })
    ).toBeNull();
  });

  it('7. Multiple artifacts — prefers scene match, else latest in list order', () => {
    sealReady('a', {
      blockIndex: 0,
      title: 'İlk Yansı',
      summary: 'İlk özet.',
      scene: 'https://cdn.example/mirror-scene-assets/a.png',
    });
    sealReady('b', {
      blockIndex: 1,
      title: 'İkinci Yansı',
      summary: 'İkinci özet.',
      scene: 'https://cdn.example/mirror-scene-assets/b.png',
    });
    const listed = listJourneyArtifactsForConversation(OWNER, CONV);
    expect(listed).toHaveLength(2);

    const byScene = selectJourneyArtifactForRemountLanding({
      artifacts: listed,
      sourceConversationId: CONV,
      sceneImageUrl: 'https://cdn.example/mirror-scene-assets/a.png',
    });
    expect(byScene?.publicTitle).toBe('İlk Yansı');

    const latest = selectJourneyArtifactForRemountLanding({
      artifacts: listed,
      sourceConversationId: CONV,
    });
    expect(latest?.publicTitle).toBe('İkinci Yansı');

    const byPreferred = selectJourneyArtifactForRemountLanding({
      artifacts: listed,
      sourceConversationId: CONV,
      preferredJourneyId: 'journey-a',
    });
    expect(byPreferred?.publicTitle).toBe('İlk Yansı');
  });

  it('8. Published share landing on card remains unchanged (priority A)', () => {
    sealReady('a', { title: TITLE, summary: SUMMARY });
    const publishedCard = thinRemountCard({
      mirrorShare: {
        blueprint: {
          shareVoice: 'quiet_editorial_minimal',
          tone: 'editorial',
          invitationStyle: 'own_journey',
        },
        shareVoice: { text: '', preset: 'quiet_editorial_minimal' },
        shareUrl: 'https://saina.app/m/published-slug',
        networkSlug: 'published-slug',
        publicTitle: 'Keşfet Yayın Başlığı',
        publicSummary: 'Keşfet yayın özeti korunmalı.',
      },
    });
    const restored = restoreRemountCardLandingFromJourneyArtifacts({
      card: publishedCard,
      ownerUserId: OWNER,
      conversationId: CONV,
    });
    const preview = resolveMirrorPublicPreview(restored, SCENE);
    expect(preview.title).toBe('Keşfet Yayın Başlığı');
    expect(preview.summary).toBe('Keşfet yayın özeti korunmalı.');
    expect(preview.title).not.toBe(TITLE);
  });

  it('9. Journey reel artifact.publicTitle unchanged across remount restore', () => {
    const sealed = sealReady('a');
    expect(sealed?.publicTitle).toBe(TITLE);
    restoreRemountCardLandingFromJourneyArtifacts({
      card: thinRemountCard(),
      ownerUserId: OWNER,
      conversationId: CONV,
    });
    const after = listJourneyArtifactsForConversation(OWNER, CONV)[0];
    expect(after?.publicTitle).toBe(TITLE);
    expect(after?.publicSummary).toBe(SUMMARY);
    expect(after?.sealedPublicLanding?.publicTitle).toBe(TITLE);
    expect(artifactHasCanonicalLanding(after)).toBe(true);
  });

  it('10. Server preparation hydrate → remounted preview uses restored titles', () => {
    const row = {
      journeyId: 'journey-srv',
      journeyVersion: 1,
      conversationId: 'srv-1',
      windowIndex: 0,
      windowHash: 'win',
      selectedStepsHash: 'steps',
      sourceBlockHash: 'block',
      generationId: 'gen-srv',
      publicTitle: TITLE,
      publicSummary: SUMMARY,
      continuationContext: 'Devam',
      sceneImageUrl: SCENE,
      sceneAssetId: 'asset-srv',
      sealedLineage: lineage('srv') as unknown as Record<string, unknown>,
      sealedPublicLanding: {
        publicTitle: TITLE,
        publicSummary: SUMMARY,
        continuationContext: 'Devam',
        topicCategory: 'travel',
        semanticSource: 'd2_interpretation',
      },
      publishedSlug: null as string | null,
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: null as string | null,
    };
    const fromServer = artifactFromServerYansiPreparation(row, CONV);
    expect(fromServer).not.toBeNull();
    const saved = upsertMirrorJourneyArtifact(OWNER, fromServer as MirrorJourneyArtifact);
    expect(saved?.publicTitle).toBe(TITLE);

    const restored = restoreJourneyLandingOntoCard(thinRemountCard(), saved);
    const preview = resolveMirrorPublicPreview(restored, SCENE);
    expect(preview.title).toBe(TITLE);
    expect(preview.summary).toBe(SUMMARY);
  });

  it('wires remount paths in StandaloneObservationExperience', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(src).toContain('restoreRemountCardLandingFromJourneyArtifacts');
    const occurrences = src.split('restoreRemountCardLandingFromJourneyArtifacts').length - 1;
    // import + showExistingMirrorCard + silent hydrate + server prep hydrate
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });
});
