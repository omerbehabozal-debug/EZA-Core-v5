'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PLAN_UPGRADE_AUTH_BODY,
  PLAN_UPGRADE_AUTH_TITLE,
  PLAN_UPGRADE_BADGE,
  PLAN_UPGRADE_LOGIN_CTA,
  PLAN_UPGRADE_MIRROR_SAVE_BODY,
  PLAN_UPGRADE_MIRROR_SAVE_CTA,
  PLAN_UPGRADE_MIRROR_SAVE_TITLE,
  PLAN_UPGRADE_MODAL_BODY,
  PLAN_UPGRADE_MODAL_DISMISS,
  PLAN_UPGRADE_MODAL_NOTE,
  PLAN_UPGRADE_MODAL_TITLE,
} from '@/lib/eza/mirror/copy';

export type UpgradeModalVariant = 'upgrade' | 'auth_required';

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  variant?: UpgradeModalVariant;
  /** Hangi özellikten tetiklendi (analitik/etiket amaçlı). */
  feature?: string;
}

export default function UpgradeModal({
  open,
  onClose,
  variant = 'upgrade',
  feature,
}: UpgradeModalProps) {
  const pathname = usePathname();
  const loginHref = `/platform/login?return=${encodeURIComponent(pathname || '/standalone')}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isAuth = variant === 'auth_required';
  const isMirrorSave = feature === 'conversation_mirror';
  const title = isAuth
    ? isMirrorSave
      ? PLAN_UPGRADE_MIRROR_SAVE_TITLE
      : PLAN_UPGRADE_AUTH_TITLE
    : PLAN_UPGRADE_MODAL_TITLE;
  const body = isAuth
    ? isMirrorSave
      ? PLAN_UPGRADE_MIRROR_SAVE_BODY
      : PLAN_UPGRADE_AUTH_BODY
    : PLAN_UPGRADE_MODAL_BODY;
  const loginCta = isMirrorSave && isAuth ? PLAN_UPGRADE_MIRROR_SAVE_CTA : PLAN_UPGRADE_LOGIN_CTA;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-upgrade-title"
      data-upgrade-feature={feature}
    >
      <div
        className="absolute inset-0 bg-stone-900/35 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          'relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-6 text-center shadow-[0_24px_70px_-24px_rgba(99,102,241,0.45)] backdrop-blur-xl',
          'animate-slide-up'
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.7)]"
          aria-hidden
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          {PLAN_UPGRADE_BADGE}
        </span>

        <h2
          id="plan-upgrade-title"
          className="mt-3 text-lg font-semibold tracking-[-0.02em] text-stone-900"
        >
          {title}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-stone-600">{body}</p>

        {!isAuth ? (
          <p className="mt-4 text-[11px] leading-relaxed text-stone-400">
            {PLAN_UPGRADE_MODAL_NOTE}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {isAuth ? (
            <Link
              href={loginHref}
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
            >
              {loginCta}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'inline-flex w-full items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              isAuth
                ? 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 focus-visible:outline-stone-400'
                : 'bg-stone-900 text-white hover:bg-stone-800 focus-visible:outline-stone-400'
            )}
          >
            {PLAN_UPGRADE_MODAL_DISMISS}
          </button>
        </div>
      </div>
    </div>
  );
}
