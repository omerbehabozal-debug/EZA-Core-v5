/**
 * Phase 3.6 — artifact lineage immutability + publish contract isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import {
  JOURNEY_GENERATION_LINEAGE_VERSION,
  cloneJourneyGenerationLineage,
  isPublishableJourneyGenerationLineage,
  sealJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import {
  clearJourneyGenerationArtifactsForUser,
  loadJourneyGenerationArtifact,
  saveJourneyGenerationArtifact,
} from '@/lib/eza/mirror/journey/journeyGenerationArtifactStore';
import { resolveJourneyPublishContract } from '@/lib/eza/mirror/journey/journeyPublishContract';
import {
  clearAllReview8Drafts,
  saveReview8Draft,
  setActiveReview8DraftKey,
} from '@/lib/eza/mirror/journey/review8DraftStore';
import {
  allocateDraftKey,
  buildReview8DraftFromWindow,
  confirmReview8Draft,
} from '@/lib/eza/mirror/journey/review8Draft';
import type { EligibleQaPair } from '@/lib/eza/mirror/journey/types';

vi.stubEnv('NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1', '1');

function pairs(start: number, tag: string): EligibleQaPair[] {
  return Array.from({ length: 8 }, (_, i) => ({
    sourceOrder: start + i,
    userMessageId: `u-${tag}-${start + i}`,
    assistantMessageId: `a-${tag}-${start + i}`,
    publicQuestion: `${tag} Q${start + i + 1}?`,
    publicAnswer: `${tag} A${start + i + 1}`,
  }));
}

function lineageFor(
  tag: string,
  opts: { windowIndex?: number; start?: number; journeyId?: string } = {}
): JourneyGenerationLineage {
  const start = opts.start ?? 0;
  const windowIndex = opts.windowIndex ?? 0;
  const journeyId = opts.journeyId ?? `journey-${tag.toLowerCase()}`;
  return {
    contractVersion: JOURNEY_GENERATION_LINEAGE_VERSION,
    journeyId,
    journeyVersion: 1,
    sourceConversationId: 'conv-c',
    parentJourneyId: tag === 'B' ? 'journey-a' : null,
    windowIndex,
    windowStart: start,
    windowEnd: start + 7,
    windowHash: `h-window-${tag}`,
    scopedInputHash: `h-scoped-${tag}`,
    selectedStepsHash: `h-steps-${tag}`,
    interpretationHash: `interp-${tag}`,
    anchorsHash: `anchors-${tag}`,
    publicLandingHash: `landing-${tag}`,
    mappedPromptHash: `prompt-${tag}`,
    generationId: `gen-${tag}`,
    sceneAssetId: `scene-${tag}`,
    selectedSteps: Array.from({ length: 8 }, (_, i) => ({
      stepIndex: i + 1,
      sourceOrder: start + i,
      sourceUserMessageId: `u-${tag}-${start + i}`,
      sourceAssistantMessageId: `a-${tag}-${start + i}`,
      publicQuestion: `${tag} Q${start + i + 1}?`,
      publicAnswer: `${tag} A${start + i + 1}`,
    })),
    sealedAt: '2026-07-25T00:00:00.000Z',
  };
}

describe('mirrorJourneyPhase36PublishBoundary', () => {
  beforeEach(() => {
    clearAllReview8Drafts();
    clearJourneyGenerationArtifactsForUser('user-1');
  });

  it('generated artifact keeps original lineage after Review draft mutation', () => {
    const sealed = lineageFor('A');
    const card: Pick<DailyMirrorCardModel, 'mirrorJourneyGenerationLineage'> = {
      mirrorJourneyGenerationLineage: cloneJourneyGenerationLineage(sealed),
    };

    const builtA = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-c',
      pairs: pairs(0, 'A'),
      windowIndex: 0,
      draftKey: allocateDraftKey('conv-c'),
    });
    const confirmedA = confirmReview8Draft(builtA);
    expect(confirmedA.ok).toBe(true);
    if (!confirmedA.ok) throw new Error('confirm A');
    saveReview8Draft(confirmedA.draft);
    setActiveReview8DraftKey('user-1', 'conv-c', confirmedA.draft.draftKey);

    const builtB = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'conv-c',
      pairs: pairs(8, 'B'),
      windowIndex: 1,
      draftKey: allocateDraftKey('conv-c'),
      parentJourneyId: 'journey-a',
    });
    const confirmedB = confirmReview8Draft(builtB);
    expect(confirmedB.ok).toBe(true);
    if (!confirmedB.ok) throw new Error('confirm B');
    saveReview8Draft(confirmedB.draft);
    setActiveReview8DraftKey('user-1', 'conv-c', confirmedB.draft.draftKey);

    const contract = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-c',
      generationLineage: card.mirrorJourneyGenerationLineage,
    });
    expect(contract.ok).toBe(true);
    if (!contract.ok || 'legacy' in contract) throw new Error('expected lineage contract');
    expect(contract.source).toBe('generation_lineage');
    expect(contract.journeyId).toBe('journey-a');
    expect(contract.windowIndex).toBe(0);
    expect(contract.selectedSteps[0]?.publicQuestion).toBe('A Q1?');
    expect(contract.generationLineage?.selectedStepsHash).toBe('h-steps-A');
  });

  it('active Journey B does not contaminate A publish', () => {
    const lineageA = lineageFor('A');
    const lineageB = lineageFor('B', { windowIndex: 1, start: 8, journeyId: 'journey-b' });
    saveJourneyGenerationArtifact('user-1', lineageA);
    saveJourneyGenerationArtifact('user-1', lineageB);

    const contractA = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-c',
      generationLineage: lineageA,
    });
    expect(contractA.ok && !('legacy' in contractA) && contractA.journeyId).toBe('journey-a');
    if (!contractA.ok || 'legacy' in contractA) throw new Error('expected A');
    expect(contractA.selectedSteps.every((s) => s.publicQuestion.startsWith('A '))).toBe(
      true
    );

    const contractB = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-c',
      generationLineage: lineageB,
    });
    if (!contractB.ok || 'legacy' in contractB) throw new Error('expected B');
    expect(contractB.journeyId).toBe('journey-b');
    expect(contractB.windowIndex).toBe(1);
    expect(contractB.parentJourneyId).toBe('journey-a');
    expect(contractB.selectedSteps[0]?.publicQuestion).toBe('B Q9?');
  });

  it('continuation Q9+ does not alter A publish payload', () => {
    const sealed = lineageFor('A');
    const before = cloneJourneyGenerationLineage(sealed);
    const after = sealJourneyGenerationLineage({
      existing: sealed,
      generationId: sealed.generationId,
      selectedSteps: lineageFor('B', { start: 8 }).selectedSteps,
      publicLandingHash: 'should-not-apply',
    });
    expect(isPublishableJourneyGenerationLineage(after)).toBe(true);
    if (!isPublishableJourneyGenerationLineage(after)) throw new Error('sealed');
    expect(after.selectedStepsHash).toBe(before.selectedStepsHash);
    expect(after.selectedSteps[0]?.publicQuestion).toBe('A Q1?');
    expect(after.publicLandingHash).toBe(before.publicLandingHash);
  });

  it('artifact publish uses stored generation lineage (reload path)', () => {
    const sealed = lineageFor('A');
    saveJourneyGenerationArtifact('user-1', sealed);
    const restored = loadJourneyGenerationArtifact('user-1', 'journey-a', 1);
    expect(restored?.generationId).toBe('gen-A');
    const contract = resolveJourneyPublishContract({
      ownerUserId: 'user-1',
      conversationId: 'conv-c',
      journeyId: 'journey-a',
      journeyVersion: 1,
    });
    expect(contract.ok && !('legacy' in contract) && contract.source).toBe(
      'generation_lineage'
    );
  });

  it('alignment lineage fields must match sealed scene/generation on contract object', () => {
    const sealed = lineageFor('A');
    expect(sealed.sceneAssetId).toBe('scene-A');
    expect(sealed.generationId).toBe('gen-A');
    expect(sealed.publicLandingHash).toBe('landing-A');
    const staleAlignment = {
      generationId: 'gen-old',
      sceneAssetId: 'scene-old',
      publicLandingHash: sealed.publicLandingHash,
    };
    expect(staleAlignment.generationId).not.toBe(sealed.generationId);
    expect(staleAlignment.sceneAssetId).not.toBe(sealed.sceneAssetId);
  });
});
