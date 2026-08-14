'use client';

/**
 * Phase 5.0 — progressive frozen Yansı replay (one question at a time).
 * Authority: PublicFrozenJourneyArtifact only. Zero generation / EZA scoring calls.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ChatBubble from '@/components/standalone/ChatBubble';
import FrozenAnswerReveal from '@/components/mirror-landing/FrozenAnswerReveal';
import SainaGeometricMark from '@/components/saina/SainaGeometricMark';
import {
  afterAnswerRevealed,
  afterQuestionTapped,
  getNextReplayStep,
  loadFrozenReplayProgress,
  saveFrozenReplayProgress,
  startReplaySession,
  type FrozenReplaySession,
} from '@/lib/eza/mirror/journey/frozenReplaySession';
import type {
  PublicFrozenJourneyArtifact,
  PublicFrozenJourneyStep,
  PublicFrozenStepEzaSnapshot,
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  getEzaUserPreferences,
  resolveFrozenEzaSnapshotForDisplay,
  shouldShowEzaInExperience,
  subscribeEzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
import { useAuth } from '@/context/AuthContext';
import { SAINA_BRAND } from '@/lib/eza/sainaCopy';
import { YANSI_OWN_CONTINUATION_CTA } from '@/lib/eza/mirror/copy';
import { trackLandingCtaClicked } from '@/lib/eza/mirror-network/landingAnalytics';
import { trackSeedStart } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import {
  trackYansiExperienceCompleted,
  trackYansiExperienceStarted,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import { cn } from '@/lib/utils';

export type FrozenReplayProgressNotice = {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
  replayCompleted: boolean;
  selectedCount: number;
};

export type MirrorFrozenReplayProps = {
  artifact: PublicFrozenJourneyArtifact;
  className?: string;
  /** Phase 5.1 — fired once when final frozen answer completes. */
  onReplayCompleted?: (artifact: PublicFrozenJourneyArtifact) => void;
  /** Phase 5.1.2 — live progress for skip/resume (does not mutate other Yansılar). */
  onReplayProgress?: (notice: FrozenReplayProgressNotice) => void;
  /** Own-path CTA label (default Phase 5.1 copy). */
  continueLabel?: string;
  /** When true, fire experience_started on first question tap (child Yansılar). */
  trackStartOnFirstQuestion?: boolean;
  /**
   * Phase 5.1.2 — embed in the vertical chain: let the parent scroller move,
   * so the user can leave a partial Yansı without a nested scroll trap.
   */
  chainEmbedded?: boolean;
};

type RevealedTurn = {
  stepIndex: number;
  question: string;
  answer: string;
  eza: PublicFrozenStepEzaSnapshot | null;
  revealing: boolean;
};

function assistantScoreFromEza(eza: PublicFrozenStepEzaSnapshot | null): number | undefined {
  if (!eza) return undefined;
  const n = eza.assistantScore ?? eza.ezaFinal;
  return typeof n === 'number' ? n : undefined;
}

function userScoreFromEza(eza: PublicFrozenStepEzaSnapshot | null): number | undefined {
  if (!eza) return undefined;
  return typeof eza.userScore === 'number' ? eza.userScore : undefined;
}

function RevealingAssistantBubble({
  text,
  isFirst,
  onComplete,
}: {
  text: string;
  isFirst: boolean;
  onComplete: () => void;
}) {
  return (
    <article className="saina-msg-row saina-msg-row--ai" data-testid="saina-msg-ai">
      <div className="saina-msg-content">
        {isFirst ? (
          <div className="saina-msg-ai-header" data-testid="saina-msg-ai-header">
            <SainaGeometricMark size={18} variant="gold" className="saina-msg-ai-mark" />
            <span className="saina-msg-ai-title">{SAINA_BRAND}</span>
          </div>
        ) : null}
        <div className="saina-msg-ai">
          <p className="saina-msg-prose saina-msg-prose--ai whitespace-pre-wrap">
            <FrozenAnswerReveal text={text} onComplete={onComplete} />
          </p>
        </div>
      </div>
    </article>
  );
}

export default function MirrorFrozenReplay({
  artifact,
  className,
  onReplayCompleted,
  onReplayProgress,
  continueLabel = YANSI_OWN_CONTINUATION_CTA,
  trackStartOnFirstQuestion = false,
  chainEmbedded = false,
}: MirrorFrozenReplayProps) {
  const { user } = useAuth();
  const ownerUserId = user?.user_id?.trim() || null;
  const [prefsTick, setPrefsTick] = useState(0);
  useEffect(() => subscribeEzaUserPreferences(() => setPrefsTick((n) => n + 1)), []);
  const ezaPrefs = useMemo(
    () => getEzaUserPreferences(ownerUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownerUserId, prefsTick]
  );
  const ezaVisibilityEnabled = shouldShowEzaInExperience(ezaPrefs);
  const startedTrackedRef = useRef(!trackStartOnFirstQuestion);
  const completedTrackedRef = useRef(false);
  const onCompletedRef = useRef(onReplayCompleted);
  onCompletedRef.current = onReplayCompleted;
  const onProgressRef = useRef(onReplayProgress);
  onProgressRef.current = onReplayProgress;

  const pinnedVersionRef = useRef(artifact.journeyVersion);
  const pinnedArtifactRef = useRef(artifact);
  // Session stays on the version that started replay (ignore later prop changes).
  const frozen =
    artifact.journeyVersion === pinnedVersionRef.current
      ? artifact
      : pinnedArtifactRef.current;
  if (artifact.journeyVersion === pinnedVersionRef.current) {
    pinnedArtifactRef.current = artifact;
  }

  const [session, setSession] = useState<FrozenReplaySession>(() =>
    startReplaySession(
      frozen,
      loadFrozenReplayProgress(frozen.slug, frozen.journeyVersion)
    )
  );
  const [turns, setTurns] = useState<RevealedTurn[]>(() => {
    const progress = loadFrozenReplayProgress(frozen.slug, frozen.journeyVersion);
    const count = progress?.completedStepCount ?? 0;
    return frozen.steps.slice(0, count).map((step) => ({
      stepIndex: step.stepIndex,
      question: step.publicQuestion,
      answer: step.publicAnswer,
      eza: resolveFrozenEzaSnapshotForDisplay(step.ezaSnapshot ?? null, ezaPrefs),
      revealing: false,
    }));
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveFrozenReplayProgress(session);
    onProgressRef.current?.({
      slug: session.slug,
      journeyVersion: session.journeyVersion,
      completedStepCount: session.completedStepCount,
      replayCompleted: session.replayCompleted,
      selectedCount: frozen.steps.length,
    });
  }, [session, frozen.steps.length]);

  useEffect(() => {
    if (session.replayCompleted && !completedTrackedRef.current) {
      completedTrackedRef.current = true;
      trackYansiExperienceCompleted({
        slug: frozen.slug,
        journeyVersion: frozen.journeyVersion,
      });
      onCompletedRef.current?.(frozen);
    }
  }, [session.replayCompleted, frozen]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const onScroll = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      userScrolledUp.current = remaining > 120;
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && userScrolledUp.current) return;
    const el = bottomRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  const nextStep = getNextReplayStep(frozen, session);

  const resolveEza = useCallback(
    (step: PublicFrozenJourneyStep) =>
      resolveFrozenEzaSnapshotForDisplay(step.ezaSnapshot ?? null, ezaPrefs),
    [ezaPrefs]
  );

  const handleAskNext = () => {
    if (!nextStep || session.phase === 'revealing') return;
    const step = nextStep;
    if (!startedTrackedRef.current) {
      startedTrackedRef.current = true;
      trackYansiExperienceStarted({
        slug: frozen.slug,
        journeyVersion: frozen.journeyVersion,
      });
    }
    userScrolledUp.current = false;
    setSession(afterQuestionTapped(session));
    setTurns((prev) => [
      ...prev,
      {
        stepIndex: step.stepIndex,
        question: step.publicQuestion,
        answer: step.publicAnswer,
        eza: resolveEza(step),
        revealing: true,
      },
    ]);
    requestAnimationFrame(() => scrollToBottom(true));
  };

  const handleRevealComplete = useCallback(
    (stepIndex: number) => {
      setTurns((prev) =>
        prev.map((t) => (t.stepIndex === stepIndex ? { ...t, revealing: false } : t))
      );
      setSession((prev) => afterAnswerRevealed(prev, frozen.steps.length));
      requestAnimationFrame(() => scrollToBottom(false));
    },
    [frozen.steps.length, scrollToBottom]
  );

  const continueHref = `/m/${encodeURIComponent(frozen.slug)}/sohbet`;
  const replayFinished = session.phase === 'completed' || session.replayCompleted;

  const continueLink = (
    <Link
      href={continueHref}
      onClick={() => {
        trackLandingCtaClicked(frozen.slug);
        trackSeedStart(frozen.slug);
      }}
      className={
        replayFinished
          ? 'flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/40 bg-[#e8d5b5]/15 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/25'
          : 'flex w-full items-center justify-center px-2 py-1.5 text-center text-[11px] font-medium text-[#c9bba8] underline-offset-4 hover:underline'
      }
      data-testid="mirror-frozen-replay-continue"
    >
      {continueLabel}
    </Link>
  );

  return (
    <section
      className={cn('flex min-h-0 w-full flex-1 flex-col', className)}
      data-testid="mirror-frozen-replay"
      data-journey-version={pinnedVersionRef.current}
      aria-label="Yansı deneyimi"
    >
      <div
        ref={scrollRootRef}
        className={cn(
          'saina-message-list px-1',
          chainEmbedded ? 'overflow-visible' : 'min-h-0 flex-1 overflow-y-auto'
        )}
        data-testid="mirror-frozen-replay-thread"
      >
        <div className="saina-message-thread">
          {turns.map((turn, index) => (
            <div key={`step-${turn.stepIndex}`} className="flex flex-col gap-3">
              <ChatBubble
                message={turn.question}
                isUser
                variant="saina"
                ezaVisibilityEnabled={ezaVisibilityEnabled}
                userScore={userScoreFromEza(turn.eza)}
                isFirstAssistantMessage={false}
              />
              {turn.revealing ? (
                <RevealingAssistantBubble
                  text={turn.answer}
                  isFirst={index === 0}
                  onComplete={() => handleRevealComplete(turn.stepIndex)}
                />
              ) : (
                <ChatBubble
                  message={turn.answer}
                  isUser={false}
                  variant="saina"
                  ezaVisibilityEnabled={ezaVisibilityEnabled}
                  assistantScore={assistantScoreFromEza(turn.eza)}
                  isFirstAssistantMessage={index === 0}
                />
              )}
            </div>
          ))}
          <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
        </div>
      </div>

      <div className="shrink-0 space-y-3 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {replayFinished ? (
          <div
            className="flex flex-col gap-3"
            data-testid="mirror-frozen-replay-complete"
          >
            <p className="text-center text-sm text-[#c9bba8]">
              Bu Yansı burada tamamlandı.
            </p>
            {continueLink}
            <p className="text-center text-[11px] text-[#a89880]">
              Aşağı kaydırarak diğer yolları keşfedebilirsin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {nextStep && session.phase !== 'revealing' ? (
              <button
                type="button"
                onClick={handleAskNext}
                className="flex w-full items-center justify-center rounded-2xl border border-[#e8d5b5]/35 bg-[#e8d5b5]/10 px-5 py-3.5 text-left text-sm font-medium leading-snug text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/18"
                data-testid="mirror-frozen-replay-next-question"
                data-step-index={nextStep.stepIndex}
              >
                {nextStep.publicQuestion}
              </button>
            ) : session.phase === 'revealing' ? (
              <p className="text-center text-xs text-[#a89880]" aria-live="polite">
                Yanıt açılıyor…
              </p>
            ) : null}
            {continueLink}
          </div>
        )}
      </div>
    </section>
  );
}
