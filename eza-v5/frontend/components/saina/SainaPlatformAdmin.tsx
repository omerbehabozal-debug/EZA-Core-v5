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
import { resolveAuthUserDisplayName } from '@/lib/eza/sainaIdentity';
import SainaAuthAccountMark from '@/components/saina/SainaAuthAccountMark';
import {
  SAINA_BUSINESS_ROUTE,
  SAINA_DISCOVER_ROUTE,
  SAINA_PLATFORM_ADMIN_LOGIN_ROUTE,
} from '@/lib/eza/sainaRoutes';
import {
  applicationStatusLabel,
  businessStatusLabel,
  formatPlatformDate,
  formatPlatformDateShort,
  systemFeatureLabel,
} from '@/lib/eza/platformAdminUi';

const NAV = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'applications', label: 'Marka Başvuruları' },
  { id: 'brands', label: 'Markalar' },
  { id: 'users', label: 'Kullanıcılar' },
  { id: 'publications', label: 'Yayın Denetimi' },
  { id: 'system', label: 'Sistem' },
] as const;

type Section = (typeof NAV)[number]['id'];

const FEATURE_ORDER = [
  'brand_applications',
  'knowledge_pool',
  'yansi_studio',
  'publications',
  'verification',
] as const;

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
  const [loadingCore, setLoadingCore] = useState(true);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [applications, setApplications] = useState<BrandApplication[]>([]);
  const [memberships, setMemberships] = useState<Business[]>([]);
  const [brands, setBrands] = useState<PlatformBusinessRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [brandDetail, setBrandDetail] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [usersSearched, setUsersSearched] = useState(false);
  const [publications, setPublications] = useState<PlatformPublicationRow[]>([]);
  const [pubsLoading, setPubsLoading] = useState(false);
  const [system, setSystem] = useState<PlatformSystemStatus | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  const displayName = resolveAuthUserDisplayName(user);
  const sectionTitle = NAV.find((n) => n.id === section)?.label || 'Platform Yönetimi';

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
      setDenied(false);
      setLoadingCore(false);
      return;
    }
    setUnavailable('');
    setLoadingCore(true);
    loadCore()
      .catch((e) => {
        if (isBusinessApiError(e) && e.kind === 'unavailable') {
          setUnavailable(e.message);
          return;
        }
        if (isBusinessApiError(e) && (e.kind === 'forbidden' || e.status === 403)) {
          setDenied(true);
          return;
        }
        setError(e instanceof Error ? e.message : 'Platform yönetimi yüklenemedi.');
      })
      .finally(() => setLoadingCore(false));
  }, [isAuthReady, isAuthenticated, user?.user_id]);

  useEffect(() => {
    if (denied || unavailable || !isAuthenticated) return;
    if (section === 'brands') {
      setBrandsLoading(true);
      api<{ items: PlatformBusinessRow[] }>('/admin/businesses')
        .then((data) => setBrands(data.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : 'Markalar yüklenemedi.'))
        .finally(() => setBrandsLoading(false));
    }
    if (section === 'publications') {
      setPubsLoading(true);
      api<{ items: PlatformPublicationRow[] }>('/admin/publications')
        .then((data) => setPublications(data.items || []))
        .catch((e) => setError(e instanceof Error ? e.message : 'Yayınlar yüklenemedi.'))
        .finally(() => setPubsLoading(false));
    }
    if (section === 'system') {
      setSystemLoading(true);
      api<PlatformSystemStatus>('/admin/system')
        .then((data) => setSystem(data))
        .catch((e) => setError(e instanceof Error ? e.message : 'Sistem durumu yüklenemedi.'))
        .finally(() => setSystemLoading(false));
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
      setUsersSearched(true);
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

  async function grantPlatformAdmin(targetUserId: string, label: string) {
    const ok = window.confirm(
      `"${label}" kullanıcısına BiligN platform admin yetkisi verilsin mi?\n\nBu işlem geri alınabilir; kendi hesabınıza yetki veremezsiniz.`
    );
    if (!ok) return;
    await run(async () => {
      await api('/admin/capabilities/grant', 'POST', {
        userId: targetUserId,
        capability: 'bilign.platform_admin',
      });
      setNotice('BiligN platform admin yetkisi verildi.');
    });
  }

  async function revokePlatformAdmin(targetUserId: string, label: string) {
    const ok = window.confirm(
      `"${label}" kullanıcısının BiligN platform admin yetkisi kaldırılsın mı?\n\nSonraki admin API istekleri 403 döner.`
    );
    if (!ok) return;
    await run(async () => {
      await api('/admin/capabilities/revoke', 'POST', {
        userId: targetUserId,
        capability: 'bilign.platform_admin',
      });
      setNotice('BiligN platform admin yetkisi kaldırıldı.');
    });
  }

  function goSection(id: Section) {
    setSection(id);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      router.replace(SAINA_PLATFORM_ADMIN_LOGIN_ROUTE);
    }
  }, [isAuthReady, isAuthenticated, router]);

  if (!isAuthReady || !isAuthenticated) {
    return (
      <main className="biz-panel padmin-panel">
        <div className="padmin-shell-loading">
          <p className="padmin-page-lead">Giriş ekranına yönlendiriliyorsunuz…</p>
        </div>
      </main>
    );
  }

  if (loadingCore && !denied && !unavailable) {
    return (
      <main className="biz-panel padmin-panel">
        <div className="padmin-shell-loading">
          <p className="padmin-page-lead">Platform yönetimi yükleniyor…</p>
        </div>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="biz-panel padmin-panel">
        <section className="biz-gate-hero padmin-denied">
          <p className="biz-brand-kicker">BiligN Platform</p>
          <h1 className="biz-gate-title">Platform Yönetimi</h1>
          <p className="biz-gate-lead">
            Bu alan yalnızca aktif bilign.platform_admin yetkisine sahip kullanıcılara açıktır. EZA rolü yeterli
            değildir.
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
        <section className="biz-gate-hero padmin-denied">
          <h1 className="biz-gate-title">Platform Yönetimi</h1>
          <p className="biz-gate-lead" role="alert">
            {unavailable}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="biz-panel padmin-panel">
      <div className={`padmin-shell${navOpen ? ' is-nav-open' : ''}`}>
        {navOpen ? (
          <button
            type="button"
            className="padmin-nav-backdrop"
            aria-label="Menüyü kapat"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <aside className="padmin-sidebar" aria-label="Platform menüsü">
          <div className="padmin-sidebar-brand">
            <div className="biz-brand-mark" aria-hidden>
              B
            </div>
            <div>
              <p className="biz-brand-kicker">BiligN</p>
              <p className="padmin-sidebar-title">Platform Yönetimi</p>
            </div>
          </div>
          <nav className="padmin-nav" aria-label="Platform yönetimi">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`padmin-nav-item${section === item.id ? ' is-active' : ''}`}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => goSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="padmin-sidebar-footer">
            <Link href={SAINA_BUSINESS_ROUTE} className="padmin-side-link">
              Business paneli
            </Link>
            <Link href={SAINA_DISCOVER_ROUTE} className="padmin-side-link">
              BiligN&apos;e dön
            </Link>
          </div>
        </aside>

        <div className="padmin-main">
          <header className="padmin-topbar">
            <div className="padmin-topbar-left">
              <button
                type="button"
                className="padmin-nav-toggle"
                aria-expanded={navOpen}
                aria-controls="padmin-sidebar"
                onClick={() => setNavOpen((v) => !v)}
              >
                Menü
              </button>
              <div>
                <p className="padmin-top-kicker">Yönetim konsolu</p>
                <h1 className="padmin-top-title">{sectionTitle}</h1>
              </div>
            </div>
            <div className="padmin-account">
              <SainaAuthAccountMark user={user} />
              <div className="padmin-account-copy">
                <strong>{displayName}</strong>
                <span className="biz-muted biz-admin-ellipsis">{user?.email}</span>
              </div>
              <button type="button" className="biz-gate-secondary" onClick={() => logout()}>
                Çıkış
              </button>
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

          <div className="padmin-content">
            {section === 'overview' && overview ? (
              <section aria-label="Genel bakış" className="padmin-section">
                <p className="padmin-page-lead">
                  Operasyonel Business durumu — yalnızca gerçek backend sayaçları.
                </p>
                <div className="padmin-stat-grid">
                  <button type="button" className="padmin-stat" onClick={() => goSection('brands')}>
                    <span className="padmin-stat-label">Toplam marka</span>
                    <strong className="padmin-stat-value">{overview.totals.businesses}</strong>
                  </button>
                  <button type="button" className="padmin-stat" onClick={() => goSection('applications')}>
                    <span className="padmin-stat-label">Onay bekleyen başvuru</span>
                    <strong className="padmin-stat-value">{overview.totals.pending_applications}</strong>
                  </button>
                  <button type="button" className="padmin-stat" onClick={() => goSection('brands')}>
                    <span className="padmin-stat-label">Doğrulanmış marka</span>
                    <strong className="padmin-stat-value">{overview.totals.verified_businesses}</strong>
                  </button>
                  <button type="button" className="padmin-stat" onClick={() => goSection('publications')}>
                    <span className="padmin-stat-label">Aktif public yayın</span>
                    <strong className="padmin-stat-value">{overview.totals.public_publications}</strong>
                  </button>
                </div>

                <div className="padmin-split">
                  <div className="biz-card padmin-card">
                    <h2 className="biz-section-title">Son marka başvuruları</h2>
                    {(overview.recent_applications || []).length === 0 ? (
                      <p className="biz-muted">Henüz başvuru yok.</p>
                    ) : (
                      <ul className="padmin-feed">
                        {(overview.recent_applications || []).map((app) => (
                          <li key={app.id}>
                            <button type="button" className="padmin-feed-row" onClick={() => goSection('applications')}>
                              <span className="padmin-feed-main">
                                <strong className="biz-admin-ellipsis">{app.brand_name}</strong>
                                <span className="biz-muted biz-admin-ellipsis">{app.corporate_email}</span>
                              </span>
                              <span className={`biz-status biz-status--${app.status}`}>
                                {applicationStatusLabel(app.status)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="biz-card padmin-card">
                    <h2 className="biz-section-title">Son yönetim işlemleri</h2>
                    {(overview.recent_events || []).length === 0 ? (
                      <p className="biz-muted">Henüz kayıtlı işlem yok.</p>
                    ) : (
                      <ul className="padmin-feed">
                        {(overview.recent_events || []).map((ev) => (
                          <li key={ev.id} className="padmin-feed-static">
                            <strong>{ev.action}</strong>
                            <span className="biz-muted">
                              {applicationStatusLabel(ev.from_status || '') || '—'} →{' '}
                              {applicationStatusLabel(ev.to_status || '') || '—'}
                            </span>
                            <span className="biz-muted">{formatPlatformDate(ev.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
                error=""
                notice=""
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
              <section aria-label="Markalar" className="padmin-section">
                <p className="padmin-page-lead">Doğrulama ve Business panele geçiş mevcut API üzerinden yapılır.</p>
                {brandsLoading ? (
                  <p className="padmin-page-lead">Markalar yükleniyor…</p>
                ) : brands.length === 0 ? (
                  <div className="padmin-empty">
                    <strong>Marka yok</strong>
                    <p>Henüz kayıtlı Business markası bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="padmin-table-wrap">
                    <table className="padmin-table">
                      <thead>
                        <tr>
                          <th>Marka</th>
                          <th>Doğrulama</th>
                          <th>Durum</th>
                          <th>Yayın</th>
                          <th>Sahip</th>
                          <th>Detay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brands.map((b) => (
                          <tr key={b.id} className={selectedBrand === b.id ? 'is-selected' : undefined}>
                            <td>
                              <div className="padmin-cell-stack">
                                <strong className="biz-admin-ellipsis">{b.name}</strong>
                                <span className="biz-muted biz-admin-ellipsis">{b.slug}</span>
                              </div>
                            </td>
                            <td>{b.verified ? 'Doğrulandı' : 'Bekliyor'}</td>
                            <td>{businessStatusLabel(b.status)}</td>
                            <td>{b.publication_count}</td>
                            <td>
                              <span className="biz-admin-ellipsis">{b.owner_email || '—'}</span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="padmin-linkish"
                                onClick={() => setSelectedBrand(b.id)}
                              >
                                Aç
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {brandDetail ? (
                  <div className="biz-card padmin-card padmin-brand-detail">
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
                        onClick={() =>
                          router.push(`${SAINA_BUSINESS_ROUTE}?business=${encodeURIComponent(selectedBrand)}`)
                        }
                      >
                        Business paneline git
                      </button>
                    </div>
                    <p className="biz-muted">
                      Marka sohbetleri ve kişisel kullanıcı içerikleri burada gösterilmez.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {section === 'users' ? (
              <section aria-label="Kullanıcılar" className="padmin-section">
                <p className="padmin-page-lead">
                  Arama yalnızca BiligN kapsamındaki kullanıcıları döner. Kişisel sohbet ve Ayna içeriği yoktur.
                </p>
                <form className="padmin-search" onSubmit={(e) => void searchUsers(e)}>
                  <label className="padmin-search-label" htmlFor="padmin-user-q">
                    E-posta veya görünen ad
                  </label>
                  <div className="padmin-search-row">
                    <input
                      id="padmin-user-q"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      minLength={2}
                      required
                      disabled={busy}
                      placeholder="en az 2 karakter"
                    />
                    <button type="submit" disabled={busy || userQuery.trim().length < 2}>
                      Ara
                    </button>
                  </div>
                </form>

                {!usersSearched ? (
                  <div className="padmin-empty">
                    <strong>Arama yapın</strong>
                    <p>BiligN ile ilişkili kullanıcıları bulmak için e-posta veya görünen ad girin.</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="padmin-empty">
                    <strong>Sonuç yok</strong>
                    <p>Aramanızla eşleşen kullanıcı bulunamadı.</p>
                  </div>
                ) : (
                  <div className="padmin-table-wrap">
                    <table className="padmin-table">
                      <thead>
                        <tr>
                          <th>Kullanıcı</th>
                          <th>Durum</th>
                          <th>Marka üyelikleri</th>
                          <th>Platform admin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const isSelf = u.user_id === user?.user_id;
                          const label = u.public_display_name || u.email;
                          return (
                            <tr key={u.user_id}>
                              <td>
                                <div className="padmin-cell-stack">
                                  <strong className="biz-admin-ellipsis">
                                    {u.public_display_name || u.email}
                                  </strong>
                                  <span className="biz-muted biz-admin-ellipsis">{u.email}</span>
                                </div>
                              </td>
                              <td>{u.is_active ? 'Aktif' : 'Pasif'}</td>
                              <td>
                                {u.memberships.length === 0 ? (
                                  <span className="biz-muted">—</span>
                                ) : (
                                  <ul className="padmin-mini-list">
                                    {u.memberships.map((m) => (
                                      <li key={`${m.business_id}-${m.role}`}>
                                        {m.business_name} · {m.role}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td>
                                {isSelf ? (
                                  <span className="biz-muted">Kendi hesabınız</span>
                                ) : (
                                  <div className="padmin-inline-actions">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void grantPlatformAdmin(u.user_id, label)}
                                    >
                                      Yetki ver
                                    </button>
                                    <button
                                      type="button"
                                      className="biz-gate-secondary"
                                      disabled={busy}
                                      onClick={() => void revokePlatformAdmin(u.user_id, label)}
                                    >
                                      Kaldır
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {section === 'publications' ? (
              <section aria-label="Yayın denetimi" className="padmin-section">
                <p className="padmin-page-lead">
                  Listeleme gerçek yayın kayıtlarından gelir. Bu aşamada platform-genel yayından kaldırma yoktur.
                </p>
                {pubsLoading ? (
                  <p className="padmin-page-lead">Yayınlar yükleniyor…</p>
                ) : publications.length === 0 ? (
                  <div className="padmin-empty">
                    <strong>Yayın yok</strong>
                    <p>Aktif public yayın kaydı bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="padmin-table-wrap">
                    <table className="padmin-table">
                      <thead>
                        <tr>
                          <th>Yayın</th>
                          <th>Marka</th>
                          <th>Görünürlük</th>
                          <th>Sürüm</th>
                          <th>Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publications.map((p) => (
                          <tr key={`${p.slug}:${p.journey_version}`}>
                            <td>
                              <strong className="biz-admin-ellipsis">{p.slug}</strong>
                            </td>
                            <td>
                              <span className="biz-admin-ellipsis">{p.business_name}</span>
                            </td>
                            <td>{p.visibility}</td>
                            <td>{p.journey_version}</td>
                            <td>{formatPlatformDateShort(p.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {section === 'system' ? (
              <section aria-label="Sistem" className="padmin-section">
                <p className="padmin-page-lead">
                  Teknik durum özeti. Secret, token veya bağlantı bilgisi gösterilmez.
                </p>
                {systemLoading || !system ? (
                  <p className="padmin-page-lead">Sistem durumu yükleniyor…</p>
                ) : (
                  <>
                    <div className="padmin-system-grid">
                      <div className="padmin-system-card">
                        <span className="padmin-stat-label">Business servisi</span>
                        <strong>{system.business_enabled ? 'Etkin' : 'Kapalı'}</strong>
                      </div>
                      <div className="padmin-system-card">
                        <span className="padmin-stat-label">Bekleyen başvurular</span>
                        <strong>{system.pending_applications}</strong>
                      </div>
                      {FEATURE_ORDER.map((key) => (
                        <div key={key} className="padmin-system-card">
                          <span className="padmin-stat-label">{systemFeatureLabel(key)}</span>
                          <strong>{system.features?.[key] ? 'Açık' : 'Kapalı'}</strong>
                        </div>
                      ))}
                      {Object.keys(system.features || {})
                        .filter((k) => !(FEATURE_ORDER as readonly string[]).includes(k))
                        .map((key) => (
                          <div key={key} className="padmin-system-card">
                            <span className="padmin-stat-label">{systemFeatureLabel(key)}</span>
                            <strong>{system.features[key] ? 'Açık' : 'Kapalı'}</strong>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
