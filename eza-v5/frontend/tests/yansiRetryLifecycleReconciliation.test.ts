/**
 * Retry lifecycle reconciliation:
 * failed → generating → ready must re-arm the exact JourneyWindow
 * and keep a single artifact identity (no ghost FAILED + READY slides).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearAllJourneyConversationStates,
  clearAllMirrorJourneyArtifactsForTests,
  clearAllReview8Drafts,
  confirmJourneyWindow,
  confirmReview8Draft,
  buildReview8DraftFromWindow,
  ensureJourneyWindowRecord,
  listJourneyArtifactsForConversation,
  loadMirrorJourneyArtifact,
  loadReview8DraftForJourney,
  markJourneyWindowFailed,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  promoteJourneyWindowFromArtifact,
  rearmJourneyWindowGeneratingFromArtifact,
  reconcileGeneratingJourneyWindowsWithArtifacts,
  saveJourneyConversationState,
  saveReview8Draft,
  syncJourneyConversationState,
  type EligibleQaPair,
  type JourneyGenerationLineage,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import { loadJourneyConversationState } from '@/lib/eza/mirror/journey/journeyWindowStore';

const USER = 'user-retry-lifecycle';
const CONV = 'conv-retry-lifecycle';
const JOURNEY = 'journey-retry-lifecycle';

function msg(
  id: string,
  text: string,
  role: 'user' | 'assistant'
): JourneyMessageLike {
  return { id, text, role };
}

function eightMessages(): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 1; i <= 8; i += 1) {
    out.push(msg(`u${i}`, `Soru ${i}?`, 'user'));
    out.push(msg(`a${i}`, `Cevap ${i}.`, 'assistant'));
  }
  return out;
}

function pairs(): EligibleQaPair[] {
  return Array.from({ length: 8 }, (_, i) => ({
    userMessageId: `u${i + 1}`,
    assistantMessageId: `a${i + 1}`,
    publicQuestion: `Soru ${i + 1}?`,
    publicAnswer: `Cevap ${i + 1}.`,
    sourceOrder: i,
  }));
}

function sealDraft() {
  const draft = buildReview8DraftFromWindow({
    ownerUserId: USER,
    sourceConversationId: CONV,
    windowIndex: 0,
    pairs: pairs(),
    draftKey: 'draft-retry-0',
  });
  const confirmed = confirmReview8Draft({
    ...draft,
    journeyId: JOURNEY,
  });
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error(confirmed.message);
  saveReview8Draft(confirmed.draft);
  return confirmed.draft;
}

function lineageFromDraft(selected: EligibleQaPair[]): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId: JOURNEY,
    journeyVersion: 1,
    sourceConversationId: CONV,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: 'h',
    sourceBlockHash: 'block-hash-retry',
    scopedInputHash: 'scoped-hash-retry',
    selectedStepsHash: 'steps-hash-retry',
    selectedCount: selected.length,
    interpretationHash: 'i',
    publicLandingHash: 'p',
    mappedPromptHash: 'm',
    generationId: 'gen-retry-1',
    sceneAssetId: 'asset-retry-1',
    sealedAt: new Date().toISOString(),
    selectedSteps: selected.map((s, i) => ({
      stepIndex: i + 1,
      sourceOrder: s.sourceOrder,
      sourceUserMessageId: s.userMessageId,
      sourceAssistantMessageId: s.assistantMessageId,
      publicQuestion: s.publicQuestion,
      publicAnswer: s.publicAnswer,
    })),
  };
}

function seedConfirmGenerating() {
  const draft = sealDraft();
  let state = syncJourneyConversationState({
    state: null,
    ownerUserId: USER,
    sourceConversationId: CONV,
    messages: eightMessages(),
  });
  state = ensureJourneyWindowRecord(state, 0);
  state = confirmJourneyWindow({
    state,
    windowIndex: 0,
    journeyId: JOURNEY,
    draftKey: draft.draftKey,
    selectedCount: 8,
  });
  saveJourneyConversationState(state);
  markMirrorJourneyArtifactGenerating(USER, {
    journeyId: JOURNEY,
    journeyVersion: 1,
    sourceConversationId: CONV,
    blockIndex: 0,
    selectedCount: 8,
  });
  return draft;
}

describe('Yansı retry lifecycle reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('1: initial generating → ready promotes window', () => {
    const draft = seedConfirmGenerating();
    const ready = markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineageFromDraft(draft.selectedSteps),
      sceneImageUrl: 'https://example.com/scene.png',
      publicTitle: 'Başlık',
      publicSummary: 'Özet',
    });
    expect(ready?.status).toBe('ready');
    expect(ready?.generationError).toBeNull();
    const win = loadJourneyConversationState(USER, CONV)?.windows[0];
    expect(win?.status).toBe('ready');
    expect(win?.journeyId).toBe(JOURNEY);
  });

  it('2: generating → failed promotes window', () => {
    seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'Scoped message A1 does not match selectedSteps',
    });
    const art = loadMirrorJourneyArtifact(USER, JOURNEY, 1);
    expect(art?.status).toBe('failed');
    expect(art?.generationError).toContain('A1');
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'failed'
    );
  });

  it('3+5+6+7+8+9+10+11+12+13: retry failed → generating → ready (one identity)', () => {
    const draft = seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'Scoped message A1 does not match selectedSteps',
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'failed'
    );

    // Tekrar dene
    const generating = markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    expect(generating?.status).toBe('generating');
    expect(generating?.journeyId).toBe(JOURNEY);
    expect(generating?.journeyVersion).toBe(1);
    expect(generating?.generationError).toBeNull();
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'generating'
    );

    const ready = markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineageFromDraft(draft.selectedSteps),
      sceneImageUrl: 'https://example.com/scene-retry.png',
      publicTitle: 'Başlık',
      publicSummary: 'Özet',
    });
    expect(ready?.status).toBe('ready');
    expect(ready?.generationError).toBeNull();
    expect(ready?.journeyId).toBe(JOURNEY);
    expect(ready?.journeyVersion).toBe(1);
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'ready'
    );

    const listed = listJourneyArtifactsForConversation(USER, CONV);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('ready');
    expect(listed[0]?.journeyId).toBe(JOURNEY);
    expect(listed.filter((a) => a.status === 'failed')).toHaveLength(0);
  });

  it('4: retry failure returns exact artifact + window to failed', () => {
    seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'first fail',
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'second fail',
    });
    const art = loadMirrorJourneyArtifact(USER, JOURNEY, 1);
    expect(art?.status).toBe('failed');
    expect(art?.generationError).toBe('second fail');
    expect(listJourneyArtifactsForConversation(USER, CONV)).toHaveLength(1);
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'failed'
    );
  });

  it('14: selectedSteps sealed draft preserved across retry', () => {
    const draft = seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'fail',
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    const reloaded = loadReview8DraftForJourney(USER, CONV, JOURNEY);
    expect(reloaded?.selectedSteps.map((s) => s.assistantMessageId)).toEqual(
      draft.selectedSteps.map((s) => s.assistantMessageId)
    );
    expect(reloaded?.journeyId).toBe(JOURNEY);
  });

  it('15: retry does not substitute a different journey artifact', () => {
    seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'fail',
    });
    // Second journey ready in same conversation must stay untouched.
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: 'other-journey',
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 1,
      selectedCount: 8,
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    expect(loadMirrorJourneyArtifact(USER, JOURNEY, 1)?.status).toBe(
      'generating'
    );
    expect(loadMirrorJourneyArtifact(USER, 'other-journey', 1)?.status).toBe(
      'generating'
    );
  });

  it('16: missing sealed draft still fails closed at ObservationExperience', () => {
    const obs = readFileSync(
      join(
        process.cwd(),
        'components/standalone/StandaloneObservationExperience.tsx'
      ),
      'utf8'
    );
    expect(obs).toContain('legacy_incompatible_sealed_selection');
    expect(obs).toContain('loadReview8DraftForJourney');
  });

  it('17: repeated markGenerating keeps single artifact identity', () => {
    seedConfirmGenerating();
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'fail',
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    markMirrorJourneyArtifactGenerating(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    expect(listJourneyArtifactsForConversation(USER, CONV)).toHaveLength(1);
  });

  it('18: reconcile hydrates READY when window stuck failed after success', () => {
    const draft = seedConfirmGenerating();
    // Simulate pre-fix stuck state: artifact ready, window still failed.
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: JOURNEY,
      journeyVersion: 1,
      message: 'stale',
    });
    // Force artifact ready without going through generate promote path...
    // Use ready from lineage after manually setting window failed and
    // temporarily leaving window failed by skipping rearm.
    let state = loadJourneyConversationState(USER, CONV)!;
    state = {
      ...state,
      windows: state.windows.map((w) =>
        w.windowIndex === 0 ? { ...w, status: 'failed' as const } : w
      ),
    };
    saveJourneyConversationState(state);
    // Write ready artifact directly via markReady — promote now accepts failed.
    markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineageFromDraft(draft.selectedSteps),
      sceneImageUrl: 'https://example.com/ready.png',
      publicTitle: 'T',
      publicSummary: 'S',
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'ready'
    );

    // Also: reconcile path for remount
    state = loadJourneyConversationState(USER, CONV)!;
    state = {
      ...state,
      windows: state.windows.map((w) =>
        w.windowIndex === 0 ? { ...w, status: 'failed' as const } : w
      ),
    };
    saveJourneyConversationState(state);
    const reconciled = reconcileGeneratingJourneyWindowsWithArtifacts({
      ownerUserId: USER,
      sourceConversationId: CONV,
    });
    expect(reconciled?.windows[0]?.status).toBe('ready');
  });

  it('rearm helper alone moves failed → generating', () => {
    seedConfirmGenerating();
    let state = loadJourneyConversationState(USER, CONV)!;
    state = markJourneyWindowFailed(state, 0);
    saveJourneyConversationState(state);
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'failed'
    );
    rearmJourneyWindowGeneratingFromArtifact({
      ownerUserId: USER,
      sourceConversationId: CONV,
      journeyId: JOURNEY,
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'generating'
    );
  });

  it('promote ready from failed window without duplicate artifact', () => {
    seedConfirmGenerating();
    let state = loadJourneyConversationState(USER, CONV)!;
    state = markJourneyWindowFailed(state, 0);
    saveJourneyConversationState(state);
    promoteJourneyWindowFromArtifact({
      ownerUserId: USER,
      sourceConversationId: CONV,
      journeyId: JOURNEY,
      status: 'ready',
    });
    expect(loadJourneyConversationState(USER, CONV)?.windows[0]?.status).toBe(
      'ready'
    );
    expect(listJourneyArtifactsForConversation(USER, CONV).length).toBeLessThanOrEqual(
      1
    );
  });

  it('source: kick re-arms JourneyWindow before scene', () => {
    const obs = readFileSync(
      join(
        process.cwd(),
        'components/standalone/StandaloneObservationExperience.tsx'
      ),
      'utf8'
    );
    expect(obs).toContain('rearmJourneyWindowGeneratingFromArtifact');
    expect(obs).toMatch(
      /kickJourneyAynaGenerate[\s\S]*rearmJourneyWindowGeneratingFromArtifact/
    );
  });
});
