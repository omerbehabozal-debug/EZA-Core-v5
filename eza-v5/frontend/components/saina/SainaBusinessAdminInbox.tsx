'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { businessRequest as api, type BrandApplication, type Business } from '@/lib/eza/businessYansi';
import {
  applicationActionLabel,
  applicationStatusLabel,
  formatPlatformDate,
} from '@/lib/eza/platformAdminUi';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'received', label: 'Yeni' },
  { id: 'under_review', label: 'İncelemede' },
  { id: 'approved', label: 'Onaylandı' },
  { id: 'rejected', label: 'Reddedildi' },
] as const;

type AppEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  created_at?: string;
  actor_user_id: string;
};

type Props = {
  applications: BrandApplication[];
  businesses?: Business[];
  busy?: boolean;
  error?: string;
  notice?: string;
  embedded?: boolean;
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
  embedded = false,
  onRefresh,
  onTransition,
  onOpenBusiness,
  accountMenu,
}: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [selectedId, setSelectedId] = useState<string>('');
  /** Narrow (≤900px): list ↔ detail stack. Wide: optional split; back clears selection. */
  const [mobileDetail, setMobileDetail] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [eventsError, setEventsError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return applications;
    return applications.filter((a) => a.status === filter);
  }, [applications, filter]);

  // Never auto-select: list and detail must show the same record, and Back must be able to close.
  const selected = useMemo(() => {
    if (!filtered.length || !selectedId) return null;
    return filtered.find((a) => a.id === selectedId) || null;
  }, [filtered, selectedId]);

  const hasSelection = Boolean(selected);

  useEffect(() => {
    if (!selected?.id) {
      setEvents([]);
      return;
    }
    let active = true;
    setEventsError('');
    api<{ items: AppEvent[] }>(`/applications/${selected.id}/events`)
      .then((data) => {
        if (active) setEvents(data.items || []);
      })
      .catch((e) => {
        if (active) {
          setEvents([]);
          setEventsError(e instanceof Error ? e.message : 'Başvuru geçmişi alınamadı.');
        }
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);

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

  function selectApp(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  function backToList() {
    setMobileDetail(false);
    setSelectedId('');
  }

  return (
    <section
      className={`biz-admin-inbox${mobileDetail && isNarrow ? ' is-mobile-detail' : ''}${hasSelection ? ' has-selection' : ' is-list-only'}`}
      aria-label="Business başvuru yönetimi"
    >
      {!embedded ? (
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
      ) : (
        <div className="padmin-section-head">
          <div>
            <h1 className="padmin-page-title">Marka Başvuruları</h1>
            <p className="padmin-page-lead">Onay ve red işlemleri mevcut başvuru akışını kullanır.</p>
          </div>
          <button type="button" className="biz-gate-secondary" disabled={busy} onClick={() => void onRefresh()}>
            Yenile
          </button>
        </div>
      )}

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

      <div className="biz-admin-filters" role="tablist" aria-label="Başvuru filtreleri">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={`biz-admin-filter${filter === item.id ? ' is-active' : ''}`}
            onClick={() => {
              setFilter(item.id);
              backToList();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={`biz-admin-layout${hasSelection ? '' : ' is-list-only'}`}>
        <aside className="biz-admin-list" aria-label="Başvuru listesi">
          {filtered.length === 0 ? (
            <div className="padmin-empty">
              <strong>Başvuru yok</strong>
              <p>Bu filtrede gösterilecek marka başvurusu bulunmuyor.</p>
            </div>
          ) : (
            <ul>
              {filtered.map((app) => {
                const statusLabel = applicationStatusLabel(app.status);
                return (
                <li key={app.id}>
                  <button
                    type="button"
                    className={`biz-admin-list-item${selected?.id === app.id ? ' is-active' : ''}`}
                    aria-current={selected?.id === app.id ? 'true' : undefined}
                    onClick={() => selectApp(app.id)}
                    disabled={busy}
                  >
                    <span className="biz-admin-list-top">
                      <strong className="biz-admin-ellipsis">{app.brand_name}</strong>
                      <span
                        className={`biz-status biz-status--${app.status}`}
                        title={statusLabel}
                      >
                        {statusLabel}
                      </span>
                    </span>
                    <span className="biz-admin-ellipsis biz-muted">{app.corporate_email}</span>
                    <span className="biz-muted biz-admin-list-date">{formatPlatformDate(app.created_at)}</span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="biz-admin-detail">
          {hasSelection ? (
            <button type="button" className="biz-admin-back" onClick={backToList}>
              ← Listeye dön
            </button>
          ) : null}

          {!selected ? (
            <div className="padmin-empty">
              <strong>Başvuru seçin</strong>
              <p>Detayları ve işlemleri görmek için listeden bir başvuru seçin.</p>
            </div>
          ) : (
            <article className="biz-card padmin-detail-card">
              <header className="padmin-detail-head">
                <div className="padmin-detail-head-copy">
                  <h2 className="padmin-detail-title">{selected.brand_name}</h2>
                  <p className="padmin-detail-sub">
                    <span
                      className={`biz-status biz-status--${selected.status}`}
                      title={applicationStatusLabel(selected.status)}
                    >
                      {applicationStatusLabel(selected.status)}
                    </span>
                    <span className="biz-muted">{formatPlatformDate(selected.created_at)}</span>
                  </p>
                </div>
              </header>

              <dl className="biz-admin-meta">
                <div>
                  <dt>Yetkili kişi</dt>
                  <dd>{selected.contact_name}</dd>
                </div>
                <div>
                  <dt>Kurumsal e-posta</dt>
                  <dd className="biz-admin-break">{selected.corporate_email}</dd>
                </div>
                <div>
                  <dt>Web sitesi</dt>
                  <dd className="biz-admin-break">{selected.website || '—'}</dd>
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
                <form className="biz-form biz-gate-form padmin-approve-form" onSubmit={(e) => void approve(e)}>
                  <h3 className="biz-section-title">Onayla ve Business aç</h3>
                  <p className="biz-section-lead">
                    Onay Organization, Business profili ve başvuru sahibine owner üyeliği oluşturur.
                  </p>
                  <label>
                    Benzersiz slug
                    <input
                      name="slug"
                      required
                      minLength={2}
                      maxLength={64}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      disabled={busy}
                    />
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

              <div className="biz-admin-events">
                <h3 className="biz-section-title">Başvuru geçmişi</h3>
                {eventsError ? (
                  <p className="biz-muted">{eventsError}</p>
                ) : events.length === 0 ? (
                  <p className="biz-muted">Kayıtlı olay yok.</p>
                ) : (
                  <ol className="padmin-timeline">
                    {events.map((ev) => (
                      <li key={ev.id}>
                        <span className="padmin-timeline-dot" aria-hidden />
                        <div className="padmin-timeline-body">
                          <strong>{applicationActionLabel(ev.action)}</strong>
                          <span className="biz-muted">
                            {applicationStatusLabel(ev.from_status || '') || '—'} →{' '}
                            {applicationStatusLabel(ev.to_status || '') || '—'}
                          </span>
                          <time className="biz-muted">{formatPlatformDate(ev.created_at)}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          )}

          {businesses.length > 0 && onOpenBusiness ? (
            <div className="biz-card padmin-membership-card">
              <h3 className="biz-section-title">Üye olduğunuz Business hesapları</h3>
              <ul className="biz-gate-list">
                {businesses.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="biz-gate-secondary"
                      disabled={busy}
                      onClick={() => onOpenBusiness(b.id)}
                    >
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
