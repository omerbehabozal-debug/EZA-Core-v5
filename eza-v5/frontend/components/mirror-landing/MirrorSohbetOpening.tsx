'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import MirrorThoughtCardButton from '@/components/mirror-landing/MirrorThoughtCard';
import { createMirrorSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import { trackSeedStart } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import type { MirrorSohbetSession, MirrorThoughtCard } from '@/lib/eza/mirror-network/sohbetTypes';
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
  const [session, setSession] = useState<MirrorSohbetSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      trackSeedStart(slug);
      const result = await createMirrorSohbetSession(slug);
      if (cancelled) return;
      if (!result.ok) {
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

  const handleThoughtSelect = useCallback((card: MirrorThoughtCard) => {
    setDraft(card.label);
  }, []);

  const openingParagraphs = session?.openingMessage.split('\n\n') ?? [];

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
          Mirror
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
            Bu Mirror için sohbet şu an açılamıyor.
          </p>
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
                className="w-full resize-none rounded-xl border border-white/10 bg-[#141210] px-4 py-3 text-sm text-[#f4f0e8] placeholder:text-[#6f675c] focus:border-[#e8d5b5]/30 focus:outline-none"
              />
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-3 w-full rounded-full border border-[#e8d5b5]/25 bg-[#e8d5b5]/10 px-6 py-3 text-sm font-semibold text-[#f5ead8] opacity-60"
              >
                Gönder
              </button>
              <p className="mt-2 text-center text-[11px] text-[#8a8074]">
                Tam sohbet akışı yakında. Kendi Mirror&apos;ını üretmek için giriş gerekir.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
