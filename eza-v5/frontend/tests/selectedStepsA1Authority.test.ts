/**
 * Regression: sealed selectedSteps authority for Ayna prepare / retry / re-arm.
 *
 * Live fail: "Scoped message A1 does not match selectedSteps" after infinite
 * Hazırlanıyor fix — prepare reached validation; root cause was backend
 * sanitize asymmetry (fixed separately). These tests lock frontend identity:
 * exact journey draft, no latest-window substitution, retry re-kicks same id.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReview8DraftFromWindow,
  confirmReview8Draft,
  pairsToSelectedSteps,
  saveReview8Draft,
  loadActiveReview8Draft,
  loadReview8DraftForJourney,
  setActiveReview8DraftKey,
  listReview8DraftsForConversation,
  resolveScopedJourneyMeaning,
  buildScopedPrepareMessagesFromSteps,
  requestJourneyAynaGeneration,
  readPendingJourneyAynaGeneration,
  consumePendingJourneyAynaGeneration,
  JOURNEY_AYNA_GENERATE_PENDING_KEY,
  markMirrorJourneyArtifactGenerating,
  markMirrorJourneyArtifactFailed,
  loadMirrorJourneyArtifact,
  type EligibleQaPair,
} from '@/lib/eza/mirror/journey';

const OWNER = 'user-a1-authority';
const CONV = 'conv-a1-authority';

function pairsForWindow(windowIndex: number, tag: string): EligibleQaPair[] {
  const start = windowIndex * 8;
  return Array.from({ length: 8 }, (_, i) => ({
    userMessageId: `u-${tag}-${start + i}`,
    assistantMessageId: `a-${tag}-${start + i}`,
    publicQuestion: `Q${i + 1} ${tag}?`,
    // Newlines — sealed text; backend must sanitize both sides symmetrically.
    publicAnswer: `A${i + 1} ${tag}\n\nline-two.`,
    sourceOrder: start + i,
  }));
}

function confirmWindow(windowIndex: number, tag: string, selectedCount: 6 | 8) {
  const pairs = pairsForWindow(windowIndex, tag);
  let draft = buildReview8DraftFromWindow({
    ownerUserId: OWNER,
    sourceConversationId: CONV,
    windowIndex,
    pairs,
    draftKey: `draft-${tag}-w${windowIndex}`,
  });
  if (selectedCount < 8) {
    const orders = pairs.slice(0, selectedCount).map((s) => s.sourceOrder);
    draft = {
      ...draft,
      selectedSourceOrders: orders,
      selectedSteps: pairsToSelectedSteps(pairs.slice(0, selectedCount)),
    };
  }
  const confirmed = confirmReview8Draft(draft);
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) throw new Error(confirmed.message);
  saveReview8Draft(confirmed.draft);
  return confirmed.draft;
}

describe('selectedSteps sealed authority (A1 / retry / re-arm)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1–2: Review8 select 6 and 8 → scoped messages use exact count', () => {
    for (const n of [6, 8] as const) {
      localStorage.clear();
      const draft = confirmWindow(0, `n${n}`, n);
      const scoped = resolveScopedJourneyMeaning(draft);
      expect(scoped.ok).toBe(true);
      if (!scoped.ok) return;
      expect(scoped.selectedCount).toBe(n);
      expect(scoped.messages).toHaveLength(n * 2);
      expect(scoped.scope.selectedSteps).toHaveLength(n);
      expect(scoped.scope.selectedSteps[0]?.stepIndex).toBe(1);
      expect(scoped.messages[1]?.role).toBe('assistant');
      expect(scoped.messages[1]?.text).toBe(draft.selectedSteps[0]!.publicAnswer.trim());
    }
  });

  it('3+5: reload before generation restores same selectedSteps / A1 pairing', () => {
    const draft = confirmWindow(0, 'reload', 8);
    const journeyId = draft.journeyId!;
    const reloaded = loadReview8DraftForJourney(OWNER, CONV, journeyId);
    expect(reloaded?.journeyId).toBe(journeyId);
    expect(reloaded?.selectedSteps.map((s) => s.assistantMessageId)).toEqual(
      draft.selectedSteps.map((s) => s.assistantMessageId)
    );
    const scoped = resolveScopedJourneyMeaning(reloaded);
    expect(scoped.ok).toBe(true);
    if (!scoped.ok) return;
    expect(scoped.scope.selectedSteps[0]?.sourceAssistantMessageId).toBe(
      draft.selectedSteps[0]!.assistantMessageId
    );
    expect(scoped.messages[1]?.text).toBe(draft.selectedSteps[0]!.publicAnswer.trim());
  });

  it('4+8: re-arm / load by journeyId does not substitute latest artifact draft', () => {
    const first = confirmWindow(0, 'first', 8);
    const second = confirmWindow(1, 'second', 8);
    // Active pointer is the latest confirm (second).
    expect(loadActiveReview8Draft(OWNER, CONV)?.journeyId).toBe(second.journeyId);
    // Stuck first journey must resolve its own sealed draft.
    const forFirst = loadReview8DraftForJourney(OWNER, CONV, first.journeyId);
    expect(forFirst?.journeyId).toBe(first.journeyId);
    expect(forFirst?.selectedSteps[0]?.assistantMessageId).toBe(
      first.selectedSteps[0]!.assistantMessageId
    );
    expect(forFirst?.selectedSteps[0]?.assistantMessageId).not.toBe(
      second.selectedSteps[0]!.assistantMessageId
    );
  });

  it('6: later Journey window does not collide with first Q1/A1 ordinals', () => {
    const first = confirmWindow(0, 'w0', 8);
    const second = confirmWindow(1, 'w1', 8);
    const s0 = resolveScopedJourneyMeaning(first);
    const s1 = resolveScopedJourneyMeaning(second);
    expect(s0.ok && s1.ok).toBe(true);
    if (!s0.ok || !s1.ok) return;
    expect(s0.scope.selectedSteps[0]?.stepIndex).toBe(1);
    expect(s1.scope.selectedSteps[0]?.stepIndex).toBe(1);
    expect(s0.scope.selectedSteps[0]?.sourceOrder).toBe(0);
    expect(s1.scope.selectedSteps[0]?.sourceOrder).toBe(8);
    expect(s0.scope.selectedSteps[0]?.sourceAssistantMessageId).not.toBe(
      s1.scope.selectedSteps[0]?.sourceAssistantMessageId
    );
  });

  it('7+11: retry pending preserves exact journeyId/version (no duplicate product id)', () => {
    const draft = confirmWindow(0, 'retry', 8);
    markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    markMirrorJourneyArtifactFailed(OWNER, {
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
      message: 'Scoped message A1 does not match selectedSteps',
    });
    const failed = loadMirrorJourneyArtifact(
      OWNER,
      draft.journeyId!,
      draft.journeyVersion ?? 1
    );
    expect(failed?.status).toBe('failed');

    // Simulate Tekrar Dene authority: same ids only.
    setActiveReview8DraftKey(OWNER, CONV, draft.draftKey);
    requestJourneyAynaGeneration({
      conversationId: CONV,
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
    });
    const pending = readPendingJourneyAynaGeneration(CONV);
    expect(pending?.journeyId).toBe(draft.journeyId!.toLowerCase());
    expect(pending?.journeyVersion).toBe(draft.journeyVersion ?? 1);

    markMirrorJourneyArtifactGenerating(OWNER, {
      journeyId: draft.journeyId!,
      journeyVersion: draft.journeyVersion ?? 1,
      sourceConversationId: CONV,
      blockIndex: 0,
      selectedCount: 8,
    });
    const again = loadMirrorJourneyArtifact(
      OWNER,
      draft.journeyId!,
      draft.journeyVersion ?? 1
    );
    expect(again?.journeyId).toBe(draft.journeyId);
    expect(again?.status).toBe('generating');
    // Still a single artifact identity for this journey+version.
    expect(
      listReview8DraftsForConversation(OWNER, CONV).filter(
        (d) => d.journeyId === draft.journeyId
      )
    ).toHaveLength(1);
  });

  it('9: true scoped mismatch still fails closed at resolve (wrong draft)', () => {
    const draft = confirmWindow(0, 'mismatch', 8);
    const tampered = {
      ...draft,
      selectedSteps: draft.selectedSteps.map((s, i) =>
        i === 0 ? { ...s, publicAnswer: 'TAMAMEN FARKLI' } : s
      ),
      snapshotHash: draft.snapshotHash,
    };
    // Snapshot hash check fails closed when steps mutated after confirm.
    const scoped = resolveScopedJourneyMeaning(tampered);
    expect(scoped.ok).toBe(false);
  });

  it('10: missing sealed draft for journeyId → null (no wrong generation substitute)', () => {
    confirmWindow(0, 'only', 8);
    expect(loadReview8DraftForJourney(OWNER, CONV, 'missing-journey-id')).toBeNull();
  });

  it('12: buildScopedPrepareMessagesFromSteps pairs Q/A by sealed step index', () => {
    const draft = confirmWindow(0, 'pair', 6);
    const msgs = buildScopedPrepareMessagesFromSteps(draft.selectedSteps);
    expect(msgs).toHaveLength(12);
    for (let i = 0; i < draft.selectedSteps.length; i += 1) {
      expect(msgs[i * 2]?.role).toBe('user');
      expect(msgs[i * 2]?.text).toBe(draft.selectedSteps[i]!.publicQuestion.trim());
      expect(msgs[i * 2 + 1]?.role).toBe('assistant');
      expect(msgs[i * 2 + 1]?.text).toBe(draft.selectedSteps[i]!.publicAnswer.trim());
    }
  });

  it('source: ObservationExperience retry/re-arm use exact journey draft + kick', () => {
    const obs = readFileSync(
      join(
        process.cwd(),
        'components/standalone/StandaloneObservationExperience.tsx'
      ),
      'utf8'
    );
    expect(obs).toContain('loadReview8DraftForJourney');
    expect(obs).toContain('requestJourneyAynaGeneration');
    expect(obs).toMatch(
      /onRetry:[\s\S]*loadReview8DraftForJourney[\s\S]*requestJourneyAynaGeneration/
    );
    expect(obs).toMatch(
      /stuckGenerating[\s\S]*loadReview8DraftForJourney[\s\S]*requestJourneyAynaGeneration/
    );
    expect(obs).toContain('legacy_incompatible_sealed_selection');
    expect(obs).toContain('journeyAynaKickKeyRef.current = null');
    // Must not call runMirrorWithReveal alone from onRetry (loses journeyId).
    expect(obs).not.toMatch(
      /onRetry:[\s\S]*runMirrorWithReveal\(entries,\s*\{\s*isUpdate:\s*true\s*\}\)/
    );
  });

  it('pending consume clears one-shot kick storage', () => {
    requestJourneyAynaGeneration({
      conversationId: CONV,
      journeyId: 'abc',
      journeyVersion: 1,
    });
    expect(readPendingJourneyAynaGeneration(CONV)?.journeyId).toBe('abc');
    consumePendingJourneyAynaGeneration(CONV);
    expect(readPendingJourneyAynaGeneration(CONV)).toBeNull();
    expect(sessionStorage.getItem(JOURNEY_AYNA_GENERATE_PENDING_KEY)).toBeNull();
  });
});
