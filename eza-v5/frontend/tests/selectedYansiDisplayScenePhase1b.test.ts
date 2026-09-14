import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllMirrorJourneyArtifactsForTests,
  resolveChromeDisplaySceneUrl,
  resolveSelectedYansiArtifact,
  resolveSelectedYansiDisplaySceneUrl,
  upsertMirrorJourneyArtifact,
  type JourneyGenerationLineage,
  type MirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { buildGeneratingMirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  createStandaloneChat,
  getChatArchive,
  setConversationSceneIdentity,
} from '@/lib/standaloneChatArchive';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { restoreRemountCardLandingFromJourneyArtifacts } from '@/lib/eza/mirror/journey/restoreJourneyLandingOntoCard';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';

const OWNER = 'user-display-1';
const CONV = 'conv-display-c';

function lineage(
  tag: string,
  opts: { blockIndex?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: 1,
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
    sealedAt: new Date().toISOString(),
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

function ready(
  tag: string,
  scene: string,
  blockIndex = 0
): MirrorJourneyArtifact {
  return buildReadyMirrorJourneyArtifactFromLineage({
    lineage: lineage(tag, { blockIndex }),
    sceneImageUrl: scene,
    publicTitle: `Title ${tag}`,
    publicSummary: `Summary ${tag}`,
  })!;
}

function thinCard(): DailyMirrorCardModel {
  return {
    date: '2026-09-14',
    dayLabel: '14 Eylül',
    headline: 'thin',
    insight: 'thin',
    focusLabel: 'focus',
    visual: { sceneImageUrl: null },
    shareEnabled: true,
  } as DailyMirrorCardModel;
}

describe('selected Yansı display scene override', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
  });
  afterEach(() => {
    clearAllMirrorJourneyArtifactsForTests();
    localStorage.clear();
  });

  it('A. multi-Yansı: selected A overrides display; archive stays B', () => {
    const chatId = createStandaloneChat({ title: 'C', idPrefix: 'conv' });
    // Force known id for artifact sourceConversationId alignment in this suite.
    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    const b = ready('b', 'https://cdn.example.com/b.jpg', 1);
    a.sourceConversationId = chatId;
    b.sourceConversationId = chatId;
    a.sealedLineage = { ...a.sealedLineage!, sourceConversationId: chatId };
    b.sealedLineage = { ...b.sealedLineage!, sourceConversationId: chatId };

    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/b.jpg',
      source: 'mirror_local',
    });
    upsertMirrorJourneyArtifact(OWNER, a);
    upsertMirrorJourneyArtifact(OWNER, b);

    const convScene = resolveChromeConversationSceneUrl(chatId, null);
    expect(convScene).toBe('https://cdn.example.com/b.jpg');

    const overrideA = resolveSelectedYansiDisplaySceneUrl({
      ownerUserId: OWNER,
      sourceConversationId: chatId,
      identity: { journeyId: 'journey-a', journeyVersion: 1 },
    });
    expect(overrideA).toBe('https://cdn.example.com/a.jpg');
    expect(resolveChromeDisplaySceneUrl(convScene, overrideA)).toBe(
      'https://cdn.example.com/a.jpg'
    );
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(
      'https://cdn.example.com/b.jpg'
    );

    const overrideB = resolveSelectedYansiDisplaySceneUrl({
      ownerUserId: OWNER,
      sourceConversationId: chatId,
      identity: { journeyId: 'journey-b', journeyVersion: 1 },
    });
    expect(resolveChromeDisplaySceneUrl(convScene, overrideB)).toBe(
      'https://cdn.example.com/b.jpg'
    );

    // Clear yansi → conversation scene
    expect(resolveChromeDisplaySceneUrl(convScene, null)).toBe(
      'https://cdn.example.com/b.jpg'
    );
  });

  it('B. same-conversation A→B display switches without archive write', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    const b = ready('b', 'https://cdn.example.com/b.jpg', 1);
    a.sourceConversationId = chatId;
    b.sourceConversationId = chatId;
    a.sealedLineage = { ...a.sealedLineage!, sourceConversationId: chatId };
    b.sealedLineage = { ...b.sealedLineage!, sourceConversationId: chatId };
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/b.jpg',
      source: 'mirror_local',
    });
    upsertMirrorJourneyArtifact(OWNER, a);
    upsertMirrorJourneyArtifact(OWNER, b);

    const before = getChatArchive(chatId)?.conversationSceneUrl;
    const displayA = resolveChromeDisplaySceneUrl(
      before,
      resolveSelectedYansiDisplaySceneUrl({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'journey-a', journeyVersion: 1 },
      })
    );
    const displayB = resolveChromeDisplaySceneUrl(
      before,
      resolveSelectedYansiDisplaySceneUrl({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'journey-b', journeyVersion: 1 },
      })
    );
    expect(displayA).toBe('https://cdn.example.com/a.jpg');
    expect(displayB).toBe('https://cdn.example.com/b.jpg');
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(before);
  });

  it('C. reload/hydrate: missing then present artifact resolves override', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/fallback.jpg',
      source: 'mirror_local',
    });
    const conv = resolveChromeConversationSceneUrl(chatId, null);

    expect(
      resolveSelectedYansiDisplaySceneUrl({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'journey-a', journeyVersion: 1 },
      })
    ).toBeNull();
    expect(resolveChromeDisplaySceneUrl(conv, null)).toBe(
      'https://cdn.example.com/fallback.jpg'
    );

    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    a.sourceConversationId = chatId;
    a.sealedLineage = { ...a.sealedLineage!, sourceConversationId: chatId };
    upsertMirrorJourneyArtifact(OWNER, a);

    const override = resolveSelectedYansiDisplaySceneUrl({
      ownerUserId: OWNER,
      sourceConversationId: chatId,
      identity: { journeyId: 'journey-a', journeyVersion: 1 },
    });
    expect(override).toBe('https://cdn.example.com/a.jpg');
    expect(resolveChromeDisplaySceneUrl(conv, override)).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('D. invalid/missing yansi: no latest substitution', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const b = ready('b', 'https://cdn.example.com/b.jpg', 1);
    b.sourceConversationId = chatId;
    b.sealedLineage = { ...b.sealedLineage!, sourceConversationId: chatId };
    upsertMirrorJourneyArtifact(OWNER, b);
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/b.jpg',
      source: 'mirror_local',
    });

    expect(
      resolveSelectedYansiArtifact({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'missing', journeyVersion: 9 },
      })
    ).toBeNull();
    expect(
      resolveSelectedYansiDisplaySceneUrl({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'missing', journeyVersion: 9 },
      })
    ).toBeNull();
    expect(
      resolveChromeDisplaySceneUrl(
        resolveChromeConversationSceneUrl(chatId, null),
        null
      )
    ).toBe('https://cdn.example.com/b.jpg');
  });

  it('E. live READY updates archive B while A selection keeps display A', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    a.sourceConversationId = chatId;
    a.sealedLineage = { ...a.sealedLineage!, sourceConversationId: chatId };
    upsertMirrorJourneyArtifact(OWNER, a);

    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/a.jpg',
      source: 'mirror_local',
    });
    // Simulate live READY applying latest B to conversation scene.
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/b.jpg',
      source: 'mirror_local',
    });

    const overrideA = resolveSelectedYansiDisplaySceneUrl({
      ownerUserId: OWNER,
      sourceConversationId: chatId,
      identity: { journeyId: 'journey-a', journeyVersion: 1 },
    });
    const conv = resolveChromeConversationSceneUrl(chatId, null);
    expect(conv).toBe('https://cdn.example.com/b.jpg');
    expect(resolveChromeDisplaySceneUrl(conv, overrideA)).toBe(
      'https://cdn.example.com/a.jpg'
    );
    expect(resolveChromeDisplaySceneUrl(conv, null)).toBe(
      'https://cdn.example.com/b.jpg'
    );
  });

  it('F. remount landing prefers URL-selected A over latest B', () => {
    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    const b = ready('b', 'https://cdn.example.com/b.jpg', 1);
    upsertMirrorJourneyArtifact(OWNER, a);
    upsertMirrorJourneyArtifact(OWNER, b);

    const restored = restoreRemountCardLandingFromJourneyArtifacts({
      card: thinCard(),
      ownerUserId: OWNER,
      conversationId: CONV,
      preferredJourneyId: 'journey-a',
      preferredJourneyVersion: 1,
      sceneImageUrl: 'https://cdn.example.com/b.jpg',
    });
    const preview = resolveMirrorPublicPreview(restored, null);
    expect(preview?.title).toBe('Title a');
  });

  it('G/H. thumb consistency + non-persistence of override', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const a = ready('a', 'https://cdn.example.com/a.jpg', 0);
    a.sourceConversationId = chatId;
    a.sealedLineage = { ...a.sealedLineage!, sourceConversationId: chatId };
    setConversationSceneIdentity(chatId, {
      url: 'https://cdn.example.com/b.jpg',
      source: 'mirror_local',
    });
    upsertMirrorJourneyArtifact(OWNER, a);

    const display = resolveSelectedYansiDisplaySceneUrl({
      ownerUserId: OWNER,
      sourceConversationId: chatId,
      identity: { journeyId: 'journey-a', journeyVersion: 1 },
    });
    expect(display).toBe('https://cdn.example.com/a.jpg');
    expect(getChatArchive(chatId)?.conversationSceneUrl).toBe(
      'https://cdn.example.com/b.jpg'
    );
  });

  it('generating artifacts are not eligible for display override', () => {
    const chatId = createStandaloneChat({ title: 'C' });
    const gen = buildGeneratingMirrorJourneyArtifact({
      journeyId: 'journey-gen',
      sourceConversationId: chatId,
      blockIndex: 0,
    });
    upsertMirrorJourneyArtifact(OWNER, {
      ...gen,
      sceneImageUrl: 'https://cdn.example.com/gen.jpg',
    });
    expect(
      resolveSelectedYansiDisplaySceneUrl({
        ownerUserId: OWNER,
        sourceConversationId: chatId,
        identity: { journeyId: 'journey-gen', journeyVersion: 1 },
      })
    ).toBeNull();
  });
});
