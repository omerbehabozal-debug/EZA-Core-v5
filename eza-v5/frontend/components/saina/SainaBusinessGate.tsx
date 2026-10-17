'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { buildSainaAuthHref } from '@/lib/eza/sainaIdentity';
import { resolveSainaUserDisplayName, resolveSainaUserInitial } from '@/lib/eza/sainaIdentity';
import type { BrandApplication } from '@/lib/eza/businessYansi';

const STATUS_TR: Record<string, string> = {
  received: 'Alındı',
  under_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

type Props = {
  mode: 'anonymous' | 'no-access' | 'pick';
  applications?: BrandApplication[];
  businesses?: { id: string; name: string }[];
  busy?: boolean;
  error?: string;
  notice?: string;
  onSubmitApplication?: (payload: {
    brandName: string;
    contactName: string;
    corporateEmail: string;
    website?: string;
    companyInfo: string;
  }) => Promise<void>;
  onSelectBusiness?: (id: string) => void;
};

function AccountChip() {
  const { user, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const name = resolveSainaUserDisplayName(user?.email, user?.full_name, user?.public_display_name);
  const initial = resolveSainaUserInitial(user?.email, user?.public_display_name, user?.full_name);
  if (!isAuthenticated || !user) return null;
  return (
    <div className="biz-account-menu">
      <button
        type="button"
        className="biz-account-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="biz-account-avatar" aria-hidden>
          {initial}
        </span>
        <span className="biz-account-name">{name}</span>
      </button>
      {open && (
        <div className="biz-account-dropdown" role="menu">
          <p className="biz-account-email">{user.email}</p>
          <Link role="menuitem" href="/standalone/discover" className="biz-account-item" onClick={() => setOpen(false)}>
            BiligN&apos;e geç
          </Link>
          <button
            type="button"
            role="menuitem"
            className="biz-account-item"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}

export default function SainaBusinessGate({
  mode,
  applications = [],
  businesses = [],
  busy = false,
  error = '',
  notice = '',
  onSubmitApplication,
  onSelectBusiness,
}: Props) {
  const { user } = useAuth();
  const loginHref = useMemo(() => buildSainaAuthHref('/standalone/business', 'login'), []);
  const registerHref = useMemo(
    () => buildSainaAuthHref('/standalone/business?apply=1', 'register'),
    []
  );
  const applyHref = useMemo(() => buildSainaAuthHref('/standalone/business?apply=1', 'login'), []);

  async function handleApply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onSubmitApplication) return;
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    await onSubmitApplication({
      brandName: String(data.brandName || ''),
      contactName: String(data.contactName || ''),
      corporateEmail: String(data.corporateEmail || ''),
      website: String(data.website || '') || undefined,
      companyInfo: String(data.companyInfo || ''),
    });
    e.currentTarget.reset();
  }

  return (
    <section className="biz-gate" aria-label="Business giriş">
      <header className="biz-gate-header">
        <div className="biz-brand-block">
          <div className="biz-brand-mark" aria-hidden>
            B
          </div>
          <div className="biz-brand-copy">
            <p className="biz-brand-kicker">Business Yansı</p>
            <p className="biz-brand-title">Marka yönetimi</p>
          </div>
        </div>
        <AccountChip />
      </header>

      {error ? (
        <p className="biz-alert" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="biz-notice" role="status">
          {notice}
        </p>
      ) : null}

      {mode === 'anonymous' && (
        <div className="biz-gate-hero">
          <h1 className="biz-gate-title">Business Yansı</h1>
          <p className="biz-gate-lead">
            Doğrulanmış marka bilgileri ve editoryal yayınlar için BiligN Business yönetim alanı.
          </p>
          <div className="biz-gate-actions">
            <Link className="biz-gate-primary" href={loginHref}>
              Business hesabına giriş yap
            </Link>
            <Link className="biz-gate-secondary" href={registerHref}>
              Markanızı kaydedin
            </Link>
          </div>
          <p className="biz-gate-note">Mevcut BiligN hesabınızla giriş yapılır. Ayrı bir Business parolası yoktur.</p>
        </div>
      )}

      {mode === 'pick' && (
        <div className="biz-gate-hero">
          <h1 className="biz-gate-title">Marka seçin</h1>
          <p className="biz-gate-lead">Yönetmek istediğiniz Business hesabını seçin.</p>
          <ul className="biz-gate-list">
            {businesses.map((b) => (
              <li key={b.id}>
                <button type="button" className="biz-gate-primary" disabled={busy} onClick={() => onSelectBusiness?.(b.id)}>
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'no-access' && (
        <div className="biz-gate-hero">
          <h1 className="biz-gate-title">Business yetkisi yok</h1>
          <p className="biz-gate-lead">
            Bu BiligN hesabına bağlı aktif bir Business üyeliği bulunmuyor. Marka başvurusu gönderebilir veya mevcut
            başvurularınızı izleyebilirsiniz.
          </p>
          {!user ? (
            <Link className="biz-gate-primary" href={applyHref}>
              Başvuru için giriş yap
            </Link>
          ) : null}

          {applications.length > 0 && (
            <div className="biz-card biz-gate-card">
              <h2 className="biz-section-title">Başvuru durumunuz</h2>
              <ul className="biz-gate-apps">
                {applications.map((app) => (
                  <li key={app.id}>
                    <strong>{app.brand_name}</strong>
                    <span className={`biz-status biz-status--${app.status}`}>
                      {STATUS_TR[String(app.status)] || String(app.status)}
                    </span>
                    {app.reviewer_note ? <p className="biz-muted">{app.reviewer_note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {user && onSubmitApplication && (
            <form className="biz-form biz-gate-form" onSubmit={(e) => void handleApply(e)}>
              <h2 className="biz-section-title">Marka başvurusu</h2>
              <p className="biz-section-lead">Başvuru otomatik hesap veya yetki vermez. Onay yalnızca platform yöneticisindedir.</p>
              <label>
                Marka adı
                <input name="brandName" required maxLength={120} disabled={busy} />
              </label>
              <label>
                Yetkili kişi
                <input name="contactName" required maxLength={120} defaultValue={user.full_name || ''} disabled={busy} />
              </label>
              <label>
                Kurumsal e-posta
                <input
                  name="corporateEmail"
                  type="email"
                  required
                  maxLength={255}
                  defaultValue={user.email || ''}
                  disabled={busy}
                />
              </label>
              <label>
                Web sitesi (opsiyonel)
                <input name="website" type="url" placeholder="https://" maxLength={500} disabled={busy} />
              </label>
              <label>
                Şirket bilgileri
                <textarea name="companyInfo" rows={4} maxLength={2000} disabled={busy} />
              </label>
              <button type="submit" disabled={busy}>
                Başvuruyu gönder
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
