'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  businessRequest as api,
  isBusinessApiError,
  type BrandApplication,
  type Business,
  type PlatformBusinessRow,
  type PlatformOverview,
  type PlatformPublicationRow,
  type PlatformSystemStatus,
  type PlatformUserRow,
} from '@/lib/eza/businessYansi';
import SainaBusinessAdminInbox from '@/components/saina/SainaBusinessAdminInbox';
import { resolveSainaUserDisplayName, resolveSainaUserInitial } from '@/lib/eza/sainaIdentity';
import { SAINA_BUSINESS_ROUTE, SAINA_DISCOVER_ROUTE } from '@/lib/eza/sainaRoutes';

const NAV = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'applications', label: 'Marka Başvuruları' },
  { id: 'brands', label: 'Markalar' },
  { id: 'users', label: 'Kullanıcılar' },
  { id: 'publications', label: 'Yayın Denetimi' },
  { id: 'system', label: 'Sistem' },
] as const;

type Section = (typeof NAV)[number]['id'];

export default function SainaPlatformAdmin() {
  const router = useRouter();
  const { isAuthenticated, isAuthReady, user, logout } = useAuth();
  const [section, setSection] = useState<Section>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [denied, setDenied] = useState(false);
  const [unavailable, setUnavailable] = useState('');
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [applications, setApplications] = useState<BrandApplication[]>([]);
  const [memberships, setMemberships] = useState<Business[]>([]);
  const [brands, setBrands] = useState<PlatformBusinessRow[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [brandDetail, setBrandDetail] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [publications, setPublications] = useState<PlatformPublicationRow[]>([]);
  const [system, setSystem] = useState<PlatformSystemStatus | null>(null);

  const displayName = resolveSainaUserDisplayName(user?.email, user?.full_name, user?.public_display_name);
  const initial = resolveSainaUserInitial(user?.email, user?.public_display_name, user?.full_name);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function loadCore() {
    const [ov, apps, mine] = await Promise.all([
      api<PlatformOverview>('/admin/overview'),
      api<{ items: BrandApplication[] }>('/applications'),
      api<{ items: Business[]; canProvision: boolean }>(''),
    ]);
    if (!mine.canProvision) {
      setDenied(true);
      return;
    }
    setOverview(ov);
    setApplications(apps.items || []);
    setMemberships(mine.items || []);
    setDenied(false);
  }

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      setDenied(true);
      return;
    }
    // Backend canProvision / platform_admin is authoritative (not JWT role=admin).
    setUnavailable('');
    loadCore().catch((e) => {
      if (isBusinessApiError(e) && e.kind === 'unavailable') {
        setUnavailable(e.message);
        return;
      }
      if (isBusinessApiError(e) && (e.kind === 'forbidden' || e.status === 403)) {
        setDenied(true);
        return;
      }
      setError(e instanceof Error ? e.message : 'Platform yönetimi yüklenemedi.');
    });
  }, [isAuthReady, isAuthenticated, user?.user_id]);

  useEffect(() => {
    if (denied || unavailable || !isAuthenticated) return;
    if (section === 'brands') {
      api<{ items: PlatformBusinessRow[] }>('/admin/businesses')
        .then((data) => setBrands(data.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : 'Markalar yüklenemedi.'));
    }
    if (section === 'publications') {
      api<{ items: PlatformPublicationRow[] }>('/admin/publications')
        .then((data) => setPublications(data.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : 'Yayınlar yüklenemedi.'));
    }
    if (section === 'system') {
      api<PlatformSystemStatus>('/admin/system')
        .then((data) => setSystem(data))
        .catch((e) => setError(e instanceof Error ? e.message : 'Sistem durumu yüklenemedi.'));
    }
  }, [section, denied, unavailable, isAuthenticated]);

  useEffect(() => {
    if (!selectedBrand) {
      setBrandDetail(null);
      return;
    }
    api<Record<string, unknown>>(`/admin/businesses/${selectedBrand}`)
      .then((data) => setBrandDetail(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Marka detayı yüklenemedi.'));
  }, [selectedBrand]);

  async function searchUsers(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const data = await api<{ items: PlatformUserRow[] }>(
        `/admin/users?q=${encodeURIComponent(userQuery.trim())}&limit=30`
      );
      setUsers(data.items || []);
    });
  }

  async function setVerification(businessId: string, verified: boolean) {
    await run(async () => {
      await api(`/${businessId}/verification`, 'PATCH', {
        verified,
        official: false,
        status: 'active',
      });
      setNotice(verified ? 'Marka doğrulandı.' : 'Doğrulama kaldırıldı.');
      const data = await api<{ items: PlatformBusinessRow[] }>('/admin/businesses');
      setBrands(data.items || []);
      if (selectedBrand === businessId) {
        setBrandDetail(await api(`/admin/businesses/${businessId}`));
      }
    });
  }

  if (!isAuthReady) {
    return (
      <main className="biz-panel padmin-panel">
        <p className="biz-section-lead" style={{ padding: 24 }}>
          Oturum kontrol ediliyor…
        </p>
      </main>
    );
  }

  if (!isAuthenticated || denied) {
    return (
      <main className="biz-panel padmin-panel">
        <section className="biz-gate-hero">
          <h1 className="biz-gate-title">Platform Yönetimi</h1>
          <p className="biz-gate-lead">
            Bu alan yalnızca backend tarafından doğrulanan platform yöneticilerine açıktır.
          </p>
          <div className="biz-welcome-actions">
            <Link className="biz-welcome-secondary" href={SAINA_DISCOVER_ROUTE}>
              BiligN&apos;e dön
            </Link>
            <Link className="biz-welcome-primary" href={SAINA_BUSINESS_ROUTE}>
              Business Yönetimi
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (unavailable) {
    return (
      <main className="biz-panel padmin-panel">
        <section className="biz-gate-hero">
          <h1 className="biz-gate-title">Platform Yönetimi</h1>
          <p className="biz-gate-lead" role="alert">
            {unavailable}
          </p>
        </section>
      </main>
    );
  }

  const accountMenu = (
    <div className="padmin-account">
      <span className="biz-account-avatar" aria-hidden>
        {initial}
      </span>
      <div className="padmin-account-copy">
        <strong>{displayName}</strong>
        <span className="biz-muted">{user?.email}</span>
      </div>
      <Link className="biz-gate-secondary" href={SAINA_BUSINESS_ROUTE}>
        Business
      </Link>
      <Link className="biz-gate-secondary" href={SAINA_DISCOVER_ROUTE}>
        BiligN
      </Link>
      <button type="button" className="biz-gate-secondary" onClick={() => logout()}>
        Çıkış
      </button>
    </div>
  );

  return (
    <main className="biz-panel padmin-panel">
      <header className="biz-panel-header padmin-header">
        <div className="biz-brand-block">
          <button
            type="button"
            className="padmin-nav-toggle"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            Menü
          </button>
          <div className="biz-brand-mark" aria-hidden>
            P
          </div>
          <div className="biz-brand-copy">
            <p className="biz-brand-kicker">BiligN Platform</p>
            <p className="biz-brand-title">Yönetim</p>
          </div>
        </div>
        <div className="biz-header-actions">{accountMenu}</div>
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

      <div className={`padmin-layout${navOpen ? ' is-nav-open' : ''}`}>
        <nav className="padmin-nav" aria-label="Platform yönetimi">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`padmin-nav-item${section === item.id ? ' is-active' : ''}`}
              onClick={() => {
                setSection(item.id);
                setNavOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="padmin-content">
          {section === 'overview' && overview ? (
            <section aria-label="Genel bakış">
              <h1 className="biz-gate-title">Genel Bakış</h1>
              <p className="biz-gate-lead">Operasyonel Business durumu — yalnızca gerçek backend sayaçları.</p>
              <div className="padmin-stat-grid">
                <button type="button" className="padmin-stat" onClick={() => setSection('brands')}>
                  <strong>{overview.totals.businesses}</strong>
                  <span>Toplam marka</span>
                </button>
                <button type="button" className="padmin-stat" onClick={() => setSection('applications')}>
                  <strong>{overview.totals.pending_applications}</strong>
                  <span>Onay bekleyen başvuru</span>
                </button>
                <button type="button" className="padmin-stat" onClick={() => setSection('brands')}>
                  <strong>{overview.totals.verified_businesses}</strong>
                  <span>Doğrulanmış marka</span>
                </button>
                <button type="button" className="padmin-stat" onClick={() => setSection('publications')}>
                  <strong>{overview.totals.public_publications}</strong>
                  <span>Aktif public yayın</span>
                </button>
              </div>

              <div className="padmin-split">
                <div className="biz-card">
                  <h2 className="biz-section-title">Son marka başvuruları</h2>
                  <ul className="padmin-list">
                    {(overview.recent_applications || []).map((app) => (
                      <li key={app.id}>
                        <button type="button" onClick={() => setSection('applications')}>
                          <strong>{app.brand_name}</strong>
                          <span className="biz-muted">{app.status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="biz-card">
                  <h2 className="biz-section-title">Son yönetim işlemleri</h2>
                  <ul className="padmin-list">
                    {(overview.recent_events || []).map((ev) => (
                      <li key={ev.id}>
                        <strong>{ev.action}</strong>
                        <span className="biz-muted">
                          {ev.from_status || '—'} → {ev.to_status || '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {section === 'applications' ? (
            <SainaBusinessAdminInbox
              embedded
              applications={applications}
              businesses={memberships}
              busy={busy}
              error={error}
              notice={notice}
              onRefresh={async () => {
                await run(async () => {
                  await loadCore();
                });
              }}
              onTransition={async (applicationId, body) => {
                await run(async () => {
                  await api(`/applications/${applicationId}/transition`, 'POST', body);
                  await loadCore();
                  if (body.target === 'approved') {
                    setNotice('Başvuru onaylandı. Business hesabı oluşturuldu.');
                  }
                });
              }}
              onOpenBusiness={(id) => router.push(`${SAINA_BUSINESS_ROUTE}?business=${encodeURIComponent(id)}`)}
            />
          ) : null}

          {section === 'brands' ? (
            <section aria-label="Markalar">
              <h1 className="biz-gate-title">Markalar</h1>
              <div className="padmin-table-wrap">
                <table className="padmin-table">
                  <thead>
                    <tr>
                      <th>Marka</th>
                      <th>Doğrulama</th>
                      <th>Durum</th>
                      <th>Yayın</th>
                      <th>Sahip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <button type="button" className="padmin-linkish" onClick={() => setSelectedBrand(b.id)}>
                            {b.name}
                          </button>
                          <div className="biz-muted">{b.id}</div>
                        </td>
                        <td>{b.verified ? 'Doğrulandı' : 'Bekliyor'}</td>
                        <td>{b.status}</td>
                        <td>{b.publication_count}</td>
                        <td>{b.owner_email || b.owner_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {brandDetail ? (
                <div className="biz-card" style={{ marginTop: 16 }}>
                  <h2 className="biz-section-title">
                    {(brandDetail.business as { name?: string } | undefined)?.name || 'Marka detayı'}
                  </h2>
                  <p className="biz-section-lead">
                    Owner: {String(brandDetail.owner_email || '—')} · Üyeler:{' '}
                    {Array.isArray(brandDetail.members) ? brandDetail.members.length : 0}
                  </p>
                  <div className="biz-actions">
                    <button type="button" disabled={busy} onClick={() => void setVerification(selectedBrand, true)}>
                      Doğrula
                    </button>
                    <button type="button" disabled={busy} onClick={() => void setVerification(selectedBrand, false)}>
                      Doğrulamayı kaldır
                    </button>
                    <button
                      type="button"
                      className="biz-gate-secondary"
                      onClick={() => router.push(`${SAINA_BUSINESS_ROUTE}?business=${encodeURIComponent(selectedBrand)}`)}
                    >
                      Business paneline git
                    </button>
                  </div>
                  <p className="biz-muted">
                    Marka sohbetleri ve kişisel kullanıcı içerikleri burada gösterilmez. Doğrulama platform admin
                    işlemi olarak kaydedilir.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {section === 'users' ? (
            <section aria-label="Kullanıcılar">
              <h1 className="biz-gate-title">Kullanıcılar</h1>
              <p className="biz-gate-lead">
                Arama sonuçlarında kişisel sohbet veya Ayna içeriği yoktur. Platform admin atama bu sürümde
                frontend üzerinden yapılmaz.
              </p>
              <form className="biz-form padmin-search" onSubmit={(e) => void searchUsers(e)}>
                <label>
                  E-posta veya görünen ad
                  <input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    minLength={2}
                    required
                    disabled={busy}
                  />
                </label>
                <button type="submit" disabled={busy || userQuery.trim().length < 2}>
                  Ara
                </button>
              </form>
              <ul className="padmin-list">
                {users.map((u) => (
                  <li key={u.user_id} className="biz-card">
                    <strong>{u.public_display_name || u.email}</strong>
                    <div className="biz-muted">{u.email}</div>
                    <div className="biz-muted">
                      platform role: {u.role} · {u.is_active ? 'aktif' : 'pasif'}
                    </div>
                    <ul>
                      {u.memberships.map((m) => (
                        <li key={`${m.business_id}-${m.role}`}>
                          {m.business_name} — {m.role}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {section === 'publications' ? (
            <section aria-label="Yayın denetimi">
              <h1 className="biz-gate-title">Yayın Denetimi</h1>
              <p className="biz-gate-lead">
                Listeleme gerçek BusinessPublication kayıtlarından gelir. Yayından kaldırma marka owner
                endpoint&apos;i üzerinden yapılır; platform-genel moderasyon endpoint&apos;i yoktur.
              </p>
              <div className="padmin-table-wrap">
                <table className="padmin-table">
                  <thead>
                    <tr>
                      <th>Slug</th>
                      <th>Marka</th>
                      <th>Görünürlük</th>
                      <th>Sürüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publications.map((p) => (
                      <tr key={`${p.slug}:${p.journey_version}`}>
                        <td>{p.slug}</td>
                        <td>{p.business_name}</td>
                        <td>{p.visibility}</td>
                        <td>{p.journey_version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {section === 'system' && system ? (
            <section aria-label="Sistem">
              <h1 className="biz-gate-title">Sistem</h1>
              <div className="biz-card">
                <p>
                  Business servisi:{' '}
                  <strong>{system.business_enabled ? 'etkin' : 'kapalı'}</strong>
                </p>
                <p>Bekleyen başvurular: {system.pending_applications}</p>
                <ul className="padmin-list">
                  {Object.entries(system.features || {}).map(([key, value]) => (
                    <li key={key}>
                      {key}: {value ? 'açık' : 'kapalı'}
                    </li>
                  ))}
                </ul>
                <p className="biz-muted">
                  Secret, veritabanı bağlantısı veya API anahtarı bu panele gönderilmez.
                </p>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
