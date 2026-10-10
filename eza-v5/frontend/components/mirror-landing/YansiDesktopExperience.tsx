'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import SainaDesktopChatLayout from '@/components/saina/SainaDesktopChatLayout';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
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
export default function YansiDesktopExperience({ slug, identity, messages, replayAction, scrollRef, replaySelection, sceneImageUrl }: {
  slug: string;
  identity: DesktopYansiReplayIdentity;
  messages: ReactNode;
  replayAction: ReactNode;
  scrollRef: RefObject<HTMLDivElement>;
  sceneImageUrl?: string | null;
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

  return <div className="yansi-desktop-experience saina-main" data-testid="yansi-desktop-experience">
    <SainaCinematicScene sceneImageUrl={sceneImageUrl} />
    <div className="saina-main-body saina-desktop-chat-layout">
      <SainaDesktopChatLayout replay scrollRef={scrollRef}
        header={<>
          <div data-testid="yansi-desktop-identity" data-yansi-author-id={identity.authorUserId} data-yansi-avatar-authority="canonical-profile">
            <SainaHeroScene title={identity.title} displayName={identity.displayName} userId={identity.authorUserId}
              avatarUrl={identity.avatarUrl} avatarCacheBust={identity.avatarRevision ?? undefined}
              honorificId={identity.honorific ? resolvePublicHonorificId(identity.honorific) : null} honorificLabel={identity.honorific}
              metaTimeLabel={identity.timeLabel} metaTypeLabel="Yansı" />
          </div>
        </>}
        messages={messages}
        action={<>{replayAction}{error ? <p role="alert" data-testid="yansi-personal-chat-error">{error}</p> : null}</>}
        composer={<SainaComposer onSend={(message) => void continuePersonally(message)} isLoading={starting} preserveDraftOnSend />}
      />
    </div>
  </div>;
}
