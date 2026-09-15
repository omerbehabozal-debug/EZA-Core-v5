/**
 * Yansı UX separation: 1–5 passive · 6–7 Ayna early CTA · 8 bottom decision.
 * Bottom JourneyWindowDecisionBanner is NOT authorized by earlyYansiReviewWindowIndex.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  buildReview8DraftFromWindow,
  canShowAynaEarlyYansiCreateCta,
  clearAllJourneyConversationStates,
  clearAllReview8Drafts,
  confirmReview8Draft,
  dismissJourneyWindowInvitation,
  ensureJourneyWindowRecord,
  getAwaitingDecisionWindow,
  getEarlyYansiReviewWindowIndex,
  markJourneyWindowReviewing,
  markJourneyWindowReady,
  showCollapsedAynaOpportunityIndicator,
  syncJourneyConversationState,
  type EligibleQaPair,
  type JourneyMessageLike,
} from '@/lib/eza/mirror/journey';
import {
  MIRROR_JOURNEY_DECISION_BODY,
  MIRROR_JOURNEY_DECISION_CREATE,
  MIRROR_JOURNEY_DECISION_SKIP,
  MIRROR_AYNA_EMPTY_TITLE,
} from '@/lib/eza/mirror/copy';
import JourneyWindowDecisionBanner from '@/components/mirror/JourneyWindowDecisionBanner';
import AynaEarlyYansiCreateCta from '@/components/mirror/ayna/AynaEarlyYansiCreateCta';
import SainaYansiContextRail from '@/components/saina/SainaYansiContextRail';

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

function pairMessages(n: number, start = 1): JourneyMessageLike[] {
  const out: JourneyMessageLike[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = start + i;
    out.push(msg(`u${idx}`, `Soru ${idx}?`, { role: 'user' }));
    out.push(msg(`a${idx}`, `Cevap ${idx} tamam.`, { role: 'assistant' }));
  }
  return out;
}

function eligiblePairs(n: number): EligibleQaPair[] {
  return Array.from({ length: n }, (_, i) => ({
    sourceOrder: i,
    userMessageId: `u${i}`,
    assistantMessageId: `a${i}`,
    publicQuestion: `Soru ${i + 1}?`,
    publicAnswer: `Cevap ${i + 1}.`,
  }));
}

function sync(n: number, start = 1, state = null as ReturnType<
  typeof syncJourneyConversationState
> | null) {
  return syncJourneyConversationState({
    state,
    ownerUserId: 'user-1',
    sourceConversationId: 'chat-1',
    messages: pairMessages(n, start),
  });
}

const chatSrc = () =>
  readFileSync(join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'), 'utf8');
const obsSrc = () =>
  readFileSync(
    join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
    'utf8'
  );
const copySrc = () =>
  readFileSync(join(process.cwd(), 'lib/eza/mirror/copy.ts'), 'utf8');

describe('Yansı 6/7/8 UX separation', () => {
  beforeEach(() => {
    clearAllJourneyConversationStates();
    clearAllReview8Drafts();
  });
  afterEach(() => {
    cleanup();
    clearAllJourneyConversationStates();
    clearAllReview8Drafts();
  });

  it('A: 5 pairs — no awaiting decision, no early index, no Ayna CTA', () => {
    const state = sync(5);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('B: 6 pairs — no bottom decision authority; Ayna early CTA available', () => {
    const state = sync(6);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(getEarlyYansiReviewWindowIndex(state)).toBe(0);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(true);
  });

  it('C: 6 Ayna create path marks reviewing (Review), not generation', () => {
    let state = sync(6);
    const idx = getEarlyYansiReviewWindowIndex(state)!;
    state = ensureJourneyWindowRecord(state, idx);
    state = markJourneyWindowReviewing(state, idx);
    expect(state.windows.find((w) => w.windowIndex === idx)?.status).toBe('reviewing');
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('D: 7 pairs — no awaiting; Ayna early CTA available', () => {
    const state = sync(7);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(getEarlyYansiReviewWindowIndex(state)).toBe(0);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(true);
  });

  it('E: 7 Ayna create → reviewing', () => {
    let state = sync(7);
    const idx = getEarlyYansiReviewWindowIndex(state)!;
    state = markJourneyWindowReviewing(ensureJourneyWindowRecord(state, idx), idx);
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
  });

  it('F: 8 pairs — bottom decision; Ayna early CTA absent', () => {
    const state = sync(8);
    expect(getAwaitingDecisionWindow(state)?.status).toBe('awaiting_decision');
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('G/H: 8 create uses reviewing; 8 skip dismisses opportunity', () => {
    let state = sync(8);
    const win = getAwaitingDecisionWindow(state)!;
    const reviewing = markJourneyWindowReviewing(state, win.windowIndex);
    expect(reviewing.windows[0]?.status).toBe('reviewing');

    state = dismissJourneyWindowInvitation(state, win.windowIndex);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(state.windows[0]?.status).toBe('skipped');
    expect(state.journeyMode).not.toBe('private_chat_mode');
  });

  it('I: after skip, later window can still offer early Yansı', () => {
    let state = sync(8);
    state = dismissJourneyWindowInvitation(state, 0);
    // Continue to window 1 with 6 pairs (total 14)
    state = syncJourneyConversationState({
      state,
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-1',
      messages: pairMessages(14),
    });
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(getEarlyYansiReviewWindowIndex(state)).toBe(1);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(true);
  });

  it('J/K/L: Review pools 6/7/8; selection min 6 max 8; excluded absent from confirm', () => {
    for (const n of [6, 7, 8]) {
      const pairs = eligiblePairs(n);
      const draft = buildReview8DraftFromWindow({
        ownerUserId: 'user-1',
        sourceConversationId: 'chat-1',
        windowIndex: 0,
        pairs,
        draftKey: `pool-${n}`,
      });
      expect(draft.sourceBlockSteps).toHaveLength(n);
      expect(draft.selectedSteps).toHaveLength(n);
      expect(confirmReview8Draft(draft).ok).toBe(true);
    }
    const pairs8 = eligiblePairs(8);
    let draft = buildReview8DraftFromWindow({
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-1',
      windowIndex: 0,
      pairs: pairs8,
    });
    draft = {
      ...draft,
      selectedSourceOrders: [0, 1, 2, 3, 4],
      selectedSteps: pairs8.slice(0, 5),
    };
    expect(confirmReview8Draft(draft).ok).toBe(false);
    draft = {
      ...draft,
      selectedSourceOrders: [0, 1, 3, 4, 5, 6],
      selectedSteps: [pairs8[0], pairs8[1], pairs8[3], pairs8[4], pairs8[5], pairs8[6]],
    };
    const confirmed = confirmReview8Draft(draft);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.draft.selectedSteps.map((s) => s.sourceOrder)).toEqual([
      0, 1, 3, 4, 5, 6,
    ]);
  });

  it('M/N: generating and ready suppress same-window early CTA', () => {
    let state = sync(6);
    state = ensureJourneyWindowRecord(state, 0);
    state = {
      ...state,
      windows: state.windows.map((w) =>
        w.windowIndex === 0
          ? { ...w, status: 'generating' as const, journeyId: 'j-gen' }
          : w
      ),
    };
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();

    state = markJourneyWindowReady(state, 0);
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('O: later window — 14 early, 15 early, 16 bottom decision', () => {
    let state = sync(8);
    state = dismissJourneyWindowInvitation(state, 0);
    for (const n of [14, 15]) {
      state = syncJourneyConversationState({
        state,
        ownerUserId: 'user-1',
        sourceConversationId: 'chat-1',
        messages: pairMessages(n),
      });
      expect(getAwaitingDecisionWindow(state)).toBeNull();
      expect(getEarlyYansiReviewWindowIndex(state)).toBe(1);
      expect(
        canShowAynaEarlyYansiCreateCta({
          isAuthenticated: true,
          conversationId: 'chat-1',
          invitationEnabled: true,
          journeyState: state,
        })
      ).toBe(true);
    }
    state = syncJourneyConversationState({
      state,
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-1',
      messages: pairMessages(16),
    });
    expect(getAwaitingDecisionWindow(state)?.windowIndex).toBe(1);
    expect(getEarlyYansiReviewWindowIndex(state)).toBeNull();
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('P: guest / invitation-off / unauthenticated — no Ayna early CTA', () => {
    const state = sync(6);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: false,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: false,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('Q: mounted Ayna CTA invokes request callback (no direct generate)', () => {
    const onCreate = vi.fn();
    render(
      <div data-testid="ayna-empty-state">
        <p>{MIRROR_AYNA_EMPTY_TITLE}</p>
        <AynaEarlyYansiCreateCta onCreate={onCreate} />
      </div>
    );
    fireEvent.click(screen.getByTestId('ayna-early-yansi-create-button'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(MIRROR_JOURNEY_DECISION_CREATE)).toBeTruthy();
  });

  it('mounted 8-pair banner shows body + create + new skip copy', () => {
    const onCreate = vi.fn();
    const onSkip = vi.fn();
    render(
      <JourneyWindowDecisionBanner onCreate={onCreate} onSkip={onSkip} showSkip />
    );
    expect(screen.getByText(MIRROR_JOURNEY_DECISION_BODY)).toBeTruthy();
    expect(screen.getByText(MIRROR_JOURNEY_DECISION_CREATE)).toBeTruthy();
    expect(screen.getByText(MIRROR_JOURNEY_DECISION_SKIP)).toBe(
      screen.getByTestId('journey-window-skip')
    );
    expect(MIRROR_JOURNEY_DECISION_SKIP).toBe('Yansı oluşturmadan devam et');
    fireEvent.click(screen.getByTestId('journey-window-create'));
    fireEvent.click(screen.getByTestId('journey-window-skip'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('source: ChatInner does not bind early index to bottom banner', () => {
    const chat = chatSrc();
    expect(chat).toContain('awaitingJourneyWindow && !journeyReviewOpen');
    expect(chat).not.toContain('showSkip={false}');
    expect(chat).toContain('EARLY_YANSI_REVIEW_REQUEST_EVENT');
    expect(chat).toContain('handleEarlyYansiCreate');
    // Only one JourneyWindowDecisionBanner usage — gated by awaitingJourneyWindow.
    expect(chat.match(/<JourneyWindowDecisionBanner/g)?.length).toBe(1);
    const bannerIdx = chat.indexOf('<JourneyWindowDecisionBanner');
    const bannerSlice = chat.slice(bannerIdx, bannerIdx + 280);
    expect(bannerSlice).toContain('onCreate={handleJourneyCreate}');
    expect(bannerSlice).not.toContain('handleEarlyYansiCreate');
    expect(bannerSlice).not.toContain('earlyYansiReviewWindowIndex');
  });

  it('source: Observation wires Ayna early CTA; skip copy constant updated', () => {
    const obs = obsSrc();
    expect(obs).toContain('canShowAynaEarlyYansiCreateCta');
    expect(obs).toContain('requestEarlyYansiReview');
    expect(obs).toContain('AynaEarlyYansiCreateCta');
    expect(copySrc()).toContain("MIRROR_JOURNEY_DECISION_SKIP = 'Yansı oluşturmadan devam et'");
    expect(copySrc()).not.toContain("MIRROR_JOURNEY_DECISION_SKIP = 'Sohbete devam et'");
  });
});

describe('Silent collapsed Ayna opportunity indicator (6–7)', () => {
  beforeEach(() => {
    clearAllJourneyConversationStates();
    clearAllReview8Drafts();
  });
  afterEach(() => {
    cleanup();
    clearAllJourneyConversationStates();
    clearAllReview8Drafts();
  });

  function opportunityFor(n: number) {
    const state = sync(n);
    const early = canShowAynaEarlyYansiCreateCta({
      isAuthenticated: true,
      conversationId: 'chat-1',
      invitationEnabled: true,
      journeyState: state,
    });
    return { state, early };
  }

  it('A: pair 5 — no collapsed indicator', () => {
    const { early } = opportunityFor(5);
    expect(early).toBe(false);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: early,
      })
    ).toBe(false);
  });

  it('B: pair 6 — no auto-open; collapsed indicator when closed; no bottom decision', () => {
    const { state, early } = opportunityFor(6);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(early).toBe(true);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: early,
      })
    ).toBe(true);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: false,
        earlyCreateAvailable: early,
      })
    ).toBe(false);
    const chat = chatSrc();
    expect(chat).toContain('earlyYansiOpportunityAvailable');
    expect(chat).not.toMatch(
      /canShowAynaEarlyYansiCreateCta[\s\S]{0,200}setMirrorCollapsed\(false\)/
    );
    expect(chat).not.toMatch(
      /earlyYansiOpportunityAvailable[\s\S]{0,120}openMirror\(/
    );
  });

  it('C: pair 7 — same silent availability', () => {
    const { state, early } = opportunityFor(7);
    expect(getAwaitingDecisionWindow(state)).toBeNull();
    expect(early).toBe(true);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: early,
      })
    ).toBe(true);
  });

  it('D/E: rail shows dot when closed+available; hides when open; returns when closed again', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <SainaYansiContextRail
        mirrorOpen={false}
        onOpenAyna={onOpen}
        onCloseAyna={onClose}
        earlyYansiOpportunityAvailable
      />
    );
    expect(screen.getByTestId('ayna-early-opportunity-dot')).toBeTruthy();
    expect(screen.getByTestId('saina-mirror-expand-pill')).toBeTruthy();
    // Opening Ayna is user click only — no Review auto-open from indicator.
    fireEvent.click(screen.getByTestId('saina-mirror-expand-pill'));
    expect(onOpen).toHaveBeenCalledTimes(1);

    rerender(
      <SainaYansiContextRail
        mirrorOpen
        onOpenAyna={onOpen}
        onCloseAyna={onClose}
        earlyYansiOpportunityAvailable
      />
    );
    expect(screen.queryByTestId('ayna-early-opportunity-dot')).toBeNull();
    expect(screen.queryByTestId('ayna-early-yansi-create')).toBeNull();

    rerender(
      <SainaYansiContextRail
        mirrorOpen={false}
        onOpenAyna={onOpen}
        onCloseAyna={onClose}
        earlyYansiOpportunityAvailable
      />
    );
    expect(screen.getByTestId('ayna-early-opportunity-dot')).toBeTruthy();
  });

  it('F: Ayna CTA still opens Review path via callback (no generation)', () => {
    const onCreate = vi.fn();
    render(<AynaEarlyYansiCreateCta onCreate={onCreate} />);
    fireEvent.click(screen.getByTestId('ayna-early-yansi-create-button'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('G: pair 8 — indicator and early CTA authority off; bottom decision on', () => {
    const { state, early } = opportunityFor(8);
    expect(early).toBe(false);
    expect(getAwaitingDecisionWindow(state)?.status).toBe('awaiting_decision');
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: early,
      })
    ).toBe(false);
  });

  it('H/I: generating and READY suppress indicator', () => {
    let state = sync(6);
    state = ensureJourneyWindowRecord(state, 0);
    state = {
      ...state,
      windows: state.windows.map((w) =>
        w.windowIndex === 0
          ? { ...w, status: 'generating' as const, journeyId: 'j-gen' }
          : w
      ),
    };
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
    state = markJourneyWindowReady(state, 0);
    expect(
      canShowAynaEarlyYansiCreateCta({
        isAuthenticated: true,
        conversationId: 'chat-1',
        invitationEnabled: true,
        journeyState: state,
      })
    ).toBe(false);
  });

  it('J: later window 6/7 can show indicator again after window 0 resolved', () => {
    let state = sync(8);
    state = dismissJourneyWindowInvitation(state, 0);
    state = syncJourneyConversationState({
      state,
      ownerUserId: 'user-1',
      sourceConversationId: 'chat-1',
      messages: pairMessages(14),
    });
    const early = canShowAynaEarlyYansiCreateCta({
      isAuthenticated: true,
      conversationId: 'chat-1',
      invitationEnabled: true,
      journeyState: state,
    });
    expect(early).toBe(true);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: early,
      })
    ).toBe(true);
  });

  it('K: eligibility transition does not auto-open Ayna (source + shell)', () => {
    const chat = chatSrc();
    const shell = readFileSync(
      join(process.cwd(), 'components/saina/SainaStandaloneShell.tsx'),
      'utf8'
    );
    expect(chat).toContain('earlyYansiOpportunityAvailable={earlyYansiOpportunityAvailable}');
    expect(shell).toContain('earlyYansiOpportunityAvailable');
    // Shell only opens Ayna via tryOpenMirror / activeYansiIdentity — not early eligibility.
    expect(shell).not.toMatch(
      /earlyYansiOpportunityAvailable[\s\S]{0,200}setMirrorCollapsed\(false\)/
    );
    expect(shell).not.toMatch(
      /canShowAynaEarlyYansiCreateCta[\s\S]{0,200}setMirrorCollapsed\(false\)/
    );
  });

  it('L: guest / invitation-off never get indicator from this rule', () => {
    const state = sync(6);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: canShowAynaEarlyYansiCreateCta({
          isAuthenticated: false,
          conversationId: 'chat-1',
          invitationEnabled: true,
          journeyState: state,
        }),
      })
    ).toBe(false);
    expect(
      showCollapsedAynaOpportunityIndicator({
        aynaClosed: true,
        earlyCreateAvailable: canShowAynaEarlyYansiCreateCta({
          isAuthenticated: true,
          conversationId: 'chat-1',
          invitationEnabled: false,
          journeyState: state,
        }),
      })
    ).toBe(false);
  });

  it('source: rail owns collapsed opportunity dot markup', () => {
    const rail = readFileSync(
      join(process.cwd(), 'components/saina/SainaYansiContextRail.tsx'),
      'utf8'
    );
    expect(rail).toContain('ayna-early-opportunity-dot');
    expect(rail).toContain('showCollapsedAynaOpportunityIndicator');
    expect(rail).toContain('bilign-ayna-opportunity-dot');
  });
});
