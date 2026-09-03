import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearAllMirrorJourneyArtifactsForTests,
  markMirrorJourneyArtifactReadyFromLineage,
  resolveConversationYansiStatus,
  shouldSkipAynaSceneGeneration,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey';
import { persistAuthenticatedReadyYansi, captureYansiPreparationAuthority, isYansiPreparationAuthorityCurrent } from '@/lib/eza/mirror/journey/persistAuthenticatedReadyYansi';
import {
  artifactFromServerYansiPreparation,
  hydrateYansiPreparationsFromServer,
} from '@/lib/eza/mirror/journey/hydrateYansiPreparationsFromServer';
import { listJourneyArtifactsForConversation } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  applyPublishFailureToArtifact,
  applyPublishSuccessToArtifact,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  bootstrapServerConversations,
  beginAccountSession,
  clearServerConversationState,
  getServerConversationSummaries,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';

const apiMocks = vi.hoisted(() => ({
  listServerConversations: vi.fn(),
  getServerConversation: vi.fn(),
  createServerConversation: vi.fn(),
  patchServerConversation: vi.fn(),
  deleteServerConversation: vi.fn(),
  migrateLegacyServerConversations: vi.fn(),
  getServerYansiPreparations: vi.fn(),
  putServerYansiPreparation: vi.fn(),
  linkServerYansiPreparationPublication: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', () => apiMocks);

const userA = 'user-a-1111-1111-1111-111111111111';
const userB = 'user-b-2222-2222-2222-222222222222';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function lineage(tag = 'alpha', conv = 'chat-a'): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: `journey-${tag}`,
    journeyVersion: 1,
    sourceConversationId: conv,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    windowHash: `win-${tag}`,
    scopedInputHash: `scoped-${tag}`,
    selectedStepsHash: `steps-${tag}`,
    interpretationHash: `interp-${tag}`,
    publicLandingHash: `land-${tag}`,
    mappedPromptHash: `map-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `asset-${tag}`,
    sealedAt: '2026-09-03T00:00:00.000Z',
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i,
      sourceOrder: i,
      sourceUserMessageId: `u-${i}`,
      sourceAssistantMessageId: `a-${i}`,
      publicQuestion: `Soru ${i}`,
      publicAnswer: `Yanıt ${i}`,
    })),
  };
}

function serverPrep(overrides: Record<string, unknown> = {}) {
  const lin = lineage();
  return {
    id: 'prep-1',
    conversationId: 'srv-a',
    sourceIdentity: 'journey-alpha::v1',
    journeyId: lin.journeyId,
    journeyVersion: 1,
    windowIndex: 0,
    windowHash: lin.windowHash,
    selectedStepsHash: lin.selectedStepsHash,
    generationId: lin.generationId,
    status: 'ready' as const,
    publicTitle: 'Hazır başlık',
    publicSummary: 'Hazır özet',
    sceneImageUrl: 'https://api.ezacore.ai/api/public/mirror-scene-assets/x.png',
    sceneAssetId: 'asset-alpha',
    sceneFocalX: 0.4,
    sceneFocalY: 0.6,
    sealedLineage: lin as unknown as Record<string, unknown>,
    sealedPublicLanding: {
      publicTitle: 'Hazır başlık',
      publicSummary: 'Hazır özet',
      continuationContext: 'devam',
    },
    publishedSlug: null,
    createdAt: '2026-09-03T00:00:00.000Z',
    ...overrides,
  };
}

const listA = {
  id: 'srv-a',
  clientConversationId: 'chat-a',
  title: 'User A chat',
  preview: 'hello A',
  conversationType: 'direct' as const,
  messageCount: 8,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastMessageAt: '2026-01-01T00:00:00Z',
  archived: false,
  pinned: false,
  titlePinned: false,
  hasReadyYansi: true,
  publishedYansiSlug: null as string | null,
};

beforeEach(() => {
  localStorage.clear();
  clearAllMirrorJourneyArtifactsForTests();
  resetServerConversationStoreForTests();
  vi.clearAllMocks();
  apiMocks.listServerConversations.mockResolvedValue([listA]);
  apiMocks.putServerYansiPreparation.mockResolvedValue(serverPrep());
  apiMocks.getServerYansiPreparations.mockResolvedValue([serverPrep()]);
});

describe('Phase 8.8G-4 ready/unpublished Yansı persistence', () => {
  it('A. Device A ready state is persisted to the server', async () => {
    await bootstrapServerConversations(userA);
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://api.ezacore.ai/api/public/mirror-scene-assets/x.png',
      publicTitle: 'Hazır başlık',
      publicSummary: 'Hazır özet',
    });
    expect(artifact).toBeTruthy();
    const bound = captureYansiPreparationAuthority(userA);
    const saved = await persistAuthenticatedReadyYansi({
      artifact: artifact!,
      clientConversationId: 'chat-a',
      bound,
      ownerNow: userA,
    });
    expect(apiMocks.putServerYansiPreparation).toHaveBeenCalledTimes(1);
    expect(saved?.publicTitle).toBe('Hazır başlık');
    expect(getServerConversationSummaries()[0]?.hasReadyYansi).toBe(true);
  });

  it('B. Device B empty localStorage reconstructs amber from server', async () => {
    await bootstrapServerConversations(userA);
    expect(
      resolveConversationYansiStatus({
        artifacts: [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: true,
      })
    ).toBe('ready');
  });

  it('C/O. Device B hydrates without regeneration', async () => {
    await bootstrapServerConversations(userA);
    const rows = await hydrateYansiPreparationsFromServer({
      ownerUserId: userA,
      clientConversationId: 'chat-a',
      ownerAtStart: userA,
      epochAtStart: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.publicTitle).toBe('Hazır başlık');
    expect(
      shouldSkipAynaSceneGeneration({
        artifacts: listJourneyArtifactsForConversation(userA, 'chat-a'),
        journeyId: 'journey-alpha',
      })
    ).toBe(true);
  });

  it('D/E. title/summary and scene/focal hydrate exactly', () => {
    const artifact = artifactFromServerYansiPreparation(serverPrep(), 'chat-a');
    expect(artifact?.publicTitle).toBe('Hazır başlık');
    expect(artifact?.publicSummary).toBe('Hazır özet');
    expect(artifact?.sceneImageUrl).toContain('mirror-scene-assets');
    expect(artifact?.sceneAssetId).toBe('asset-alpha');
  });

  it('F. server published state overrides amber', () => {
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://cdn.example/a.png',
      publicTitle: 'Title',
      publicSummary: 'Summary',
    });
    const map = new Map([
      ['pub-slug', { slug: 'pub-slug', visibility: 'public', safetyStatus: 'open' }],
    ]);
    expect(
      resolveConversationYansiStatus({
        artifacts: artifact ? [artifact] : [],
        publicationBySlug: map,
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: true,
        serverPublishedSlug: 'pub-slug',
      })
    ).toBe('published');
  });

  it('G. restricted publication does not show amber', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [],
        publicationBySlug: new Map([
          ['r-slug', { slug: 'r-slug', visibility: 'unlisted', safetyStatus: 'restricted' }],
        ]),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: true,
        serverPublishedSlug: 'r-slug',
      })
    ).toBe('none');
  });

  it('H. stale local amber does not override server', () => {
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://cdn.example/a.png',
      publicTitle: 'Stale',
      publicSummary: 'Stale',
    });
    expect(
      resolveConversationYansiStatus({
        artifacts: artifact ? [artifact] : [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: false,
      })
    ).toBe('none');
  });

  it('I. publish failure keeps ready/amber', () => {
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://cdn.example/a.png',
      publicTitle: 'Title',
      publicSummary: 'Summary',
    })!;
    const failed = applyPublishFailureToArtifact(artifact, 'network');
    expect(failed.status).toBe('ready');
    expect(
      resolveConversationYansiStatus({
        artifacts: [failed],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: true,
      })
    ).toBe('ready');
  });

  it('J. successful publish becomes green', () => {
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://cdn.example/a.png',
      publicTitle: 'Title',
      publicSummary: 'Summary',
    })!;
    const published = applyPublishSuccessToArtifact(artifact, {
      slug: 'live-slug',
      shareUrl: 'https://standalone.ezacore.ai/m/live-slug',
    });
    expect(
      resolveConversationYansiStatus({
        artifacts: [published],
        publicationBySlug: new Map([
          ['live-slug', { slug: 'live-slug', visibility: 'public', safetyStatus: 'open' }],
        ]),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: false,
        serverPublishedSlug: 'live-slug',
      })
    ).toBe('published');
  });

  it('K. A→B late preparation fetch is ignored', async () => {
    await bootstrapServerConversations(userA);
    const delayed = deferred<ReturnType<typeof serverPrep>[]>();
    apiMocks.getServerYansiPreparations.mockImplementationOnce(() => delayed.promise);
    const fetchA = hydrateYansiPreparationsFromServer({
      ownerUserId: userA,
      clientConversationId: 'chat-a',
      ownerAtStart: userA,
      epochAtStart: 1,
    });
    clearServerConversationState();
    beginAccountSession(userB);
    delayed.resolve([serverPrep()]);
    await fetchA;
    expect(listJourneyArtifactsForConversation(userB, 'chat-a')).toHaveLength(0);
    expect(listJourneyArtifactsForConversation(userA, 'chat-a')).toHaveLength(0);
  });

  it('L. A→B late persist cannot write under B', async () => {
    await bootstrapServerConversations(userA);
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'https://api.ezacore.ai/api/public/mirror-scene-assets/x.png',
      publicTitle: 'Hazır başlık',
      publicSummary: 'Hazır özet',
    })!;
    const bound = captureYansiPreparationAuthority(userA);
    const delayed = deferred<ReturnType<typeof serverPrep>>();
    apiMocks.putServerYansiPreparation.mockImplementationOnce(() => delayed.promise);
    const pending = persistAuthenticatedReadyYansi({
      artifact,
      clientConversationId: 'chat-a',
      bound,
      ownerNow: userA,
    });
    clearServerConversationState();
    beginAccountSession(userB);
    delayed.resolve(serverPrep());
    const result = await pending;
    expect(result).toBeNull();
    expect(isYansiPreparationAuthorityCurrent(bound, userB)).toBe(false);
  });

  it('M. guest behavior remains local — persist is a no-op without server owner', async () => {
    const guest = 'guest:token-1';
    const artifact = markMirrorJourneyArtifactReadyFromLineage(guest, {
      lineage: lineage('guest', 'guest-chat'),
      sceneImageUrl: 'https://cdn.example/g.png',
      publicTitle: 'Guest title',
      publicSummary: 'Guest summary',
    })!;
    const bound = captureYansiPreparationAuthority(guest);
    const saved = await persistAuthenticatedReadyYansi({
      artifact,
      clientConversationId: 'guest-chat',
      bound,
      ownerNow: guest,
    });
    expect(saved).toBeNull();
    expect(apiMocks.putServerYansiPreparation).not.toHaveBeenCalled();
    expect(
      resolveConversationYansiStatus({
        artifacts: [artifact],
        publicationBySlug: new Map(),
        publicationAuthorityReady: false,
      })
    ).toBe('ready');
  });

  it('N. normal chat remains no dot', () => {
    expect(
      resolveConversationYansiStatus({
        artifacts: [],
        publicationBySlug: new Map(),
        publicationAuthorityReady: true,
        serverPreparationAuthorityReady: true,
        serverReady: false,
      })
    ).toBe('none');
  });

  it('does not persist blob/data scene URLs', async () => {
    await bootstrapServerConversations(userA);
    const artifact = markMirrorJourneyArtifactReadyFromLineage(userA, {
      lineage: lineage(),
      sceneImageUrl: 'blob:https://localhost/1',
      publicTitle: 'Hazır başlık',
      publicSummary: 'Hazır özet',
    })!;
    const bound = captureYansiPreparationAuthority(userA);
    await persistAuthenticatedReadyYansi({
      artifact,
      clientConversationId: 'chat-a',
      bound,
      ownerNow: userA,
    });
    expect(apiMocks.putServerYansiPreparation).not.toHaveBeenCalled();
  });

  it('does not start 8.8G-5 or global language in this phase', () => {
    const persist = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/journey/persistAuthenticatedReadyYansi.ts'),
      'utf8'
    );
    expect(persist).not.toContain('8.8G-5');
    expect(persist).not.toMatch(/i18n|localization/i);
  });
});
