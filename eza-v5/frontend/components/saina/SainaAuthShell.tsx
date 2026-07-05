'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { SAINA_BRAND } from '@/lib/eza/sainaCopy';
import SainaGeometricMark from '@/components/saina/SainaGeometricMark';

type SainaAuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function SainaAuthShell({ title, subtitle, children, footer }: SainaAuthShellProps) {
  return (
    <div className="saina-auth-page" data-testid="saina-auth-page">
      <div className="saina-auth-page__backdrop" aria-hidden />
      <div className="saina-auth-page__inner">
        <div className="saina-auth-page__brand">
          <SainaGeometricMark size={40} variant="gold" />
          <p className="saina-auth-page__brand-title saina-serif">{SAINA_BRAND}</p>
          <h1 className="saina-auth-page__title">{title}</h1>
          {subtitle ? <p className="saina-auth-page__subtitle">{subtitle}</p> : null}
        </div>

        <div className="saina-auth-page__card">{children}</div>

        {footer ? <div className="saina-auth-page__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function SainaAuthGoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="saina-auth-google-btn"
      data-testid="saina-auth-google-btn"
    >
      <span className="saina-auth-google-btn__icon" aria-hidden>
        G
      </span>
      Google ile devam et
    </button>
  );
}

export function SainaAuthDivider() {
  return (
    <div className="saina-auth-divider" role="separator">
      <span>veya</span>
    </div>
  );
}

export function SainaAuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="saina-auth-link">
      {children}
    </Link>
  );
}
