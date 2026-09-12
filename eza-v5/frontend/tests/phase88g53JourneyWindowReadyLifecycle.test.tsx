/**
 * Journey window ready only after durable Yansı artifact success —
 * Review confirm alone must leave status generating.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Review8Screen, {
  review8SelectionRangeCopy,
} from '@/components/mirror/Review8Screen';
import {
  buildReview8DraftFromWindow,
  clearAllJourneyConversationStates,
  clearAllMirrorJourneyArtifactsForTests,
  clearAllReview8Drafts,
  confirmJourneyWindow,
  confirmReview8Draft,
  ensureJourneyWindowRecord,
  extractQaPairs,
  markJourneyWindowReviewing,
  markMirrorJourneyArtifactFailed,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactReadyFromLineage,
  pairsForWindow,
  reconcileGeneratingJourneyWindowsWithArtifacts,
  saveJourneyConversationState,
  shouldSkipAynaSceneGeneration,
  syncJourneyConversationState,
  listJourneyArtifactsForConversation,
  type EligibleQaPair,
  type JourneyGenerationLineage,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import { loadJourneyConversationState } from '@/lib/eza/mirror/journey/journeyWindowStore';
import { readPendingJourneyAynaGeneration } from '@/lib/eza/mirror/journey/journeyAynaGenerate';

const USER = 'user-ready-lifecycle';
const CONV = 'conv-ready-lifecycle';

function msg(
  id: string,
  text: string,
  opts: Partial<JourneyMessageLike> = {}
): JourneyMessageLike {
  return {
    id,
    text,
    isUser: opts.isUser,
    role: opts.role,
    incomplete: opts.incomplete,
  };
}

function buildPairs(n: number): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = i + 1;
    out.push(msg(`u${idx}`, `Soru ${idx} hakkında ne dersin?`, { role: 'user' }));
    out.push(
      msg(`a${idx}`, `Cevap ${idx} için net ve tamamlanmış yanıt.`, {
        role: 'assistant',
      })
    );
  }
  return out;
}

function lineage(
  journeyId: string,
  selected: EligibleQaPair[],
  conv = CONV
): JourneyGenerationLineage {
  return {
    contractVersion: 'journey_generation_lineage_v1',
    journeyId,
    journeyVersion: 1,
    sourceConversationId: conv,
    windowIndex: 0,
    windowStart: 0,
    windowEnd: 7,
    blockIndex: 0,
    windowHash: 'h',
    sourceBlockHash: 'b',
    scopedInputHash: 's',
    selectedStepsHash: 't',
    selectedCount: selected.length,
    interpretationHash: 'i',
    publicLandingHash: 'p',
    mappedPromptHash: 'm',
    generationId: 'gen-1',
    sceneAssetId: 'asset-1',
    sealedAt: new Date().toISOString(),
    selectedSteps: selected.map((p, i) => ({
      stepIndex: i + 1,
      sourceOrder: p.sourceOrder,
      sourceUserMessageId: p.userMessageId,
      sourceAssistantMessageId: p.assistantMessageId,
      publicQuestion: p.publicQuestion,
      publicAnswer: p.publicAnswer,
    })),
  };
}

function confirmPool(poolSize: number) {
  const messages = buildPairs(poolSize);
  let state = syncJourneyConversationState({
    state: null,
    ownerUserId: USER,
    sourceConversationId: CONV,
    messages,
  });
  state = ensureJourneyWindowRecord(state, 0);
  state = markJourneyWindowReviewing(state, 0);
  const pairs = pairsForWindow(extractQaPairs(messages), 0);
  expect(pairs.length).toBe(poolSize);
  const draft = buildReview8DraftFromWindow({
    ownerUserId: USER,
    sourceConversationId: CONV,
    windowIndex: 0,
    pairs,
    draftKey: state.windows[0]!.draftKey!,
  });
  const confirmed = confirmReview8Draft(draft);
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error('confirm failed');
  state = confirmJourneyWindow({
    state,
    windowIndex: 0,
    journeyId: confirmed.draft.journeyId!,
    draftKey: confirmed.draft.draftKey,
    selectedCount: confirmed.draft.selectedSteps.length,
  });
  const saved = saveJourneyConversationState(state);
  expect(saved.ok).toBe(true);
  markMirrorJourneyArtifactGenerating(USER, {
    journeyId: confirmed.draft.journeyId!,
    sourceConversationId: CONV,
    blockIndex: 0,
    selectedCount: confirmed.draft.selectedSteps.length,
  });
  return { state: saved.ok ? saved.state : state, draft: confirmed.draft, pairs };
}

describe('phase88g53 Journey window ready after artifact', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
    clearAllMirrorJourneyArtifactsForTests();
  });
  afterEach(() => {
    clearAllReview8Drafts();
    clearAllJourneyConversationStates();
    clearAllMirrorJourneyArtifactsForTests();
  });

  it('A: 6-pair Review confirm → generating, not ready', () => {
    const { state } = confirmPool(6);
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.status).not.toBe('ready');
  });

  it('B: 7-pair Review confirm → generating, not ready', () => {
    const { state } = confirmPool(7);
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.status).not.toBe('ready');
  });

  it('C: 8-pair Review confirm → generating, not ready', () => {
    const { state } = confirmPool(8);
    expect(state.windows[0]?.status).toBe('generating');
    expect(state.windows[0]?.status).not.toBe('ready');
  });

  it('D: successful artifact completion → ready', () => {
    const { state, draft, pairs } = confirmPool(8);
    expect(state.windows[0]?.status).toBe('generating');
    markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineage(draft.journeyId!, pairs.slice(0, draft.selectedSteps.length)),
      sceneImageUrl: 'https://cdn/x/mirror-scene-assets/asset-1',
      publicTitle: 'Ready title',
    });
    const after = loadJourneyConversationState(USER, CONV);
    expect(after?.windows[0]?.status).toBe('ready');
  });

  it('E: generation failure → never ready', () => {
    const { draft } = confirmPool(8);
    markMirrorJourneyArtifactFailed(USER, {
      journeyId: draft.journeyId!,
      journeyVersion: 1,
      message: 'scene failed',
    });
    const after = loadJourneyConversationState(USER, CONV);
    expect(after?.windows[0]?.status).toBe('failed');
    expect(after?.windows[0]?.status).not.toBe('ready');
  });

  it('F: existing completed artifact hydrate → ready, no regeneration', () => {
    const { draft, pairs } = confirmPool(8);
    markMirrorJourneyArtifactReadyFromLineage(USER, {
      lineage: lineage(draft.journeyId!, pairs.slice(0, draft.selectedSteps.length)),
      sceneImageUrl: 'https://cdn/x/mirror-scene-assets/asset-1',
      publicTitle: 'Hydrated',
    });
    // Simulate remount with generating left in storage before reconcile:
    const mid = loadJourneyConversationState(USER, CONV)!;
    expect(mid.windows[0]?.status).toBe('ready');
    // Force generating again to exercise reconcile path
    const forced = {
      ...mid,
      windows: mid.windows.map((w) =>
        w.windowIndex === 0 ? { ...w, status: 'generating' as const } : w
      ),
      stateVersion: mid.stateVersion,
    };
    const saved = saveJourneyConversationState(forced);
    expect(saved.ok).toBe(true);
    expect(saved.state.windows[0]?.status).toBe('generating');

    const artifacts = listJourneyArtifactsForConversation(USER, CONV);
    expect(
      shouldSkipAynaSceneGeneration({
        artifacts,
        journeyId: draft.journeyId!,
      })
    ).toBe(true);

    const reconciled = reconcileGeneratingJourneyWindowsWithArtifacts({
      ownerUserId: USER,
      sourceConversationId: CONV,
    });
    expect(reconciled?.windows[0]?.status).toBe('ready');
    // Kick would be skipped by reusable check — pending must not be required.
    expect(readPendingJourneyAynaGeneration(CONV)).toBeNull();
  });

  it('G: Review copy matches pool size', () => {
    expect(review8SelectionRangeCopy(6)).toBe('6');
    expect(review8SelectionRangeCopy(7)).toBe('6–7');
    expect(review8SelectionRangeCopy(8)).toBe('6–8');

    const pairs6 = pairsForWindow(extractQaPairs(buildPairs(6)), 0);
    render(
      <Review8Screen
        ownerUserId={USER}
        sourceConversationId={CONV}
        windowPairs={pairs6}
        windowIndex={0}
        draftKey="draft-6"
        onConfirmed={() => {}}
        onCancel={() => {}}
      />
    );
    const body = screen.getByTestId('review8-screen').textContent || '';
    expect(body).toContain('6 tanesini');
    expect(body).not.toMatch(/6–8/);
  });

  it('G2: 7-pool and 8-pool copy', () => {
    const pairs7 = pairsForWindow(extractQaPairs(buildPairs(7)), 0);
    const { unmount } = render(
      <Review8Screen
        ownerUserId={USER}
        sourceConversationId={`${CONV}-7`}
        windowPairs={pairs7}
        windowIndex={0}
        draftKey="draft-7"
        onConfirmed={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('review8-screen').textContent).toMatch(/6–7/);
    unmount();

    const pairs8 = pairsForWindow(extractQaPairs(buildPairs(8)), 0);
    render(
      <Review8Screen
        ownerUserId={USER}
        sourceConversationId={`${CONV}-8`}
        windowPairs={pairs8}
        windowIndex={0}
        draftKey="draft-8"
        onConfirmed={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('review8-screen').textContent).toMatch(/6–8/);
  });

  it('H: generation payload / draft keeps only selected Q/A', () => {
    const pairs8 = pairsForWindow(extractQaPairs(buildPairs(8)), 0);
    let draft6 = buildReview8DraftFromWindow({
      ownerUserId: `${USER}-h`,
      sourceConversationId: `${CONV}-h`,
      windowIndex: 0,
      pairs: pairs8,
      draftKey: 'draft-h',
    });
    draft6 = {
      ...draft6,
      selectedSourceOrders: pairs8.slice(0, 6).map((p) => p.sourceOrder),
      selectedSteps: pairs8.slice(0, 6).map((p, i) => ({
        ...p,
        index: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      })),
    };
    const confirmed = confirmReview8Draft(draft6);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error('fail');
    expect(confirmed.draft.selectedSteps).toHaveLength(6);
    expect(confirmed.draft.selectedSteps.map((s) => s.sourceOrder)).toEqual(
      pairs8.slice(0, 6).map((p) => p.sourceOrder)
    );
    expect(confirmed.draft.selectedSteps.map((s) => s.sourceOrder)).not.toContain(
      pairs8[6]!.sourceOrder
    );
  });

  it('source: ChatInner no longer marks ready on confirm timeout', () => {
    const chat = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    expect(chat).not.toMatch(
      /Phase 3 will run meaning pipeline[\s\S]*markJourneyWindowReady/
    );
    expect(chat).not.toMatch(
      /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*markJourneyWindowReady/
    );
    expect(chat).toContain('promoteJourneyWindowFromArtifact');
    expect(chat).toContain('requestJourneyAynaGeneration');
    expect(chat).toContain('reconcileGeneratingJourneyWindowsWithArtifacts');
  });

  it('source: Observation fails artifact on generation error', () => {
    const obs = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(obs).toContain('markMirrorJourneyArtifactFailed');
    expect(obs).toContain('promoteJourneyWindowFromArtifact');
  });
});
