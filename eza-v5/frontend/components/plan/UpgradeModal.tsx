'use client';

import { useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { SAINA_UPGRADE_PLANS } from '@/lib/eza/plan/sainaAccountTiers';
import {
  SAINA_UPGRADE_MODAL_DISMISS,
  SAINA_UPGRADE_MODAL_NOTE,
  SAINA_UPGRADE_MODAL_SUBTITLE,
  SAINA_UPGRADE_MODAL_TITLE,
  SAINA_UPGRADE_PLAN_COMING_SOON,
  SAINA_UPGRADE_PLAN_MONTHLY_LABEL,
  SAINA_UPGRADE_STANDARD_BADGE,
} from '@/lib/eza/sainaCopy';

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Hangi özellikten tetiklendi (analitik/etiket amaçlı). */
  feature?: string;
}

/** Account upgrade — logged-in users below Premium. Guests use IdentityModal. */
export default function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dismissRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusTrap({
    open,
    onClose,
    containerRef: panelRef,
    initialFocusRef: dismissRef,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-upgrade-title"
      data-upgrade-feature={feature}
      data-testid="saina-upgrade-modal"
    >
      <div
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        className={cn(
          'relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 p-6 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.65)]',
          'bg-[rgba(8,22,18,0.96)] text-[#f6f4ef] animate-slide-up'
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="saina-modal-close-btn absolute right-3 top-3 flex items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/6 hover:text-white/80"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(231,180,91,0.22)] bg-gradient-to-br from-[rgba(231,180,91,0.18)] to-[rgba(22,94,78,0.35)] text-[#e7b45b]">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="text-center">
          <h2
            id="plan-upgrade-title"
            className="saina-serif text-xl font-semibold tracking-[-0.02em] text-[#f6f4ef]"
          >
            {SAINA_UPGRADE_MODAL_TITLE}
          </h2>
          <p className="mt-2 text-sm text-white/62">{SAINA_UPGRADE_MODAL_SUBTITLE}</p>
        </div>

        <div className="saina-upgrade-plan-grid mt-6">
          {SAINA_UPGRADE_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                'saina-upgrade-plan-card',
                plan.recommended && 'saina-upgrade-plan-card--recommended'
              )}
              data-testid={`saina-upgrade-plan-${plan.id}`}
            >
              {plan.recommended ? (
                <span className="saina-upgrade-plan-badge">{SAINA_UPGRADE_STANDARD_BADGE}</span>
              ) : null}
              <h3 className="saina-upgrade-plan-name saina-serif">{plan.name}</h3>
              <ul className="saina-upgrade-plan-features">
                {plan.features.map((item) => (
                  <li key={item}>
                    <span aria-hidden>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="saina-upgrade-plan-price">
                {SAINA_UPGRADE_PLAN_MONTHLY_LABEL} · {SAINA_UPGRADE_PLAN_COMING_SOON}
              </p>
              <button
                type="button"
                disabled
                className="saina-upgrade-plan-cta saina-modal-cta saina-modal-cta--disabled"
                data-testid={`saina-upgrade-plan-cta-${plan.id}`}
                aria-disabled="true"
              >
                {SAINA_UPGRADE_PLAN_COMING_SOON}
              </button>
            </article>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/42">
          {SAINA_UPGRADE_MODAL_NOTE}
        </p>

        <button
          ref={dismissRef}
          type="button"
          onClick={onClose}
          className="saina-modal-cta mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/14 px-6 text-sm font-medium text-white/88 transition-colors hover:bg-white/6"
        >
          {SAINA_UPGRADE_MODAL_DISMISS}
        </button>
      </div>
    </div>
  );
}
