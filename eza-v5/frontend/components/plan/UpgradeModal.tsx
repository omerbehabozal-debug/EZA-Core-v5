'use client';

import { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_PREMIUM_MODAL_CTA,
  SAINA_PREMIUM_MODAL_DISMISS,
  SAINA_PREMIUM_MODAL_FEATURES,
  SAINA_PREMIUM_MODAL_NOTE,
  SAINA_PREMIUM_MODAL_TITLE,
} from '@/lib/eza/sainaCopy';

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Hangi özellikten tetiklendi (analitik/etiket amaçlı). */
  feature?: string;
}

/** Premium upgrade — logged-in free users only. Guests use IdentityModal. */
export default function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-upgrade-title"
      data-upgrade-feature={feature}
      data-testid="saina-premium-modal"
    >
      <div
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          'relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 p-6 text-center shadow-[0_24px_70px_-24px_rgba(0,0,0,0.65)]',
          'bg-[rgba(8,22,18,0.96)] text-[#f6f4ef] animate-slide-up'
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/6 hover:text-white/80"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(231,180,91,0.22)] bg-gradient-to-br from-[rgba(231,180,91,0.18)] to-[rgba(22,94,78,0.35)] text-[#e7b45b]"
          aria-hidden
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <h2
          id="plan-upgrade-title"
          className="saina-serif text-xl font-semibold tracking-[-0.02em] text-[#f6f4ef]"
        >
          {SAINA_PREMIUM_MODAL_TITLE}
        </h2>

        <ul className="mt-4 space-y-2 text-left text-sm text-white/82">
          {SAINA_PREMIUM_MODAL_FEATURES.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-[#e7b45b]" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[11px] leading-relaxed text-white/42">{SAINA_PREMIUM_MODAL_NOTE}</p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#f6f4ef] px-6 py-2.5 text-sm font-medium text-[#0b1612] transition-colors hover:bg-white"
            data-testid="saina-premium-upgrade-cta"
          >
            {SAINA_PREMIUM_MODAL_CTA}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/14 px-6 py-2.5 text-sm font-medium text-white/72 transition-colors hover:bg-white/6"
          >
            {SAINA_PREMIUM_MODAL_DISMISS}
          </button>
        </div>
      </div>
    </div>
  );
}
