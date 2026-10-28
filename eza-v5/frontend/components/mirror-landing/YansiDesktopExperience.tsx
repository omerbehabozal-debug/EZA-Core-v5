'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useYansiExperienceSession } from './YansiExperienceSession';
import { DEFAULT_YANSI_READING } from '@/lib/eza/mirror/yansiReadingPreferences';
import { useRouter } from 'next/navigation';
import SainaDesktopChatLayout from '@/components/saina/SainaDesktopChatLayout';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import SainaHeroScene from '@/components/saina/SainaHeroScene';
import SainaComposer from '@/components/saina/SainaComposer';
import { resolvePublicHonorificId } from '@/lib/eza/mirror/publicHonorific';
import { createMirrorSohbetSession, personalChatStartError } from '@/lib/eza/mirror-network/createSohbetSession';
import { startMirrorGuestChat, MIRROR_GUEST_CHAT_REPLY_PARAM } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { trackSeedStart, trackGuestConversationStarted } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import { cancelYansiSpeech } from '@/lib/eza/mirror/yansiSpeech';
import type { PublicReplaySelection } from '@/lib/eza/mirror-network/publicReplayContinuation';

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

/** Presentation and personal-chat handoff only. Frozen replay remains parent-owned. */
export default function YansiDesktopExperience({ slug, identity, messages, replayAction, scrollRef, replaySelection, sceneImageUrl, preserveBrandFrame = false, mobile = false }: {
  slug: string;
  mobile?: boolean;
  preserveBrandFrame?: boolean;
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
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const sourceKey = `${slug}:${replaySelection.journeyVersion}`;
  const sourceRef = useRef(sourceKey);
  sourceRef.current = sourceKey;
  const requestGenerationRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    startingRef.current = false;
    setStarting(false);
    setError(null);
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

  return <div className={`yansi-desktop-experience saina-main${mobile ? ' yansi-mobile-experience' : ''}`} data-testid="yansi-desktop-experience" data-reading-mode={reading.mode}>
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
          style={{ '--yansi-reading-size': `${reading.fontSize}px` } as CSSProperties}>{messages}</div>}
        action={<>{replayAction}{error ? <p role="alert" data-testid="yansi-personal-chat-error">{error}</p> : null}</>}
        composer={<SainaComposer key={sourceKey} onSend={(message) => void continuePersonally(message)} isLoading={starting} preserveDraftOnSend placeholderText={mobile ? 'Kendi merakınla devam et...' : undefined} />}
      />
    </div>
  </div>;
}
