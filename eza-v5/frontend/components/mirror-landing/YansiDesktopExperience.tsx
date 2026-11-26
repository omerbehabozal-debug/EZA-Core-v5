'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useYansiExperienceSession } from './YansiExperienceSession';
import { DEFAULT_YANSI_READING } from '@/lib/eza/mirror/yansiReadingPreferences';
import { useRouter } from 'next/navigation';
import SainaDesktopChatLayout from '@/components/saina/SainaDesktopChatLayout';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import SainaComposer from '@/components/saina/SainaComposer';
import MessageList, { type MessageListMessage } from '@/components/standalone/MessageList';
import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import { resolvePublicHonorificId } from '@/lib/eza/mirror/publicHonorific';
import { createMirrorSohbetSession, personalChatStartError } from '@/lib/eza/mirror-network/createSohbetSession';
import { startMirrorGuestChat, MIRROR_GUEST_CHAT_REPLY_PARAM } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { trackSeedStart, trackGuestConversationStarted } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import { cancelYansiSpeech } from '@/lib/eza/mirror/yansiSpeech';
import type { PublicReplaySelection } from '@/lib/eza/mirror-network/publicReplayContinuation';
import {
  answerYansiV2Public,
  type YansiV2AnswerHistoryTurn,
} from '@/lib/eza/mirror/journey/answerYansiV2Public';

export type DesktopYansiReplayIdentity = {
  businessLabel?: string;
  title: string;
  displayName: string;
  authorUserId: string;
  avatarUrl: string | null;
  avatarRevision?: number | null;
  honorific: string | null;
  timeLabel: string | null;
};

/** Stage 04D — in-place V2 continuation (not V1 /sohbet guest trial). */
export type YansiV2DesktopContinuation = {
  publicationVersion: number;
  /** Revealed frozen turns only — never rewritten by live Q/A. */
  seedHistory: YansiV2AnswerHistoryTurn[];
};

type LivePair = { id: string; question: string; answer: string };

/** Presentation and personal-chat handoff only. Frozen replay remains parent-owned. */
export default function YansiDesktopExperience({ slug, identity, messages, replayAction, scrollRef, replaySelection, sceneImageUrl, preserveBrandFrame = false, mobile = false, allowPersonalContinue = true, v2Continuation = null }: {
  slug: string;
  mobile?: boolean;
  preserveBrandFrame?: boolean;
  /**
   * When true, show the composer.
   * V1 → /sohbet guest handoff; V2 → in-place public /answer when `v2Continuation` is set.
   */
  allowPersonalContinue?: boolean;
  /** Stage 04D: pin publication version + seed frozen history for V2 /answer. */
  v2Continuation?: YansiV2DesktopContinuation | null;
  identity: DesktopYansiReplayIdentity;
  messages: ReactNode;
  replayAction: ReactNode;
  scrollRef: RefObject<HTMLDivElement>;
  sceneImageUrl?: string | null;
  replaySelection: PublicReplaySelection;
}) {
  const router = useRouter();
  const reading = useYansiExperienceSession()?.reading ?? DEFAULT_YANSI_READING;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePairs, setLivePairs] = useState<LivePair[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const livePairsRef = useRef<LivePair[]>([]);
  livePairsRef.current = livePairs;
  const isV2 = v2Continuation != null;
  const sourceKey = isV2
    ? `v2:${slug}:pv${v2Continuation.publicationVersion}`
    : `${slug}:${replaySelection.journeyVersion}`;
  const sourceRef = useRef(sourceKey);
  sourceRef.current = sourceKey;
  const requestGenerationRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    startingRef.current = false;
    setStarting(false);
    setError(null);
    setLivePairs([]);
    setPendingQuestion(null);
    return () => { mountedRef.current = false; requestGenerationRef.current++; };
  }, [sourceKey]);

  const continuePersonally = async (message: string) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    const generation = requestGenerationRef.current;
    const isCurrent = () => mountedRef.current && sourceRef.current === sourceKey && requestGenerationRef.current === generation;
    let handedOff = false;
    try {
      const result = await createMirrorSohbetSession(slug, { replaySelection });
      if (!isCurrent()) return;
      if (!result.ok) {
        setError(personalChatStartError(result));
        return;
      }
      const created = startMirrorGuestChat({ session: result.session, firstUserMessage: message });
      if (!created) { setError('Kişisel sohbet başlatılamadı. Sorun korundu; yeniden deneyebilirsin.'); return; }
      cancelYansiSpeech();
      trackSeedStart(slug);
      trackGuestConversationStarted(result.session.mirrorSlug, result.session.guestToken);
      router.push(`/standalone?chat=${encodeURIComponent(created.chatId)}&${MIRROR_GUEST_CHAT_REPLY_PARAM}=1`);
      handedOff = true;
    } catch {
      if (isCurrent()) setError('Kişisel sohbet başlatılamadı. Sorun korundu; yeniden deneyebilirsin.');
    } finally {
      if (isCurrent() && !handedOff) { startingRef.current = false; setStarting(false); }
    }
  };

  const continueV2 = useCallback(async (message: string) => {
    if (!v2Continuation || startingRef.current) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setPendingQuestion(trimmed);
    const generation = requestGenerationRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      sourceRef.current === sourceKey &&
      requestGenerationRef.current === generation;
    try {
      const history: YansiV2AnswerHistoryTurn[] = [
        ...v2Continuation.seedHistory,
        ...livePairsRef.current.flatMap((pair) => [
          { role: 'user' as const, content: pair.question },
          { role: 'assistant' as const, content: pair.answer },
        ]),
      ];
      const result = await answerYansiV2Public({
        slug,
        publicationVersion: v2Continuation.publicationVersion,
        question: trimmed,
        history,
      });
      if (!isCurrent()) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Soft gates (quota/budget/flag_off) show copy but must not enter history.
      if (!result.appendToLiveHistory) {
        setError(result.assistantAnswer);
        setPendingQuestion(null);
        return;
      }
      cancelYansiSpeech();
      trackSeedStart(slug);
      const id = `v2-live:${slug}:pv${result.publicationVersion}:${livePairsRef.current.length + 1}`;
      setLivePairs((prev) => [
        ...prev,
        { id, question: trimmed, answer: result.assistantAnswer },
      ]);
      setPendingQuestion(null);
    } catch {
      if (isCurrent()) {
        setError('Yanıt alınamadı. Yeniden deneyebilirsin.');
      }
    } finally {
      if (isCurrent()) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  }, [slug, sourceKey, v2Continuation]);

  const handleSend = (message: string) => {
    if (isV2) {
      void continueV2(message);
      return;
    }
    void continuePersonally(message);
  };

  const handleRetry = () => {
    const q = pendingQuestion;
    if (!q || startingRef.current) return;
    void continueV2(q);
  };

  // Live thread is separate from frozen MessageList — never mutates published turns.
  const liveMessages: MessageListMessage[] = [
    ...livePairs.flatMap((pair) => [
      { id: `${pair.id}:user`, text: pair.question, isUser: true as const },
      { id: `${pair.id}:assistant`, text: pair.answer, isUser: false as const },
    ]),
    // Keep the in-flight / failed question visible until it lands in livePairs.
    ...(pendingQuestion
      ? [{ id: `v2-pending:${slug}:user`, text: pendingQuestion, isUser: true as const }]
      : []),
  ];

  return <div
    className={`yansi-desktop-experience saina-main${mobile ? ' yansi-mobile-experience' : ''}`}
    data-testid="yansi-desktop-experience"
    data-reading-mode={reading.mode}
    data-yansi-continuation={isV2 ? 'v2_public_answer' : 'v1_sohbet'}
    data-yansi-publication-version={isV2 ? v2Continuation.publicationVersion : undefined}
  >
    {!mobile ? <SainaCinematicScene sceneImageUrl={sceneImageUrl} preserveFrame={preserveBrandFrame} /> : null}
    <div className="saina-main-body saina-desktop-chat-layout">
      <SainaDesktopChatLayout replay scrollRef={scrollRef}
        header={<>
          <div data-testid="yansi-desktop-identity" data-yansi-author-id={identity.authorUserId} data-yansi-avatar-authority="canonical-profile">
            {mobile ? <h2 className="yansi-mobile-experience-title">{identity.title}</h2> : <SainaHeroScene title={identity.title} displayName={identity.displayName} userId={identity.authorUserId}
              avatarUrl={identity.avatarUrl} avatarCacheBust={identity.avatarRevision ?? undefined}
              honorificId={identity.honorific ? resolvePublicHonorificId(identity.honorific) : null} honorificLabel={identity.honorific}
              metaTimeLabel={identity.timeLabel} metaTypeLabel={identity.businessLabel || "Yansı"} />}
          </div>
        </>}
        messages={<div className="yansi-public-reading" data-testid="yansi-public-reading"
          data-reading-mode={reading.mode} data-reading-spacing={reading.spacing}
          style={{ '--yansi-reading-size': `${reading.fontSize}px` } as CSSProperties}>
          {messages}
          {isV2 && liveMessages.length > 0 ? (
            <div data-testid="yansi-v2-live-thread" data-yansi-live-count={livePairs.length}>
              <MessageList
                messages={liveMessages}
                variant="saina"
                autoScroll={false}
                isLoading={starting && !!pendingQuestion}
                ezaVisibilityEnabled={false}
                renderMessageBody={(message) => (
                  <SainaMessageBody
                    message={message.text}
                    role={message.isUser ? 'user' : 'ai'}
                  />
                )}
              />
            </div>
          ) : null}
        </div>}
        action={<>
          {replayAction}
          {error ? (
            <div className="flex flex-col items-center gap-2" data-testid="yansi-personal-chat-error-wrap">
              <p role="alert" data-testid="yansi-personal-chat-error">{error}</p>
              {isV2 && pendingQuestion ? (
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-[#e8dfd0]"
                  data-testid="yansi-v2-continue-retry"
                  onClick={handleRetry}
                  disabled={starting}
                >
                  Yeniden dene
                </button>
              ) : null}
            </div>
          ) : null}
        </>}
        composer={allowPersonalContinue ? (
          <SainaComposer
            key={sourceKey}
            onSend={handleSend}
            isLoading={starting}
            preserveDraftOnSend={isV2 ? false : true}
            placeholderText={mobile ? 'Kendi merakınla devam et...' : undefined}
          />
        ) : null}
      />
    </div>
  </div>;
}
