'use client';

/**
 * Phase 5.0 — progressive frozen Yansı replay (one question at a time).
 * Authority: PublicFrozenJourneyArtifact only. Zero generation / EZA scoring calls.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import MessageList, { type MessageListMessage } from '@/components/standalone/MessageList';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import YansiDesktopExperience, { type DesktopYansiReplayIdentity } from './YansiDesktopExperience';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import ChatBubble from '@/components/standalone/ChatBubble';
import FrozenAnswerReveal from '@/components/mirror-landing/FrozenAnswerReveal';
import { useYansiExperienceSession } from '@/components/mirror-landing/YansiExperienceSession';
import SainaBrandWordmark from '@/components/saina/SainaBrandWordmark';
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
} from '@/lib/eza/mirror/journey/publicFrozenTypes';
import {
  YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA,
  YANSI_OWN_CONTINUATION_CTA,
} from '@/lib/eza/mirror/copy';
import { trackLandingCtaClicked } from '@/lib/eza/mirror-network/landingAnalytics';
import { trackSeedStart } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import {
  buildYansiPublicHref,
  returnToYansiReelDepth,
} from '@/lib/eza/mirror-network/yansiPublicDepth';
import {
  trackYansiExperienceCompleted,
  trackYansiExperienceStarted,
} from '@/lib/eza/mirror/journey/yansiExperienceAnalytics';
import { cn } from '@/lib/utils';
import { cancelYansiSpeech } from '@/lib/eza/mirror/yansiSpeech';

export type FrozenReplayProgressNotice = {
  slug: string;
  journeyVersion: number;
  completedStepCount: number;
  replayCompleted: boolean;
  selectedCount: number;
};

export type MirrorFrozenReplayProps = {
  artifact: PublicFrozenJourneyArtifact;
  desktopIdentity?: DesktopYansiReplayIdentity;
  desktopMetrics?: ReactNode;
  className?: string;
  /** Phase 5.1 — fired once when final frozen answer completes. */
  onReplayCompleted?: (artifact: PublicFrozenJourneyArtifact) => void;
  /** Phase 5.1.2 — live progress for skip/resume (does not mutate other Yansılar). */
  onReplayProgress?: (notice: FrozenReplayProgressNotice) => void;
  /** Own-path CTA label (default Phase 5.1 copy). */
  continueLabel?: string;
  /**
   * Phase D — secondary end CTA: Chat → SAME Reel.
   * Prefer the parent’s canonical exitChatDepth (same as Back / Escape).
   * When omitted, uses returnToYansiReelDepth with the exact slug/version.
   */
  onExploreAnotherCuriosity?: () => void;
  /**
   * @deprecated Phase 6.0 — STARTED always fires on first frozen-question tap
   * for root and child. Kept so existing callers do not break; ignored.
   */
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
  revealing: boolean;
};

function RevealingAssistantBubble({
  text,
  isFirst,
  onComplete,
  charsPerTick,
  tickMs,
}: {
  text: string;
  isFirst: boolean;
  onComplete: () => void;
  charsPerTick?: number;
  tickMs?: number;
}) {
  return (
    <article className="saina-msg-row saina-msg-row--ai" data-testid="saina-msg-ai">
      <div className="saina-msg-content">
        {isFirst ? (
          <div className="saina-msg-ai-header" data-testid="saina-msg-ai-header">
            <SainaGeometricMark size={18} className="saina-msg-ai-mark" />
            <SainaBrandWordmark className="saina-msg-ai-title" height={11} />
          </div>
        ) : null}
        <div className="saina-msg-ai">
          <p className="saina-msg-prose saina-msg-prose--ai whitespace-pre-wrap">
            <FrozenAnswerReveal
              text={text}
              onComplete={onComplete}
              charsPerTick={charsPerTick}
              tickMs={tickMs}
            />
          </p>
        </div>
      </div>
    </article>
  );
}

export default function MirrorFrozenReplay({
  artifact,
  desktopIdentity,
  className,
  onReplayCompleted,
  onReplayProgress,
  continueLabel = YANSI_OWN_CONTINUATION_CTA,
  onExploreAnotherCuriosity,
  chainEmbedded = false,
}: MirrorFrozenReplayProps) {
  const experience = useYansiExperienceSession();
  const desktopMode = Boolean(desktopIdentity);
  const reducedMotion = useReducedMotion();
  const revealingStepRef = useRef<number | null>(null);
  const startedTrackedRef = useRef(false);
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
      revealing: false,
    }));
  });

  useEffect(() => {
    const last = [...turns].reverse().find((t) => !t.revealing);
    if (last?.answer) experience?.registerRevealedAnswer(last.answer);
  }, [turns, experience]);

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
        completedStepCount: frozen.steps.length,
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
  }, [desktopMode]);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (!force && userScrolledUp.current) return;
      if (desktopMode) {
        const root = scrollRootRef.current;
        if (root) {
          const options = { top: root.scrollHeight, behavior: reducedMotion ? 'auto' as const : experience?.revealPace.scrollBehavior ?? 'smooth' as const };
          if (typeof root.scrollTo === 'function') root.scrollTo(options);
          else root.scrollTop = root.scrollHeight;
        }
        return;
      }
      const el = bottomRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({
          behavior: experience?.revealPace.scrollBehavior ?? 'smooth',
          block: 'end',
        });
      }
    },
    [experience?.revealPace.scrollBehavior, desktopMode, reducedMotion]
  );

  const nextStep = getNextReplayStep(frozen, session);

  const handleAskNext = () => {
    if (!nextStep || session.phase === 'revealing' || revealingStepRef.current !== null) return;
    const step = nextStep;
    revealingStepRef.current = step.stepIndex;
    if (!startedTrackedRef.current) {
      startedTrackedRef.current = true;
      trackYansiExperienceStarted({
        slug: frozen.slug,
        journeyVersion: frozen.journeyVersion,
        completedStepCount: session.completedStepCount,
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
        revealing: true,
      },
    ]);
    requestAnimationFrame(() => scrollToBottom(true));
  };

  const handleRevealComplete = useCallback(
    (stepIndex: number, answerText: string) => {
      if (revealingStepRef.current !== stepIndex) return;
      revealingStepRef.current = null;
      experience?.notifyAnswerRevealed(answerText);
      setTurns((prev) =>
        prev.map((t) => (t.stepIndex === stepIndex ? { ...t, revealing: false } : t))
      );
      setSession((prev) => afterAnswerRevealed(prev, frozen.steps.length));
      requestAnimationFrame(() => scrollToBottom(false));
    },
    [experience, frozen.steps.length, scrollToBottom]
  );

  const continueHref = `/m/${encodeURIComponent(frozen.slug)}/sohbet`;
  const replayFinished = session.phase === 'completed' || session.replayCompleted;

  const handleExploreAnotherCuriosity = useCallback(() => {
    cancelYansiSpeech();
    if (onExploreAnotherCuriosity) {
      onExploreAnotherCuriosity();
      return;
    }
    // Standalone / deep-link safety: same canonical Chat → Reel helper.
    returnToYansiReelDepth({
      reelHref: buildYansiPublicHref(frozen.slug, {
        journeyVersion: frozen.journeyVersion,
        mode: 'reel',
      }),
    });
  }, [onExploreAnotherCuriosity, frozen.slug, frozen.journeyVersion]);

  const continueLink = (
    <Link
      href={continueHref}
      onClick={() => {
        cancelYansiSpeech();
        trackLandingCtaClicked(frozen.slug);
        trackSeedStart(frozen.slug);
      }}
      className={
        replayFinished
          ? 'yansi-chat-end-cta-primary flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/40 bg-[#e8d5b5]/15 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d5b5]/70'
          : 'flex w-full items-center justify-center px-2 py-1.5 text-center text-[11px] font-medium text-[#c9bba8] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d5b5]/50'
      }
      data-testid="mirror-frozen-replay-continue"
    >
      {continueLabel}
    </Link>
  );

  const followRevealGrowth = useCallback(() => {
    if (!desktopMode || userScrolledUp.current) return;
    const root = scrollRootRef.current;
    if (root) root.scrollTop = root.scrollHeight;
  }, [desktopMode]);

  if (desktopIdentity) {
    const messages: MessageListMessage[] = turns.flatMap((turn) => {
      const prefix = `${frozen.slug}:${pinnedVersionRef.current}:${turn.stepIndex}`;
      return [
        { id: `${prefix}:user`, text: turn.question, isUser: true },
        { id: `${prefix}:assistant`, text: turn.answer, isUser: false },
      ];
    });
    const revealing = turns.find((turn) => turn.revealing);
    const replayCompletion = replayFinished ? <div className="saina-message-list yansi-replay-completion">
      <div className="saina-message-thread">
        <div className="saina-msg-row saina-msg-row--ai">
          <div className="saina-msg-content">
            <div className="saina-msg-ai saina-msg-prose" data-testid="mirror-frozen-replay-complete" role="status">
              <p>Bu Yansı burada tamamlandı.</p>
              <button type="button" className="yansi-chat-end-cta-secondary" data-testid="mirror-frozen-replay-explore-another"
                onClick={handleExploreAnotherCuriosity}>{YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA}</button>
            </div>
          </div>
        </div>
      </div>
    </div> : null;
    const replayAction = replayFinished ? null : nextStep ? <button type="button" className="yansi-actionable-question" data-testid="mirror-frozen-replay-next-question"
      data-step-index={nextStep.stepIndex} onClick={handleAskNext}>{nextStep.publicQuestion}</button>
      : <p role="status">Yanıt açılıyor…</p>;
    return <section className="yansi-desktop-replay" data-testid="mirror-frozen-replay" data-journey-version={pinnedVersionRef.current}
      data-yansi-rhythm={experience?.rhythm ?? 'normal'} aria-label="Yansı deneyimi">
        <YansiDesktopExperience slug={frozen.slug} sceneImageUrl={artifact.sceneImageUrl} identity={desktopIdentity} scrollRef={scrollRootRef}
          replaySelection={{ slug: frozen.slug, journeyVersion: pinnedVersionRef.current, completedStepCount: session.completedStepCount }}
        replayAction={replayAction} messages={<><MessageList messages={messages} variant="saina" autoScroll={false}
          isLoading={false} ezaVisibilityEnabled={false}
          renderMessageBody={(message) => revealing && message.id === `${frozen.slug}:${pinnedVersionRef.current}:${revealing.stepIndex}:assistant`
            ? <FrozenAnswerReveal text={revealing.answer} charsPerTick={experience?.revealPace.charsPerTick} tickMs={experience?.revealPace.tickMs}
                onComplete={() => handleRevealComplete(revealing.stepIndex, revealing.answer)} onProgress={followRevealGrowth}
                renderText={(text) => <SainaMessageBody message={text} role="ai" />} /> : undefined} />{replayCompletion}</>} />
    </section>;
  }

  return (
    <section
      className={cn('flex min-h-0 w-full flex-1 flex-col', className)}
      data-testid="mirror-frozen-replay"
      data-journey-version={pinnedVersionRef.current}
      data-yansi-rhythm={experience?.rhythm ?? 'normal'}
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
                ezaVisibilityEnabled={false}
                isFirstAssistantMessage={false}
              />
              {turn.revealing ? (
                <RevealingAssistantBubble
                  text={turn.answer}
                  isFirst={index === 0}
                  charsPerTick={experience?.revealPace.charsPerTick}
                  tickMs={experience?.revealPace.tickMs}
                  onComplete={() => handleRevealComplete(turn.stepIndex, turn.answer)}
                />
              ) : (
                <ChatBubble
                  message={turn.answer}
                  isUser={false}
                  variant="saina"
                  ezaVisibilityEnabled={false}
                  isFirstAssistantMessage={index === 0}
                />
              )}
            </div>
          ))}
          <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
        </div>
      </div>

      <div
        className="yansi-chat-composer-lane shrink-0 space-y-3 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-testid="yansi-chat-composer-lane"
      >
        {replayFinished ? (
          <div
            className="yansi-chat-end-decision flex flex-col gap-3"
            data-testid="mirror-frozen-replay-complete"
            data-yansi-end-decision="true"
          >
            <p className="text-center text-sm text-[#c9bba8]">
              Bu Yansı burada tamamlandı.
            </p>
            {continueLink}
            <button
              type="button"
              onClick={handleExploreAnotherCuriosity}
              className="yansi-chat-end-cta-secondary flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/22 bg-transparent px-6 py-3 text-sm font-medium tracking-wide text-[#c9bba8] transition-colors hover:border-[#e8d5b5]/40 hover:text-[#f5ead8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8d5b5]/50"
              data-testid="mirror-frozen-replay-explore-another"
              aria-label={YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA}
            >
              {YANSI_EXPLORE_ANOTHER_CURIOSITY_CTA}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {nextStep && session.phase !== 'revealing' ? (
              <button
                type="button"
                onClick={handleAskNext}
                className="yansi-actionable-question flex w-full items-center justify-center rounded-2xl border border-[#e8d5b5]/35 bg-[#e8d5b5]/10 px-5 py-3.5 text-left text-sm font-medium leading-snug text-[#f5ead8]"
                data-testid="mirror-frozen-replay-next-question"
                data-step-index={nextStep.stepIndex}
                data-yansi-actionable-question="true"
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
