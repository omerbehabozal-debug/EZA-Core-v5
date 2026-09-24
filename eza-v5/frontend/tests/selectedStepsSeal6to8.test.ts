/**
 * P1 regression: Review 6/7/8 selectedSteps must seal into journey lineage.
 *
 * Bug: StandaloneObservationExperience only attached journeySelectedSteps when
 * length === 8, so valid 6/7 Review selections never reached
 * mirrorJourneyGenerationLineage.selectedSteps.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { applyDirectorPrepareToCard } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import {
  buildReview8DraftFromWindow,
  captureExactYansiPublishIdentity,
  clearAllMirrorJourneyArtifactsForTests,
  clearAllReview8Drafts,
  confirmReview8Draft,
  exactIdentityMatchesCardLineage,
  isPublishableJourneyGenerationLineage,
  isValidJourneySelectedStepCount,
  JOURNEY_SELECTED_MAX,
  JOURNEY_SELECTED_MIN,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  pairsToSelectedSteps,
  requestJourneyAynaGeneration,
  readPendingJourneyAynaGeneration,
  resolveScopedJourneyMeaning,
  saveReview8Draft,
  type EligibleQaPair,
  type JourneyGenerationLineageSelectedStep,
} from '@/lib/eza/mirror/journey';
import { computeSelectedStepsHash } from '@/lib/eza/mirror/journey/review8Draft';
import { persistAuthenticatedReadyYansi } from '@/lib/eza/mirror/journey/persistAuthenticatedReadyYansi';
import {
  bootstrapServerConversations,
  noteServerYansiReady,
} from '@/lib/eza/serverConversationStore';

vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1', '1');

const apiMocks = vi.hoisted(() => ({
  putServerYansiPreparation: vi.fn(),
  patchServerConversation: vi.fn(),
}));

vi.mock('@/lib/eza/standaloneConversationsApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/eza/standaloneConversationsApi')>();
  return {
    ...actual,
    putServerYansiPreparation: apiMocks.putServerYansiPreparation,
    patchServerConversation: apiMocks.patchServerConversation,
    listServerConversations: vi.fn(async () => [
      {
        id: 'srv-seal-6to8',
        clientConversationId: 'conv-seal-6to8',
        title: 'Seal test',
        titlePinned: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
        hasReadyYansi: false,
        yansiIdentityGenerationId: null,
        conversationSceneUrl: null,
      },
    ]),
  };
});

const OWNER = 'user-seal-6to8';
const CONV = 'conv-seal-6to8';

function eightPairs(tag: string): EligibleQaPair[] {
  return Array.from({ length: 8 }, (_, i) => ({
    userMessageId: `u-${tag}-${i}`,
    assistantMessageId: `a-${tag}-${i}`,
    publicQuestion: `Q${i + 1} ${tag}?`,
    publicAnswer: `A${i + 1} ${tag}`,
    sourceOrder: i,
  }));
}

function confirmSelection(tag: string, selectedCount: 6 | 7 | 8) {
  const pairs = eightPairs(tag);
  let draft = buildReview8DraftFromWindow({
    ownerUserId: OWNER,
    sourceConversationId: CONV,
    windowIndex: 0,
    pairs,
    draftKey: `draft-${tag}-${selectedCount}`,
  });
  if (selectedCount < 8) {
    const subset = pairs.slice(0, selectedCount);
    draft = {
      ...draft,
      selectedSourceOrders: subset.map((p) => p.sourceOrder),
      selectedSteps: pairsToSelectedSteps(subset),
    };
  }
  const confirmed = confirmReview8Draft(draft);
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error(confirmed.message);
  saveReview8Draft(confirmed.draft);
  return confirmed.draft;
}

/**
 * Mirrors StandaloneObservationExperience prepare attach gate.
 */
function attachJourneySelectedStepsIfValid<T extends object>(
  prepared: T,
  selectedSteps: JourneyGenerationLineageSelectedStep[] | undefined
): T & { journeySelectedSteps?: JourneyGenerationLineageSelectedStep[] } {
  if (
    selectedSteps &&
    isValidJourneySelectedStepCount(selectedSteps.length)
  ) {
    return { ...prepared, journeySelectedSteps: selectedSteps };
  }
  return prepared;
}

function baseCard(): DailyMirrorCardModel {
  return {
    date: '2026-09-24',
    entries: [],
    visual: {
      season: 'autumn',
      mood: 'reflective',
      prompt: 'quiet room',
      negativePrompt: '',
      promptContract: 'v5',
      titleSource: 'd2',
      artDirectionSource: 'd2',
    },
  } as DailyMirrorCardModel;
}

async function prepareAndSeal(
  selectedCount: 6 | 7 | 8,
  tag: string
) {
  const draft = confirmSelection(tag, selectedCount);
  const scoped = resolveScopedJourneyMeaning(draft);
  expect(scoped.ok).toBe(true);
  if (!scoped.ok) throw new Error(scoped.message);

  const selectedSteps = scoped.scope.selectedSteps;
  expect(selectedSteps).toHaveLength(selectedCount);

  const stepsHash = await computeSelectedStepsHash(draft.selectedSteps);
  const preparedBase = {
    directorEnabled: true,
    usedDirector: true,
    applyTitle: true,
    applyPrompt: true,
    mappedPrompt: {
      title: `Title ${tag}`,
      topicCategory: 'life',
      season: 'autumn',
      prompt: 'quiet reflective interior',
      negativePrompt: '',
      promptContract: 'v5',
      titleSource: 'd2',
      artDirectionSource: 'd2',
    },
    semanticScope: 'journey_window_v1' as const,
    semanticSourceJourneyId: draft.journeyId,
    semanticWindowIndex: 0,
    semanticWindowHash: scoped.scope.windowHash,
    scopedInputHash: scoped.scope.scopedInputHash,
    selectedStepsHash: stepsHash,
    journeyVersion: draft.journeyVersion ?? 1,
    journeyGenerationLineage: {
      journeyId: draft.journeyId,
      journeyVersion: draft.journeyVersion ?? 1,
      sourceConversationId: CONV,
      windowIndex: 0,
      windowStart: 0,
      windowEnd: 7,
      windowHash: scoped.scope.windowHash,
      scopedInputHash: scoped.scope.scopedInputHash,
      selectedStepsHash: stepsHash,
      selectedCount,
      interpretationHash: `interp-${tag}`,
      publicLandingHash: `landing-${tag}`,
      mappedPromptHash: `prompt-${tag}`,
      generationId: `gen-${tag}`,
    },
    finalInterpretation: {
      title: `Title ${tag}`,
      interpretationSummary: `Summary ${tag}`,
      rationale: 'r',
      imageIntent: 'i',
      visualNarrative: 'v',
      atmosphereHint: 'a',
      topicCategory: 'life',
      confidence: 0.9,
    },
  };

  const prepared = attachJourneySelectedStepsIfValid(
    preparedBase,
    selectedSteps
  );
  expect(prepared.journeySelectedSteps).toHaveLength(selectedCount);
  expect(prepared.journeySelectedSteps!.map((s) => s.publicQuestion)).toEqual(
    selectedSteps.map((s) => s.publicQuestion)
  );
  expect(prepared.journeySelectedSteps!.map((s) => s.sourceOrder)).toEqual(
    selectedSteps.map((s) => s.sourceOrder)
  );

  const card = applyDirectorPrepareToCard(baseCard(), prepared);
  const lineage = card.mirrorJourneyGenerationLineage;
  expect(lineage?.selectedSteps).toHaveLength(selectedCount);
  expect(lineage?.selectedSteps?.map((s) => s.publicQuestion)).toEqual(
    selectedSteps.map((s) => s.publicQuestion)
  );
  expect(lineage?.selectedSteps?.map((s) => s.publicAnswer)).toEqual(
    selectedSteps.map((s) => s.publicAnswer)
  );
  expect(lineage?.selectedSteps?.map((s) => s.stepIndex)).toEqual(
    selectedSteps.map((s) => s.stepIndex)
  );
  expect(lineage?.selectedStepsHash).toBe(stepsHash);
  expect(isPublishableJourneyGenerationLineage(lineage)).toBe(true);

  return { draft, scoped, selectedSteps, stepsHash, card, lineage: lineage! };
}

describe('selectedSteps seal 6–8 into journey lineage (P1)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllReview8Drafts();
    clearAllMirrorJourneyArtifactsForTests();
    apiMocks.putServerYansiPreparation.mockReset();
    apiMocks.patchServerConversation.mockReset();
    apiMocks.putServerYansiPreparation.mockResolvedValue({
      slug: 'prep-slug',
      journeyId: 'j',
      journeyVersion: 1,
      generationId: 'g',
      publicTitle: 'T',
      publicSummary: 'S',
      sceneImageUrl: 'https://cdn.example/s.png',
      status: 'ready_unpublished',
    });
    apiMocks.patchServerConversation.mockResolvedValue({
      id: 'srv-seal-6to8',
      clientConversationId: CONV,
      title: 'T',
      titlePinned: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
      hasReadyYansi: true,
      yansiIdentityGenerationId: 'gen',
      conversationSceneUrl: 'https://cdn.example/s.png',
    });
  });

  it('source gate uses isValidJourneySelectedStepCount, not === 8', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(src).toContain('isValidJourneySelectedStepCount');
    expect(src).not.toMatch(
      /journeySemanticScope\?\.selectedSteps\?\.length\s*===\s*8/
    );
  });

  it('validity helper: 6–8 ok; 5 and 9 rejected', () => {
    expect(JOURNEY_SELECTED_MIN).toBe(6);
    expect(JOURNEY_SELECTED_MAX).toBe(8);
    expect(isValidJourneySelectedStepCount(5)).toBe(false);
    expect(isValidJourneySelectedStepCount(6)).toBe(true);
    expect(isValidJourneySelectedStepCount(7)).toBe(true);
    expect(isValidJourneySelectedStepCount(8)).toBe(true);
    expect(isValidJourneySelectedStepCount(9)).toBe(false);
    expect(
      attachJourneySelectedStepsIfValid({}, Array.from({ length: 5 }, (_, i) => ({
        stepIndex: i + 1,
        sourceOrder: i,
        sourceUserMessageId: `u${i}`,
        sourceAssistantMessageId: `a${i}`,
        publicQuestion: `Q${i}`,
        publicAnswer: `A${i}`,
      }))).journeySelectedSteps
    ).toBeUndefined();
    expect(
      attachJourneySelectedStepsIfValid({}, Array.from({ length: 9 }, (_, i) => ({
        stepIndex: i + 1,
        sourceOrder: i,
        sourceUserMessageId: `u${i}`,
        sourceAssistantMessageId: `a${i}`,
        publicQuestion: `Q${i}`,
        publicAnswer: `A${i}`,
      }))).journeySelectedSteps
    ).toBeUndefined();
  });

  it('6 selected: prepare → seal → READY persist + exact publish identity', async () => {
    const { draft, selectedSteps, stepsHash, lineage } = await prepareAndSeal(
      6,
      'six'
    );
    expect(selectedSteps).toHaveLength(6);
    expect(lineage.selectedSteps).toHaveLength(6);
    expect(lineage.selectedStepsHash).toBe(stepsHash);

    markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 6,
      selectedStepsHash: stepsHash,
    });
    const ready = markMirrorJourneyArtifactReadyFromLineage(OWNER, {
      lineage: {
        ...lineage,
        journeyId: draft.journeyId!,
        journeyVersion: draft.journeyVersion ?? 1,
        sourceConversationId: CONV,
        generationId: 'gen-six',
      } as typeof lineage & { journeyId: string },
      sceneImageUrl: 'https://cdn.example/six.png',
      publicTitle: 'Title six',
      publicSummary: 'Summary six',
    });
    expect(ready?.status).toBe('ready');
    expect(ready?.selectedCount).toBe(6);
    expect(ready?.sealedLineage?.selectedSteps).toHaveLength(6);
    expect(
      ready?.sealedLineage?.selectedSteps?.map((s) => s.publicQuestion)
    ).toEqual(selectedSteps.map((s) => s.publicQuestion));

    await bootstrapServerConversations(OWNER);
    const auth = (await import('@/lib/eza/serverConversationStore')).getServerConversationAuthority();
    const persisted = await persistAuthenticatedReadyYansi({
      artifact: ready!,
      clientConversationId: CONV,
      bound: { ownerUserId: OWNER, epoch: auth.epoch },
      ownerNow: OWNER,
      sceneFocalX: null,
      sceneFocalY: null,
    });
    expect(apiMocks.putServerYansiPreparation).toHaveBeenCalled();
    expect(persisted).toBeTruthy();
    noteServerYansiReady(CONV);

    const identity = captureExactYansiPublishIdentity(ready!);
    expect(identity?.journeyId).toBe(draft.journeyId);
    expect(identity?.sealedLineage.selectedSteps).toHaveLength(6);
    expect(identity?.sealedLineage.selectedStepsHash).toBe(stepsHash);
    expect(
      exactIdentityMatchesCardLineage(identity!, ready!.sealedLineage)
    ).toBe(true);
  });

  it('7 selected: prepare → seal → READY persist', async () => {
    const { draft, selectedSteps, stepsHash, lineage } = await prepareAndSeal(
      7,
      'seven'
    );
    expect(selectedSteps).toHaveLength(7);
    expect(lineage.selectedSteps).toHaveLength(7);
    expect(lineage.selectedStepsHash).toBe(stepsHash);

    markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 7,
      selectedStepsHash: stepsHash,
    });
    const ready = markMirrorJourneyArtifactReadyFromLineage(OWNER, {
      lineage: {
        ...lineage,
        journeyId: draft.journeyId!,
        journeyVersion: draft.journeyVersion ?? 1,
        sourceConversationId: CONV,
        generationId: 'gen-seven',
      } as typeof lineage & { journeyId: string },
      sceneImageUrl: 'https://cdn.example/seven.png',
      publicTitle: 'Title seven',
      publicSummary: 'Summary seven',
    });
    expect(ready?.status).toBe('ready');
    expect(ready?.sealedLineage?.selectedSteps).toHaveLength(7);
    expect(
      ready?.sealedLineage?.selectedSteps?.map((s) => s.sourceOrder)
    ).toEqual(selectedSteps.map((s) => s.sourceOrder));
  });

  it('8 selected still seals (no regression)', async () => {
    const { selectedSteps, lineage, stepsHash } = await prepareAndSeal(8, 'eight');
    expect(selectedSteps).toHaveLength(8);
    expect(lineage.selectedSteps).toHaveLength(8);
    expect(lineage.selectedStepsHash).toBe(stepsHash);
  });

  it('excluded Q/A from 8-candidate window stay out of sealed 6', async () => {
    const pairs = eightPairs('excl');
    const { selectedSteps, lineage } = await prepareAndSeal(6, 'excl');
    const sealedQs = new Set(
      lineage.selectedSteps!.map((s) => s.publicQuestion)
    );
    const excluded = pairs.slice(6).map((p) => p.publicQuestion);
    for (const q of excluded) {
      expect(sealedQs.has(q)).toBe(false);
    }
    expect(selectedSteps.map((s) => s.publicQuestion)).toEqual(
      pairs.slice(0, 6).map((p) => p.publicQuestion)
    );
  });

  it('retry preserves exact 6 and 7 selectedSteps identity', async () => {
    for (const n of [6, 7] as const) {
      localStorage.clear();
      sessionStorage.clear();
      clearAllReview8Drafts();
      clearAllMirrorJourneyArtifactsForTests();

      const { draft, selectedSteps, stepsHash } = await prepareAndSeal(
        n,
        `retry${n}`
      );
      const journeyId = draft.journeyId!;

      // Failed generation then pending re-arm still resolves the same sealed draft.
      markMirrorJourneyArtifactGenerating(OWNER, {
        journeyId,
        journeyVersion: draft.journeyVersion ?? 1,
        sourceConversationId: CONV,
        blockIndex: 0,
        selectedCount: n,
        selectedStepsHash: stepsHash,
      });
      markMirrorJourneyArtifactFailed(OWNER, {
        journeyId,
        journeyVersion: draft.journeyVersion ?? 1,
        message: 'transient_error',
      });
      expect(
        loadMirrorJourneyArtifact(OWNER, journeyId, draft.journeyVersion ?? 1)
          ?.status
      ).toBe('failed');

      requestJourneyAynaGeneration({
        conversationId: CONV,
        journeyId,
        journeyVersion: draft.journeyVersion ?? 1,
      });
      const pending = readPendingJourneyAynaGeneration(CONV);
      expect(pending?.journeyId).toBe(journeyId);

      const reloaded = resolveScopedJourneyMeaning(draft);
      expect(reloaded.ok).toBe(true);
      if (!reloaded.ok) return;
      expect(reloaded.scope.selectedSteps).toHaveLength(n);
      expect(reloaded.scope.selectedSteps.map((s) => s.publicQuestion)).toEqual(
        selectedSteps.map((s) => s.publicQuestion)
      );
      expect(reloaded.scope.selectedSteps.map((s) => s.sourceOrder)).toEqual(
        selectedSteps.map((s) => s.sourceOrder)
      );
      const attached = attachJourneySelectedStepsIfValid(
        {},
        reloaded.scope.selectedSteps
      );
      expect(attached.journeySelectedSteps).toHaveLength(n);
      const retryHash = await computeSelectedStepsHash(draft.selectedSteps);
      expect(retryHash).toBe(stepsHash);
    }
  });
});
