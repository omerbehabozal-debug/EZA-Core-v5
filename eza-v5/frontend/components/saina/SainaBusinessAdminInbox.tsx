'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { BrandApplication, Business } from '@/lib/eza/businessYansi';

const STATUS_TR: Record<string, string> = {
  received: 'Alındı',
  under_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

type Props = {
  applications: BrandApplication[];
  businesses?: Business[];
  busy?: boolean;
  error?: string;
  notice?: string;
  onRefresh: () => Promise<void>;
  onTransition: (
    applicationId: string,
    body: { target: string; slug?: string; note?: string }
  ) => Promise<void>;
  onOpenBusiness?: (id: string) => void;
  accountMenu?: ReactNode;
};

export default function SainaBusinessAdminInbox({
  applications,
  businesses = [],
  busy = false,
  error = '',
  notice = '',
  onRefresh,
  onTransition,
  onOpenBusiness,
  accountMenu,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = applications.find((a) => a.id === selectedId) || applications[0] || null;

  async function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    await onTransition(selected.id, {
      target: 'approved',
      slug: String(data.slug || ''),
      note: String(data.note || ''),
    });
  }

  return (
    <section className="biz-admin-inbox" aria-label="Business başvuru yönetimi">
      <header className="biz-panel-header">
        <div className="biz-brand-block">
          <div className="biz-brand-mark" aria-hidden>
            A
          </div>
          <div className="biz-brand-copy">
            <p className="biz-brand-kicker">Platform admin</p>
            <p className="biz-brand-title">Marka başvuruları</p>
          </div>
        </div>
        <div className="biz-header-actions">
          <button type="button" className="biz-gate-secondary" disabled={busy} onClick={() => void onRefresh()}>
            Yenile
          </button>
          {accountMenu}
        </div>
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

      <div className="biz-admin-layout">
        <aside className="biz-admin-list" aria-label="Başvuru listesi">
          {applications.length === 0 ? (
            <p className="biz-empty">Bekleyen veya geçmiş başvuru yok.</p>
          ) : (
            <ul>
              {applications.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    className={`biz-admin-list-item${selected?.id === app.id ? ' is-active' : ''}`}
                    aria-current={selected?.id === app.id ? 'true' : undefined}
                    onClick={() => setSelectedId(app.id)}
                    disabled={busy}
                  >
                    <strong>{app.brand_name}</strong>
                    <span className={`biz-status biz-status--${app.status}`}>
                      {STATUS_TR[app.status] || app.status}
                    </span>
                    <span className="biz-muted">{app.corporate_email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="biz-admin-detail">
          {!selected ? (
            <p className="biz-section-lead">İncelemek için bir başvuru seçin.</p>
          ) : (
            <article className="biz-card">
              <h1 className="biz-section-title">{selected.brand_name}</h1>
              <p className="biz-section-lead">
                Durum:{' '}
                <span className={`biz-status biz-status--${selected.status}`}>
                  {STATUS_TR[selected.status] || selected.status}
                </span>
              </p>
              <dl className="biz-admin-meta">
                <div>
                  <dt>Yetkili kişi</dt>
                  <dd>{selected.contact_name}</dd>
                </div>
                <div>
                  <dt>Kurumsal e-posta</dt>
                  <dd>{selected.corporate_email}</dd>
                </div>
                <div>
                  <dt>Web sitesi</dt>
                  <dd>{selected.website || '—'}</dd>
                </div>
                <div>
                  <dt>Şirket bilgileri</dt>
                  <dd>{selected.company_info || '—'}</dd>
                </div>
                {selected.reviewer_note ? (
                  <div>
                    <dt>Yönetici notu</dt>
                    <dd>{selected.reviewer_note}</dd>
                  </div>
                ) : null}
                {selected.business_id ? (
                  <div>
                    <dt>Business ID</dt>
                    <dd>{selected.business_id}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="biz-actions">
                {selected.status === 'received' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onTransition(selected.id, { target: 'under_review' })}
                  >
                    İncelemeye al
                  </button>
                ) : null}
                {(selected.status === 'received' || selected.status === 'under_review') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onTransition(selected.id, { target: 'rejected', note: 'Reddedildi' })
                    }
                  >
                    Reddet
                  </button>
                )}
              </div>

              {(selected.status === 'received' || selected.status === 'under_review') && (
                <form className="biz-form biz-gate-form" onSubmit={(e) => void approve(e)}>
                  <h2 className="biz-section-title">Onayla ve Business aç</h2>
                  <p className="biz-section-lead">
                    Onay Organization, Business profili ve başvuru sahibine owner üyeliği oluşturur.
                  </p>
                  <label>
                    Benzersiz slug
                    <input name="slug" required minLength={2} maxLength={64} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={busy} />
                  </label>
                  <label>
                    Not (opsiyonel)
                    <input name="note" maxLength={1000} disabled={busy} />
                  </label>
                  <button type="submit" disabled={busy}>
                    Onayla
                  </button>
                </form>
              )}

              {selected.status === 'approved' && selected.business_id && onOpenBusiness ? (
                <button
                  type="button"
                  className="biz-gate-primary"
                  disabled={busy}
                  onClick={() => onOpenBusiness(selected.business_id!)}
                >
                  Business panelini aç
                </button>
              ) : null}
            </article>
          )}

          {businesses.length > 0 && onOpenBusiness ? (
            <div className="biz-card" style={{ marginTop: 16 }}>
              <h2 className="biz-section-title">Üye olduğunuz Business hesapları</h2>
              <ul className="biz-gate-list">
                {businesses.map((b) => (
                  <li key={b.id}>
                    <button type="button" className="biz-gate-secondary" disabled={busy} onClick={() => onOpenBusiness(b.id)}>
                      {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
