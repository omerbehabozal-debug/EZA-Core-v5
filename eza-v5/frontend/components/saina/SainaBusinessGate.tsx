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
  mode: 'anonymous' | 'no-access' | 'pick' | 'unavailable' | 'loading';
  applications?: BrandApplication[];
  businesses?: { id: string; name: string }[];
  busy?: boolean;
  error?: string;
  notice?: string;
  /** Shown for unavailable / blocked service states (not brand-access denial). */
  serviceMessage?: string;
  serviceNote?: string;
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

function BilignBusinessMark() {
  return (
    <div className="biz-welcome-brand">
      <div className="biz-welcome-mark" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 20V9l4-3 4 3 4-3 4 3v11" />
          <path d="M8 20v-6h3v6M13 20v-8h3v8" />
        </svg>
      </div>
      <div className="biz-welcome-brand-copy">
        <p className="biz-welcome-brand-kicker">biligN</p>
        <p className="biz-welcome-brand-title">Business</p>
      </div>
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
  serviceMessage = '',
  serviceNote = '',
  onSubmitApplication,
  onSelectBusiness,
}: Props) {
  const { user } = useAuth();
  // Return to Business after login/register — no separate Business membership.
  const loginHref = useMemo(() => buildSainaAuthHref('/standalone/business', 'login'), []);
  const registerHref = useMemo(() => buildSainaAuthHref('/standalone/business', 'register'), []);

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

  if (mode === 'anonymous') {
    return (
      <section className="biz-gate biz-gate--welcome" aria-label="BiligN Business karşılama">
        <div className="biz-welcome-card">
          <BilignBusinessMark />
          <h1 className="biz-welcome-title">Markanız da BiligN&apos;de.</h1>
          <p className="biz-welcome-lead">Bireysel BiligN hesabınızla markanızı da yönetin.</p>
          <p className="biz-welcome-support">
            Ayrı bir Business üyeliğine ihtiyacınız yok. Tek hesapla hem kişisel hem kurumsal deneyime erişebilirsiniz.
          </p>
          <div className="biz-welcome-actions">
            <Link className="biz-welcome-primary" href={loginHref}>
              BiligN hesabımla devam et
            </Link>
            <Link className="biz-welcome-secondary" href={registerHref}>
              BiligN hesabı oluştur
            </Link>
          </div>
          <p className="biz-welcome-privacy">
            <span className="biz-welcome-privacy-icon" aria-hidden>
              ✓
            </span>
            Kişisel sohbetleriniz marka yönetiminden ayrı ve özel kalır.
          </p>
        </div>
      </section>
    );
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

      {mode === 'loading' && (
        <div className="biz-gate-hero">
          <p className="biz-gate-lead">Business durumu kontrol ediliyor…</p>
        </div>
      )}

      {mode === 'unavailable' && (
        <div className="biz-gate-hero">
          <h1 className="biz-gate-title">BiligN Business</h1>
          <p className="biz-gate-lead" role="alert">
            {serviceMessage || 'BiligN Business şu anda kullanıma hazırlanıyor.'}
          </p>
          <p className="biz-gate-note">
            {serviceNote ||
              'Oturumun açık. Business kullanıma açıldığında aynı BiligN hesabınla devam edebilirsin.'}
          </p>
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
          <h1 className="biz-gate-title">Marka yetkisi yok</h1>
          <p className="biz-gate-lead">
            Bu BiligN hesabına bağlı aktif bir Business üyeliği bulunmuyor. Markanızı BiligN&apos;e ekleyebilir veya mevcut
            başvurularınızı izleyebilirsiniz.
          </p>

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
              <h2 className="biz-section-title">Markanızı BiligN&apos;e ekleyin</h2>
              <p className="biz-section-lead">
                Başvuru otomatik yetki vermez. Onay yalnızca platform yöneticisindedir. Ayrı bir Business üyeliği yoktur.
              </p>
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
