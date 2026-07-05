'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_BRAND,
  SAINA_IDENTITY_MODAL_DISMISS,
  SAINA_IDENTITY_MODAL_LINES,
  SAINA_IDENTITY_MODAL_LOGIN,
  SAINA_IDENTITY_MODAL_REGISTER,
} from '@/lib/eza/sainaCopy';

export interface IdentityModalProps {
  open: boolean;
  onClose: () => void;
}

function buildSainaAuthHref(pathname: string, page: 'login' | 'register') {
  const returnTo = encodeURIComponent(pathname || '/standalone');
  return `/platform/${page}?return=${returnTo}`;
}

export default function IdentityModal({ open, onClose }: IdentityModalProps) {
  const pathname = usePathname();
  const loginHref = buildSainaAuthHref(pathname || '/standalone', 'login');
  const registerHref = buildSainaAuthHref(pathname || '/standalone', 'register');

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
      aria-labelledby="saina-identity-title"
      data-testid="saina-identity-modal"
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
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(231,180,91,0.22)] bg-[rgba(231,180,91,0.08)] text-[#e7b45b]"
          aria-hidden
        >
          <User className="h-5 w-5" strokeWidth={1.75} />
        </div>

        <p className="saina-serif text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]/85">
          {SAINA_BRAND}
        </p>

        <div className="mt-4 space-y-2 text-sm leading-relaxed text-white/78" id="saina-identity-title">
          {SAINA_IDENTITY_MODAL_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={loginHref}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#f6f4ef] px-6 py-2.5 text-sm font-medium text-[#0b1612] transition-colors hover:bg-white"
            data-testid="saina-identity-login-cta"
          >
            {SAINA_IDENTITY_MODAL_LOGIN}
          </Link>
          <Link
            href={registerHref}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/14 bg-transparent px-6 py-2.5 text-sm font-medium text-white/88 transition-colors hover:bg-white/6"
            data-testid="saina-identity-register-cta"
          >
            {SAINA_IDENTITY_MODAL_REGISTER}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white/52 transition-colors hover:text-white/72"
            data-testid="saina-identity-dismiss"
          >
            {SAINA_IDENTITY_MODAL_DISMISS}
          </button>
        </div>
      </div>
    </div>
  );
}
