'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import MirrorThoughtCardButton from '@/components/mirror-landing/MirrorThoughtCard';
import { createMirrorSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import {
  MIRROR_GUEST_CHAT_REPLY_PARAM,
  startMirrorGuestChat,
} from '@/lib/eza/mirror-network/mirrorGuestConversation';
import {
  trackSeedStart,
  trackGuestConversationStarted,
} from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import type { MirrorSohbetSession, MirrorThoughtCard } from '@/lib/eza/mirror-network/sohbetTypes';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import {
  isQuotaLimitReason,
  resolveDiscoverLimitMessage,
  type QuotaErrorDetail,
} from '@/lib/eza/plan/sainaQuotaMessages';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { cn } from '@/lib/utils';

export type MirrorSohbetOpeningProps = {
  slug: string;
  cardTitle: string;
  className?: string;
};

export default function MirrorSohbetOpening({
  slug,
  cardTitle,
  className,
}: MirrorSohbetOpeningProps) {
  const router = useRouter();
  const { isPlus, isLoading: isPlanLoading, source } = usePlan();
  const { entitlements: accountEntitlements } = useAccountEntitlements();
  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const { handleOpenUpgrade, gateModals } = useSainaGateModals({
    planTier,
    defaultUpgradeFeature: 'saina_discover',
  });
  const [session, setSession] = useState<MirrorSohbetSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'quota'>('loading');
  const [quotaDetail, setQuotaDetail] = useState<QuotaErrorDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      trackSeedStart(slug);
      const result = await createMirrorSohbetSession(slug);
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 403 && result.quotaDetail && isQuotaLimitReason(result.quotaDetail.reason)) {
          setQuotaDetail(result.quotaDetail);
          setStatus('quota');
          return;
        }
        setStatus('error');
        return;
      }
      setSession(result.session);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const beginGuestChat = useCallback(
    (message: string) => {
      if (!session || submitting) return;
      const text = message.trim();
      if (!text) return;

      setSubmitting(true);
      const created = startMirrorGuestChat({ session, firstUserMessage: text });
      if (!created) {
        setSubmitting(false);
        return;
      }

      trackGuestConversationStarted(session.mirrorSlug, session.guestToken);

      router.push(
        `/standalone?chat=${created.chatId}&${MIRROR_GUEST_CHAT_REPLY_PARAM}=1`
      );
    },
    [router, session, submitting]
  );

  const handleThoughtSelect = useCallback(
    (card: MirrorThoughtCard) => {
      beginGuestChat(card.label);
    },
    [beginGuestChat]
  );

  const handleSendDraft = useCallback(() => {
    beginGuestChat(draft);
  }, [beginGuestChat, draft]);

  const openingParagraphs = session?.openingMessage.split('\n\n') ?? [];
  const canSend = draft.trim().length > 0 && !submitting;
  const quotaMessage = resolveDiscoverLimitMessage(quotaDetail?.currentTier ?? planTier);

  return (
    <div
      className={cn(
        'mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[#0c0b0a] text-[#f4f0e8]',
        className
      )}
      data-mirror-sohbet
      data-mirror-sohbet-slug={slug}
    >
      <header className="flex items-center gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href={`/m/${slug}`}
          className="inline-flex items-center gap-1 text-xs text-[#a89f92] hover:text-[#e8dfd0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Ayna
        </Link>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8a8074]">
          <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          Sohbet
        </span>
      </header>

      <div className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a8074]">
          {cardTitle}
        </p>

        {status === 'loading' ? (
          <p className="mt-8 text-sm text-[#a89f92]">Sohbet hazırlanıyor…</p>
        ) : null}

        {status === 'error' ? (
          <p className="mt-8 text-sm text-[#c8a090]">
            Bu Ayna için sohbet şu an açılamıyor.
          </p>
        ) : null}

        {status === 'quota' ? (
          <div className="mt-8 space-y-4">
            <p className="whitespace-pre-line text-sm text-[#d8cfc0]">{quotaMessage}</p>
            {quotaDetail?.upgradeRequired !== false ? (
              <button
                type="button"
                onClick={() => handleOpenUpgrade('saina_discover')}
                className="rounded-full border border-[#e8d5b5]/25 bg-[#e8d5b5]/10 px-6 py-3 text-sm font-semibold text-[#f5ead8]"
              >
                Hesabını Yükselt
              </button>
            ) : null}
          </div>
        ) : null}

        {status === 'ready' && session ? (
          <>
            <div className="mt-6 space-y-4">
              {openingParagraphs.map((paragraph) => (
                <p key={paragraph} className="text-[15px] leading-[1.7] text-[#d8cfc0]">
                  {paragraph}
                </p>
              ))}
            </div>

            {session.thoughtCards.length > 0 ? (
              <div className="mt-8 space-y-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#8a8074]">
                  Merak kartları
                </p>
                {session.thoughtCards.map((card) => (
                  <MirrorThoughtCardButton
                    key={card.id}
                    card={card}
                    onSelect={handleThoughtSelect}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-auto pt-8">
              <label htmlFor="mirror-sohbet-draft" className="sr-only">
                Sorunu yaz
              </label>
              <textarea
                id="mirror-sohbet-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Kendi sorunu yaz…"
                rows={3}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#141210] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#6f675c] focus:border-[#e8d5b5]/30 focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={handleSendDraft}
                className={cn(
                  'mt-3 w-full rounded-full border border-[#e8d5b5]/25 bg-[#e8d5b5]/10 px-6 py-3 text-sm font-semibold text-[#f5ead8]',
                  !canSend && 'opacity-60'
                )}
              >
                {submitting ? 'Açılıyor…' : 'Gönder'}
              </button>
              <p className="mt-2 text-center text-[11px] text-[#8a8074]">
                Kendi Ayna&apos;nı üretmek için giriş gerekir.
              </p>
            </div>
          </>
        ) : null}
      </div>
      {gateModals}
    </div>
  );
}
