import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeJourneyGenerationLineageSeal } from '@/lib/eza/mirror/journey/completeJourneyGenerationLineageSeal';
import {
  artifactFromServerYansiPreparation,
  hydrateYansiPreparationsFromServer,
} from '@/lib/eza/mirror/journey/hydrateYansiPreparationsFromServer';
import {
  acquireJourneySceneGenerationRunner,
  clearJourneySceneGenerationAuthorityForTests,
  isJourneySceneGenerationRunnerActive,
  journeySceneGenerationOwns,
  releaseJourneySceneGeneration,
} from '@/lib/eza/mirror/journey/journeySceneGenerationAuthority';
import type { JourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  clearAllMirrorJourneyArtifactsForTests,
  journeySceneIdentityKey,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  sealedJourneyIdentityConflicts,
  upsertMirrorJourneyArtifact,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { shouldSkipAynaSceneGeneration } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import {
  beginAccountSession,
  bootstrapServerConversations,
  getServerConversationAuthority,
  resetServerConversationStoreForTests,
} from '@/lib/eza/serverConversationStore';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

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

const OWNER = 'user-seal-1';
const CONV = 'conv-seal';
const ASSET_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ASSET_B = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const URL_A = `https://api.ezacore.ai/api/public/mirror-scene-assets/${ASSET_A}.png`;
const URL_B = `https://api.ezacore.ai/api/public/mirror-scene-assets/${ASSET_B}.png`;

function lineage(
  journeyId: string,
  extras: Partial<JourneyGenerationLineage> = {}
): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId,
    journeyVersion: 1,
    sourceConversationId: CONV,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: `win-${journeyId}`,
    sourceBlockHash: `block-${journeyId}`,
    scopedInputHash: `scope-${journeyId}`,
    selectedStepsHash: `steps-${journeyId}`,
    interpretationHash: `interp-${journeyId}`,
    publicLandingHash: `land-${journeyId}`,
    mappedPromptHash: `map-${journeyId}`,
    generationId: `gen-${journeyId}`,
    sceneAssetId: ASSET_A,
    sealedAt: '2026-09-27T00:00:00.000Z',
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: i,
      sourceUserMessageId: `u-${journeyId}-${i}`,
      sourceAssistantMessageId: `a-${journeyId}-${i}`,
      publicQuestion: `Soru ${i}`,
      publicAnswer: `Yanıt ${i}`,
    })),
    ...extras,
  };
}

function sealReady(
  journeyId: string,
  sceneImageUrl: string,
  extras: Partial<JourneyGenerationLineage> = {}
) {
  return markMirrorJourneyArtifactReadyFromLineage(OWNER, {
    lineage: lineage(journeyId, extras),
    sceneImageUrl,
    publicTitle: `Title ${journeyId}`,
    publicSummary: `Summary ${journeyId}`,
  });
}

beforeEach(() => {
  localStorage.clear();
  clearAllMirrorJourneyArtifactsForTests();
  clearJourneySceneGenerationAuthorityForTests();
  resetServerConversationStoreForTests();
  vi.clearAllMocks();
});

describe('exact Yansı scene seal', () => {
  it('1. a second generation does not start while the exact Journey runner is in flight', () => {
    const identity = {
      sourceConversationId: CONV,
      journeyId: 'journey-a',
      journeyVersion: 1,
    };
    const first = acquireJourneySceneGenerationRunner(identity);
    const second = acquireJourneySceneGenerationRunner(identity);
    expect(first?.generationId).toBeTruthy();
    expect(second).toBeNull();
    expect(isJourneySceneGenerationRunnerActive(identity)).toBe(true);
    expect(journeySceneGenerationOwns(identity, first!.generationId)).toBe(true);

    const experience = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(experience).toContain('isJourneySceneGenerationRunnerActive');
    expect(experience).toContain('acquireJourneySceneGenerationRunner');
    expect(experience).toMatch(
      /if \(!generationStillRunning\) \{[\s\S]*requestJourneyAynaGeneration/
    );
    const kickStart = experience.indexOf('const kickJourneyAynaGenerate');
    const kickBlock = experience.slice(kickStart, kickStart + 800);
    expect(kickBlock).toContain('isJourneySceneGenerationRunnerActive');
    expect(kickBlock).toContain('return;');
  });

  it('2. a later completion cannot replace the sealed IMAGE A', async () => {
    const ready = sealReady('journey-a', URL_A);
    expect(ready?.status).toBe('ready');
    const incoming = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage('journey-a', { generationId: 'gen-b', sceneAssetId: ASSET_B }),
      sceneImageUrl: URL_B,
      publicTitle: 'Title journey-a',
      publicSummary: 'Summary journey-a',
    })!;
    expect(sealedJourneyIdentityConflicts(ready!, incoming)).toBe(true);
    const kept = upsertMirrorJourneyArtifact(OWNER, incoming);
    expect(kept?.sceneImageUrl).toBe(URL_A);
    expect(kept?.generationId).toBe('gen-journey-a');
    expect(kept?.status).toBe('ready');
    expect(
      journeySceneIdentityKey(kept?.sceneImageUrl, kept?.sceneAssetId)
    ).toBe(`asset:${ASSET_A}`);

    const card = {
      mirrorJourneyGenerationLineage: lineage('journey-a', {
        generationId: 'gen-b',
        sceneAssetId: ASSET_B,
      }),
    } as DailyMirrorCardModel;
    await completeJourneyGenerationLineageSeal({
      card,
      sceneImageUrl: URL_B,
      generationId: 'gen-b',
      ownerUserId: OWNER,
    });
    expect(loadMirrorJourneyArtifact(OWNER, 'journey-a', 1)?.sceneImageUrl).toBe(URL_A);
    expect(
      shouldSkipAynaSceneGeneration({
        artifacts: [loadMirrorJourneyArtifact(OWNER, 'journey-a', 1)!],
        journeyId: 'journey-a',
      })
    ).toBe(true);
  });

  it('3. server hydration with IMAGE B fails closed and keeps sealed IMAGE A', async () => {
    sealReady('journey-a', URL_A);
    const serverLineage = lineage('journey-a', {
      generationId: 'gen-b',
      sceneAssetId: ASSET_B,
    });
    const serverArtifact = artifactFromServerYansiPreparation(
      {
        journeyId: 'journey-a',
        journeyVersion: 1,
        conversationId: 'srv-seal',
        windowIndex: 0,
        windowHash: serverLineage.windowHash,
        selectedStepsHash: serverLineage.selectedStepsHash,
        generationId: 'gen-b',
        publicTitle: 'Server title',
        publicSummary: 'Server summary',
        sceneImageUrl: URL_B,
        sceneAssetId: ASSET_B,
        sealedLineage: serverLineage as unknown as Record<string, unknown>,
        createdAt: '2026-09-27T00:00:00.000Z',
      },
      CONV
    );
    expect(serverArtifact).toBeTruthy();
    const local = loadMirrorJourneyArtifact(OWNER, 'journey-a', 1);
    expect(sealedJourneyIdentityConflicts(local!, serverArtifact!)).toBe(true);

    beginAccountSession(OWNER);
    apiMocks.listServerConversations.mockResolvedValue([
      {
        id: 'srv-seal',
        clientConversationId: CONV,
        title: 'Seal',
        preview: 'p',
        conversationType: 'direct',
        messageCount: 8,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        lastMessageAt: '2026-01-01T00:00:00Z',
        archived: false,
        pinned: false,
        titlePinned: false,
        hasReadyYansi: true,
        publishedYansiSlug: null,
      },
    ]);
    apiMocks.getServerYansiPreparations.mockResolvedValue([
      {
        journeyId: 'journey-a',
        journeyVersion: 1,
        conversationId: 'srv-seal',
        windowIndex: 0,
        windowHash: serverLineage.windowHash,
        selectedStepsHash: serverLineage.selectedStepsHash,
        generationId: 'gen-b',
        publicTitle: 'Server title',
        publicSummary: 'Server summary',
        sceneImageUrl: URL_B,
        sceneAssetId: ASSET_B,
        sealedLineage: serverLineage,
        createdAt: '2026-09-27T00:00:00.000Z',
        status: 'ready',
      },
    ]);
    await bootstrapServerConversations(OWNER);
    const authority = getServerConversationAuthority();
    const rows = await hydrateYansiPreparationsFromServer({
      ownerUserId: OWNER,
      clientConversationId: CONV,
      ownerAtStart: authority.ownerKey,
      epochAtStart: authority.epoch,
    });
    expect(rows[0]?.sceneImageUrl).toBe(URL_A);
    expect(rows[0]?.generationId).toBe('gen-journey-a');
    expect(loadMirrorJourneyArtifact(OWNER, 'journey-a', 1)?.sceneImageUrl).toBe(URL_A);
  });

  it('4. repeating the sealed identity is idempotent', async () => {
    const ready = sealReady('journey-a', URL_A);
    const again = upsertMirrorJourneyArtifact(OWNER, {
      ...ready!,
      publicTitle: 'Title journey-a',
      sceneImageUrl: URL_A,
      generationId: ready!.generationId,
    });
    expect(again?.sceneImageUrl).toBe(URL_A);
    expect(again?.generationId).toBe(ready!.generationId);
    expect(again?.status).toBe('ready');
    expect(again?.publicTitle).toBe('Title journey-a');

    const card = {
      mirrorJourneyGenerationLineage: lineage('journey-a'),
    } as DailyMirrorCardModel;
    await completeJourneyGenerationLineageSeal({
      card,
      sceneImageUrl: URL_A,
      generationId: 'gen-journey-a',
      ownerUserId: OWNER,
    });
    const stored = loadMirrorJourneyArtifact(OWNER, 'journey-a', 1);
    expect(stored?.sceneImageUrl).toBe(URL_A);
    expect(stored?.generationId).toBe('gen-journey-a');
    expect(stored?.status).toBe('ready');
  });

  it('5. a later Journey window can seal its own IMAGE B', () => {
    sealReady('journey-a', URL_A);
    const later = sealReady('journey-b', URL_B, {
      windowIndex: 1,
      blockIndex: 1,
      windowStart: 8,
      windowEnd: 15,
      generationId: 'gen-journey-b',
      sceneAssetId: ASSET_B,
    });
    expect(later?.sceneImageUrl).toBe(URL_B);
    expect(loadMirrorJourneyArtifact(OWNER, 'journey-a', 1)?.sceneImageUrl).toBe(URL_A);
    expect(
      shouldSkipAynaSceneGeneration({
        artifacts: [loadMirrorJourneyArtifact(OWNER, 'journey-a', 1)!],
        journeyId: 'journey-b',
      })
    ).toBe(false);

    const identityA = {
      sourceConversationId: CONV,
      journeyId: 'journey-a',
      journeyVersion: 1,
    };
    const identityB = {
      sourceConversationId: CONV,
      journeyId: 'journey-b',
      journeyVersion: 1,
    };
    expect(acquireJourneySceneGenerationRunner(identityA)?.generationId).toBeTruthy();
    expect(acquireJourneySceneGenerationRunner(identityB)?.generationId).toBeTruthy();
  });

  it('6. a failed pre-READY attempt can retry, and READY cannot be replaced', () => {
    const identity = {
      sourceConversationId: CONV,
      journeyId: 'journey-retry',
      journeyVersion: 1,
    };
    markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: 'journey-retry',
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      generationId: 'gen-1',
    });
    const first = acquireJourneySceneGenerationRunner(identity);
    expect(acquireJourneySceneGenerationRunner(identity)).toBeNull();
    releaseJourneySceneGeneration(identity, first!.generationId);
    expect(isJourneySceneGenerationRunnerActive(identity)).toBe(false);
    const retry = acquireJourneySceneGenerationRunner(identity);
    expect(retry?.generationId).toBeTruthy();
    expect(retry?.generationId).not.toBe(first!.generationId);
    releaseJourneySceneGeneration(identity);

    markMirrorJourneyArtifactFailed(OWNER, {
      journeyId: 'journey-retry',
      journeyVersion: 1,
      message: 'scene failed',
    });
    expect(loadMirrorJourneyArtifact(OWNER, 'journey-retry', 1)?.status).toBe('failed');
    const ready = sealReady('journey-retry', URL_A, { generationId: 'gen-retry' });
    expect(ready?.status).toBe('ready');
    expect(ready?.sceneImageUrl).toBe(URL_A);

    const wiped = markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: 'journey-retry',
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      generationId: 'gen-late',
    });
    expect(wiped?.status).toBe('ready');
    expect(wiped?.sceneImageUrl).toBe(URL_A);

    const late = buildReadyMirrorJourneyArtifactFromLineage({
      lineage: lineage('journey-retry', {
        generationId: 'gen-late',
        sceneAssetId: ASSET_B,
      }),
      sceneImageUrl: URL_B,
      publicTitle: 'Title journey-retry',
      publicSummary: 'Summary journey-retry',
    })!;
    const kept = upsertMirrorJourneyArtifact(OWNER, late);
    expect(kept?.sceneImageUrl).toBe(URL_A);
    expect(kept?.generationId).toBe('gen-retry');
    expect(kept?.status).toBe('ready');
  });
});
