import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllMirrorJourneyArtifactsForTests,
  clearMirrorJourneyArtifactsForUser,
  isMirrorJourneyV1ClientEnabled,
  listJourneyArtifactsForConversation,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactPublishFailed,
  markMirrorJourneyArtifactPublished,
  markMirrorJourneyArtifactReadyFromLineage,
  resolveJourneyArtifactShareIdentity,
  saveMirrorJourneyArtifact,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey';
import {
  clearMirrorShareLink,
  clearMirrorShareLinksForJourneyUser,
  readMirrorShareLink,
  readMirrorShareLinkForJourney,
  saveMirrorShareLink,
  saveMirrorShareLinkForJourney,
} from '@/lib/eza/mirror-share/mirrorShareLinkCache';

function lineage(
  tag: string,
  opts: { blockIndex?: number; version?: number; conv?: string } = {}
): JourneyGenerationLineage {
  const block = opts.blockIndex ?? 0;
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: opts.version ?? 1,
    sourceConversationId: opts.conv ?? 'conv-1',
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

describe('Phase 3.7.5 multi-artifact panel readiness', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('A/B/C: generate A then B — both exist, B does not overwrite A', () => {
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-a',
      sourceConversationId: 'conv-1',
      blockIndex: 0,
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a', { blockIndex: 0 }),
      sceneImageUrl: 'https://cdn/x/mirror-scene-assets/asset-a',
      publicTitle: 'Title A',
      publicSummary: 'Summary A',
      continuationContext: 'Continue A',
    });
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-b',
      sourceConversationId: 'conv-1',
      blockIndex: 1,
    });
    const listedWhileBGenerating = listJourneyArtifactsForConversation(
      'user-1',
      'conv-1'
    );
    expect(listedWhileBGenerating).toHaveLength(2);
    expect(listedWhileBGenerating[0]?.status).toBe('ready');
    expect(listedWhileBGenerating[1]?.status).toBe('generating');

    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('b', { blockIndex: 1 }),
      sceneImageUrl: 'https://cdn/x/mirror-scene-assets/asset-b',
      publicTitle: 'Title B',
      publicSummary: 'Summary B',
    });
    const listed = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(listed).toHaveLength(2);
    expect(listed[0]?.journeyId).toBe('journey-a');
    expect(listed[0]?.publicTitle).toBe('Title A');
    expect(listed[0]?.sceneImageUrl).toContain('asset-a');
    expect(listed[1]?.journeyId).toBe('journey-b');
    expect(listed[1]?.publicTitle).toBe('Title B');
    expect(listed[0]?.selectedStepsHash).toBe('t-a');
    expect(listed[1]?.selectedStepsHash).toBe('t-b');
  });

  it('E/F: publish A then B — separate slug/state', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
      publicTitle: 'A',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('b', { blockIndex: 1 }),
      publicTitle: 'B',
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
      publicTitle: 'A',
    });
    saveMirrorShareLinkForJourney({
      userId: 'user-1',
      conversationId: 'conv-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
      publicTitle: 'A',
    });
    // Conversation cache overwritten by B later must not erase A's journey identity.
    saveMirrorShareLink(
      'conv-1',
      'slug-b',
      'https://saina.app/m/slug-b',
      'user-1',
      new Date(),
      { publicTitle: 'B' }
    );
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-b',
      journeyVersion: 1,
      slug: 'slug-b',
      shareUrl: 'https://saina.app/m/slug-b',
      publicTitle: 'B',
    });
    saveMirrorShareLinkForJourney({
      userId: 'user-1',
      conversationId: 'conv-1',
      journeyId: 'journey-b',
      journeyVersion: 1,
      slug: 'slug-b',
      shareUrl: 'https://saina.app/m/slug-b',
      publicTitle: 'B',
    });

    const a = loadMirrorJourneyArtifact('user-1', 'journey-a', 1);
    const b = loadMirrorJourneyArtifact('user-1', 'journey-b', 1);
    expect(a?.status).toBe('published');
    expect(a?.publish.slug).toBe('slug-a');
    expect(b?.status).toBe('published');
    expect(b?.publish.slug).toBe('slug-b');
    expect(readMirrorShareLink('conv-1', 'user-1')?.slug).toBe('slug-b');
    expect(readMirrorShareLinkForJourney('user-1', 'journey-a', 1)?.slug).toBe(
      'slug-a'
    );
  });

  it('G: publish failure keeps ready recoverable', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
      publicTitle: 'A',
    });
    markMirrorJourneyArtifactPublishFailed('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      message: 'network_error',
    });
    const a = loadMirrorJourneyArtifact('user-1', 'journey-a', 1);
    expect(a?.status).toBe('ready');
    expect(a?.generationError).toBe('network_error');
    expect(a?.publicTitle).toBe('A');
    expect(a?.sealedLineage?.generationId).toBe('gen-a');
  });

  it('H: share A while B active uses A identity', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
      publicTitle: 'Title A',
      sceneImageUrl: 'https://cdn/asset-a',
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
      publicTitle: 'Title A',
      sceneImageUrl: 'https://cdn/asset-a',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('b', { blockIndex: 1 }),
      publicTitle: 'Title B',
    });
    saveMirrorShareLink(
      'conv-1',
      'slug-b-latest',
      'https://saina.app/m/slug-b-latest',
      'user-1'
    );
    const shareA = resolveJourneyArtifactShareIdentity({
      ownerUserId: 'user-1',
      journeyId: 'journey-a',
      journeyVersion: 1,
      conversationId: 'conv-1',
      allowConversationLegacyFallback: true,
    });
    expect(shareA?.slug).toBe('slug-a');
    expect(shareA?.publicTitle).toBe('Title A');
    expect(shareA?.source).toBe('panel_artifact');
  });

  it('I: reload restores A ready / B published / C failed', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
      publicTitle: 'A',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('b', { blockIndex: 1 }),
      publicTitle: 'B',
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-b',
      journeyVersion: 1,
      slug: 'slug-b',
      shareUrl: 'https://saina.app/m/slug-b',
    });
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-c',
      sourceConversationId: 'conv-1',
      blockIndex: 2,
    });
    markMirrorJourneyArtifactFailed('user-1', {
      journeyId: 'journey-c',
      journeyVersion: 1,
      message: 'scene_failed',
    });

    // Simulate remount by reading store fresh
    const listed = listJourneyArtifactsForConversation('user-1', 'conv-1');
    expect(listed.map((x) => x.status)).toEqual([
      'ready',
      'published',
      'failed',
    ]);
    expect(listed[0]?.publicTitle).toBe('A');
    expect(listed[1]?.publish.slug).toBe('slug-b');
    expect(listed[2]?.generationError).toBe('scene_failed');
  });

  it('J: cross-user isolation for same conversationId', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a', { conv: 'conv-shared' }),
      publicTitle: 'User1',
    });
    markMirrorJourneyArtifactReadyFromLineage('user-2', {
      lineage: lineage('a2', { conv: 'conv-shared' }),
      publicTitle: 'User2',
    });
    expect(listJourneyArtifactsForConversation('user-1', 'conv-shared')).toHaveLength(
      1
    );
    expect(
      listJourneyArtifactsForConversation('user-1', 'conv-shared')[0]?.publicTitle
    ).toBe('User1');
    expect(listJourneyArtifactsForConversation('user-2', 'conv-shared')).toHaveLength(
      1
    );
    expect(
      listJourneyArtifactsForConversation('user-2', 'conv-shared')[0]?.publicTitle
    ).toBe('User2');
    clearMirrorJourneyArtifactsForUser('user-1');
    expect(listJourneyArtifactsForConversation('user-1', 'conv-shared')).toHaveLength(
      0
    );
    expect(listJourneyArtifactsForConversation('user-2', 'conv-shared')).toHaveLength(
      1
    );
  });

  it('K: stale tab cannot revert published → ready or wipe collection', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
    });
    const published = loadMirrorJourneyArtifact('user-1', 'journey-a', 1)!;
    // Stale writer still thinks stateVersion is older and tries to demote.
    const stale = {
      ...published,
      status: 'ready' as const,
      publish: {},
      stateVersion: 0,
    };
    const result = saveMirrorJourneyArtifact('user-1', stale);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('stale_revision');
      expect(result.current?.status).toBe('published');
      expect(result.current?.publish.slug).toBe('slug-a');
    }
    expect(loadMirrorJourneyArtifact('user-1', 'journey-a', 1)?.status).toBe(
      'published'
    );
  });

  it('L: flag-off legacy share cache unchanged', () => {
    expect(
      isMirrorJourneyV1ClientEnabled({
        NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1: undefined,
      })
    ).toBe(false);
    saveMirrorShareLink('conv-legacy', 'slug-l', 'https://saina.app/m/slug-l', 'user-1');
    expect(readMirrorShareLink('conv-legacy', 'user-1')?.slug).toBe('slug-l');
    clearMirrorShareLink('conv-legacy', 'user-1');
    expect(readMirrorShareLink('conv-legacy', 'user-1')).toBeNull();
    clearMirrorShareLinksForJourneyUser('user-1');
  });

  it('published A remains published when B generates', () => {
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
    });
    markMirrorJourneyArtifactPublished('user-1', {
      journeyId: 'journey-a',
      journeyVersion: 1,
      slug: 'slug-a',
      shareUrl: 'https://saina.app/m/slug-a',
    });
    markMirrorJourneyArtifactGenerating('user-1', {
      journeyId: 'journey-b',
      sourceConversationId: 'conv-1',
      blockIndex: 1,
    });
    // Accidental re-seal of A must not demote published.
    markMirrorJourneyArtifactReadyFromLineage('user-1', {
      lineage: lineage('a'),
      publicTitle: 'A again',
    });
    expect(loadMirrorJourneyArtifact('user-1', 'journey-a', 1)?.status).toBe(
      'published'
    );
    expect(loadMirrorJourneyArtifact('user-1', 'journey-a', 1)?.publish.slug).toBe(
      'slug-a'
    );
  });
});
