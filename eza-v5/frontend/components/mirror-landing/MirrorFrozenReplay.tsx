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
import { trackLandingCtaClicked } from '@/lib/eza/mirror-network/landingAnalytics';
import { trackSeedStart } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import { cn } from '@/lib/utils';

export type MirrorFrozenReplayProps = {
  artifact: PublicFrozenJourneyArtifact;
  className?: string;
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

export default function MirrorFrozenReplay({ artifact, className }: MirrorFrozenReplayProps) {
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
  }, [session]);

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

  return (
    <section
      className={cn('flex min-h-0 w-full flex-1 flex-col', className)}
      data-testid="mirror-frozen-replay"
      data-journey-version={pinnedVersionRef.current}
      aria-label="Yansı deneyimi"
    >
      <div
        ref={scrollRootRef}
        className="saina-message-list min-h-0 flex-1 overflow-y-auto px-1"
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
        {session.phase === 'completed' || session.replayCompleted ? (
          <div
            className="flex flex-col gap-3"
            data-testid="mirror-frozen-replay-complete"
          >
            <p className="text-center text-sm text-[#c9bba8]">
              Bu merakın yolculuğu burada tamamlandı.
            </p>
            <Link
              href={continueHref}
              onClick={() => {
                trackLandingCtaClicked(frozen.slug);
                trackSeedStart(frozen.slug);
              }}
              className="flex w-full items-center justify-center rounded-full border border-[#e8d5b5]/40 bg-[#e8d5b5]/15 px-6 py-3.5 text-sm font-semibold tracking-wide text-[#f5ead8] transition-colors hover:bg-[#e8d5b5]/25"
              data-testid="mirror-frozen-replay-continue"
            >
              Bu merakı devam ettir
            </Link>
            <Link
              href={`/m/${encodeURIComponent(frozen.slug)}`}
              className="text-center text-xs text-[#a89880] underline-offset-2 hover:underline"
              data-testid="mirror-frozen-replay-back"
              onClick={(e) => {
                // Soft reset to landing identity without inventing a new route.
                e.preventDefault();
                window.location.assign(`/m/${encodeURIComponent(frozen.slug)}`);
              }}
            >
              Yansı&apos;ya dön
            </Link>
          </div>
        ) : nextStep && session.phase !== 'revealing' ? (
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
      </div>
    </section>
  );
}
