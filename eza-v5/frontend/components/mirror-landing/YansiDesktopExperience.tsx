'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import SainaComposer from '@/components/saina/SainaComposer';
import { resolvePublicHonorificId } from '@/lib/eza/mirror/publicHonorific';
import { createMirrorSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import { startMirrorGuestChat, MIRROR_GUEST_CHAT_REPLY_PARAM } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { trackSeedStart, trackGuestConversationStarted } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import { cancelYansiSpeech } from '@/lib/eza/mirror/yansiSpeech';
import type { PublicReplaySelection } from '@/lib/eza/mirror-network/publicReplayContinuation';

export type DesktopYansiReplayIdentity = {
  title: string;
  displayName: string;
  authorUserId: string;
  avatarUrl: string | null;
  avatarRevision?: number | null;
  honorific: string | null;
  timeLabel: string | null;
};

/** Presentation and personal-chat handoff only. Frozen replay remains parent-owned. */
export default function YansiDesktopExperience({ slug, identity, messages, replayAction, scrollRef, metrics, replaySelection }: {
  slug: string;
  identity: DesktopYansiReplayIdentity;
  messages: ReactNode;
  replayAction: ReactNode;
  scrollRef: RefObject<HTMLDivElement>;
  metrics?: ReactNode;
  replaySelection: PublicReplaySelection;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const continuePersonally = async (message: string) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    let handedOff = false;
    try {
      const result = await createMirrorSohbetSession(slug, { replaySelection });
      if (!mountedRef.current) return;
      if (!result.ok) {
        setError(result.quotaDetail ? 'Sohbet sınırına ulaştın. Kişisel sohbet şu an başlatılamadı.'
          : 'Kişisel sohbet başlatılamadı. Sorun korundu; yeniden deneyebilirsin.');
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
      if (mountedRef.current) setError('Kişisel sohbet başlatılamadı. Sorun korundu; yeniden deneyebilirsin.');
    } finally {
      if (mountedRef.current && !handedOff) { startingRef.current = false; setStarting(false); }
    }
  };

  return <div className="yansi-desktop-experience" data-testid="yansi-desktop-experience">
    <header className="yansi-desktop-experience__header" data-testid="yansi-title-block" data-yansi-title-position="elevated">
      <div data-testid="yansi-desktop-identity" data-yansi-author-id={identity.authorUserId} data-yansi-avatar-authority="canonical-profile">
        <SainaHeroScene title={identity.title} displayName={identity.displayName} userId={identity.authorUserId}
          avatarUrl={identity.avatarUrl} avatarCacheBust={identity.avatarRevision ?? undefined}
          honorificId={identity.honorific ? resolvePublicHonorificId(identity.honorific) : null} honorificLabel={identity.honorific} metaTimeLabel={identity.timeLabel} metaTypeLabel="Yansı" />
      </div>
      {metrics}
    </header>
    <div ref={scrollRef} className="yansi-desktop-experience__scroll" data-testid="mirror-frozen-replay-thread" tabIndex={0} aria-label="Yayınlanmış sohbet mesajları">
      <div className="saina-chat-card yansi-desktop-experience__messages">{messages}</div>
    </div>
    <div className="yansi-desktop-experience__actions" data-testid="yansi-chat-composer-lane">
      {replayAction}
      {error ? <p role="alert" data-testid="yansi-personal-chat-error">{error}</p> : null}
      <SainaComposer onSend={(message) => void continuePersonally(message)} isLoading={starting} preserveDraftOnSend />
    </div>
  </div>;
}
