"use client";

import { useEffect, useState, useRef, type FormEvent } from 'react';
import {
  businessRequest as api,
  isBusinessApiError,
  type Business,
  type Knowledge,
  type Draft,
  type Publication,
  type BrandApplication,
} from '@/lib/eza/businessYansi';
import { useAuth } from '@/context/AuthContext';
import SainaBusinessGate from '@/components/saina/SainaBusinessGate';
import { resolveAuthUserDisplayName } from '@/lib/eza/sainaIdentity';
import { SAINA_PLATFORM_ADMIN_ROUTE } from '@/lib/eza/sainaRoutes';
import SainaAuthAccountMark from '@/components/saina/SainaAuthAccountMark';
import BusinessYansiStudio from '@/components/saina/business-studio/BusinessYansiStudio';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const tabs = ['Genel Bakış', 'Bilgi Havuzu', 'Yansı Stüdyosu', 'Yayınlar', 'Ayarlar'] as const;
const LOGIN_MSG = 'Business yönetimi için giriş yapmalısın.';

type CatalogState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'blocked';

function fields(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function statusClass(status: string) {
  return `biz-status biz-status--${status}`;
}

function BrandMark({ name, logoUrl, size = 'nav' }: { name: string; logoUrl?: string | null; size?: 'nav' | 'hero' }) {
  const cls = size === 'hero' ? 'biz-overview-logo' : 'biz-brand-mark';
  if (logoUrl) {
    return (
      <div className={cls} aria-hidden>
        <img src={logoUrl} alt="" />
      </div>
    );
  }
  return (
    <div className={cls} aria-hidden>
      {(name.trim()[0] || 'B').toUpperCase()}
    </div>
  );
}

export default function SainaBusinessManager() {
  const { isAuthenticated, isAuthReady, user, logout } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Business[]>([]);
  const [applications, setApplications] = useState<BrandApplication[]>([]);
  const [selected, setSelected] = useState('');
  const [picked, setPicked] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState('viewer');
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>('Genel Bakış');
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /** Catalog load is separate from brand membership — never treat API-down as no-access. */
  const [catalogState, setCatalogState] = useState<CatalogState>('idle');
  const [serviceMessage, setServiceMessage] = useState('');
  const [editKnowledge, setEditKnowledge] = useState<Knowledge | null>(null);
  const [knowledgeFormOpen, setKnowledgeFormOpen] = useState(false);
  const [knowledgeFormKey, setKnowledgeFormKey] = useState(0);
  const [knowledgeDirty, setKnowledgeDirty] = useState(false);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editorialChat, setEditorialChat] = useState('');
  const [answer, setAnswer] = useState('');
  const [engineOpen, setEngineOpen] = useState(false);
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const editor = role === 'editor' || role === 'owner';
  const publicCount = publications.filter((p) => p.visibility === 'public').length;
  const draftCount = drafts.filter((d) => d.status !== 'published').length;

  async function loadList() {
    const data = await api<{ items: Business[]; canProvision: boolean }>();
    setItems(data.items);
    setAdmin(data.canProvision);
    return data;
  }

  async function loadApplications() {
    const data = await api<{ items: BrandApplication[] }>('/applications/mine');
    setApplications(data.items);
    return data.items;
  }

  async function load(id: string) {
    const [overview, kb, studio] = await Promise.all([
      api<{ business: Business; role: string; publications: Publication[] }>(`/${id}/overview`),
      api<{ items: Knowledge[] }>(`/${id}/knowledge`),
      api<{ items: Draft[] }>(`/${id}/drafts`),
    ]);
    const memberRows =
      overview.role === 'owner'
        ? (await api<{ items: { user_id: string; role: string }[] }>(`/${id}/members`)).items
        : [];
    if (selectedRef.current !== id) return;
    setBusiness(overview.business);
    setRole(overview.role);
    setPublications(overview.publications);
    setKnowledge(kb.items);
    setDrafts(studio.items);
    setMembers(memberRows);
  }

  useEffect(() => {
    if (!isAuthReady) return;
    let active = true;
    if (!isAuthenticated) {
      setItems([]);
      setApplications([]);
      setSelected('');
      setPicked(false);
      setBusiness(null);
      setError('');
      setAdmin(false);
      setCatalogState('idle');
      setServiceMessage('');
      return;
    }
    setError('');
    setServiceMessage('');
    setCatalogState('loading');
    Promise.all([loadList(), loadApplications()])
      .then(([list]) => {
        if (!active) return;
        setCatalogState('ready');
        const rows = list.items;
        setAdmin(Boolean(list.canProvision));
        const requested = searchParams?.get('business') || '';
        if (requested && rows.some((row) => row.id === requested)) {
          setSelected(requested);
          setPicked(true);
          return;
        }
        if (rows.length === 1) {
          setSelected(rows[0].id);
          setPicked(true);
        } else {
          setSelected('');
          setPicked(false);
        }
      })
      .catch((e) => {
        if (!active) return;
        // Keep BiligN session; classify Business API failure separately from brand access.
        setItems([]);
        setApplications([]);
        setSelected('');
        setPicked(false);
        setAdmin(false);
        if (isBusinessApiError(e) && e.kind === 'unavailable') {
          setCatalogState('unavailable');
          setServiceMessage(e.message);
          setError('');
          return;
        }
        setCatalogState('blocked');
        setServiceMessage(isBusinessApiError(e) ? e.message : e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
        setError(isBusinessApiError(e) ? e.message : e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
      });
    return () => {
      active = false;
    };
  }, [isAuthReady, isAuthenticated, user?.user_id]);

  useEffect(() => {
    // Clear previous tenant data immediately so brand switches never flash foreign content.
    setBusiness(null);
    setKnowledge([]);
    setDrafts([]);
    setPublications([]);
    setMembers([]);
    setAnswer('');
    setEditorialChat('');
    setEditKnowledge(null);
    setKnowledgeFormOpen(false);
    setKnowledgeDirty(false);
    setKnowledgeFormKey((k) => k + 1);
    setEditDraft(null);
    setTab('Genel Bakış');
    if (selected) load(selected).catch((e) => setError(e.message));
  }, [selected]);

  function confirmDiscardKnowledge(): boolean {
    if (!knowledgeDirty) return true;
    return window.confirm('Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?');
  }

  function resetKnowledgeFormState() {
    setEditKnowledge(null);
    setKnowledgeFormOpen(false);
    setKnowledgeDirty(false);
    setKnowledgeFormKey((k) => k + 1);
  }

  function closeKnowledgeForm() {
    if (!confirmDiscardKnowledge()) return;
    resetKnowledgeFormState();
  }

  function openNewKnowledge() {
    if (!confirmDiscardKnowledge()) return;
    setEditKnowledge(null);
    setKnowledgeDirty(false);
    setKnowledgeFormKey((k) => k + 1);
    setKnowledgeFormOpen(true);
  }

  function openEditKnowledge(row: Knowledge) {
    if (knowledgeFormOpen && editKnowledge?.id === row.id && !knowledgeDirty) return;
    if (!confirmDiscardKnowledge()) return;
    setEditKnowledge(row);
    setKnowledgeDirty(false);
    setKnowledgeFormKey((k) => k + 1);
    setKnowledgeFormOpen(true);
  }

  function goToTab(next: (typeof tabs)[number]) {
    if (tab === 'Bilgi Havuzu' && knowledgeFormOpen && knowledgeDirty && next !== 'Bilgi Havuzu') {
      if (!confirmDiscardKnowledge()) return;
      resetKnowledgeFormState();
    }
    setTab(next);
  }

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      if (selected) await load(selected);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  }

  function submit(action: (data: Record<string, FormDataEntryValue>) => Promise<unknown>) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = fields(e.currentTarget);
      void run(() => action(data));
    };
  }

  const base = `/${selected}`;

  async function transition(kind: 'knowledge' | 'drafts', row: Knowledge | Draft, target: string) {
    await api(`${base}/${kind}/${row.id}/transition`, 'POST', { target, revision: row.revision });
  }

  function draftActions(row: Draft) {
    return (
      <div className="biz-actions">
        {editor && row.status === 'draft' && (
          <button type="button" onClick={() => void run(() => transition('drafts', row, 'review'))}>
            İncelemeye gönder
          </button>
        )}
        {editor && row.status === 'review' && (
          <button type="button" onClick={() => void run(() => transition('drafts', row, 'draft'))}>
            Taslağa geri al
          </button>
        )}
        {role === 'owner' && row.status === 'review' && (
          <button type="button" onClick={() => void run(() => transition('drafts', row, 'approved'))}>
            Onayla
          </button>
        )}
      </div>
    );
  }

  const activeKnowledge = knowledge.filter((k) => k.status !== 'archived');
  const usableKnowledgeCount = activeKnowledge.filter((k) => k.status === 'published' && k.public_allowed).length;

  if (!isAuthReady) {
    return (
      <main className="biz-panel">
        <p className="biz-section-lead" style={{ padding: 24 }}>
          Oturum kontrol ediliyor…
        </p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="biz-panel">
        <SainaBusinessGate mode="anonymous" />
      </main>
    );
  }

  const displayName = resolveAuthUserDisplayName(user);
  const accountMenu = (
    <div className="biz-account-menu">
      <button
        type="button"
        className="biz-account-trigger"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <SainaAuthAccountMark user={user} />
        <span className="biz-account-name">{displayName}</span>
      </button>
      {menuOpen ? (
        <div className="biz-account-dropdown" role="menu">
          <p className="biz-account-email">{user?.email}</p>
          {admin ? (
            <Link
              role="menuitem"
              href={SAINA_PLATFORM_ADMIN_ROUTE}
              className="biz-account-item"
              onClick={() => setMenuOpen(false)}
            >
              Platform Yönetimi
            </Link>
          ) : null}
          <Link
            role="menuitem"
            href="/standalone/discover"
            className="biz-account-item"
            onClick={() => setMenuOpen(false)}
          >
            BiligN&apos;e geç
          </Link>
          <button
            type="button"
            role="menuitem"
            className="biz-account-item"
            onClick={() => {
              setMenuOpen(false);
              logout();
            }}
          >
            Çıkış yap
          </button>
        </div>
      ) : null}
    </div>
  );

  if (catalogState === 'loading') {
    return (
      <main className="biz-panel">
        <SainaBusinessGate mode="loading" />
      </main>
    );
  }

  if (catalogState === 'unavailable' || catalogState === 'blocked') {
    return (
      <main className="biz-panel">
        <SainaBusinessGate
          mode="unavailable"
          serviceMessage={serviceMessage || 'BiligN Business şu anda kullanıma hazırlanıyor.'}
          serviceNote={
            catalogState === 'unavailable'
              ? 'Oturumun açık. Business kullanıma açıldığında aynı BiligN hesabınla devam edebilirsin.'
              : 'BiligN oturumun korunuyor. Marka başvurusu yalnızca Business servisi yanıt verdiğinde açılır.'
          }
        />
      </main>
    );
  }

  if (catalogState !== 'ready') {
    return (
      <main className="biz-panel">
        <SainaBusinessGate mode="loading" />
      </main>
    );
  }

  // Platform admin capability must not replace Business membership. Admins without a brand
  // stay on Business onboarding (application form), same as non-admins.
  if (!picked && items.length > 1) {
    return (
      <main className="biz-panel">
        <SainaBusinessGate
          mode="pick"
          businesses={items}
          busy={busy}
          error={error}
          onSelectBusiness={(id) => {
            setSelected(id);
            setPicked(true);
          }}
        />
      </main>
    );
  }

  // Application form only after a successful Business catalog response with no memberships.
  if (!items.length) {
    return (
      <main className="biz-panel">
        <SainaBusinessGate
          mode="no-access"
          applications={applications}
          busy={busy}
          error={error === LOGIN_MSG ? '' : error}
          notice={notice}
          onSubmitApplication={async (payload) => {
            await run(async () => {
              await api('/applications', 'POST', payload);
              await loadApplications();
              setNotice('Başvurunuz alındı. Onay sonrası Business hesabınız açılır.');
            });
          }}
        />
      </main>
    );
  }

  return (
    <main className="biz-panel">
      <header className="biz-panel-header">
        <div className="biz-brand-block">
          <BrandMark name={business?.name || 'Business'} logoUrl={business?.logo_url} />
          <div className="biz-brand-copy">
            <p className="biz-brand-kicker">Business Yansı</p>
            <p className="biz-brand-title">{business?.name || 'Yönetim'}</p>
          </div>
        </div>
        <div className="biz-header-actions">
          {items.length > 1 ? (
            <>
              <label className="biz-account-label">
                Business hesabı
                <select
                  aria-label="Business hesabı"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={busy}
                >
                  {items.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="biz-gate-secondary"
                disabled={busy}
                onClick={() => {
                  setPicked(false);
                  setSelected('');
                  setBusiness(null);
                  setKnowledge([]);
                  setDrafts([]);
                  setPublications([]);
                }}
              >
                Markalar
              </button>
            </>
          ) : null}
          {admin ? (
            <Link className="biz-gate-secondary" href={SAINA_PLATFORM_ADMIN_ROUTE}>
              Platform Yönetimi
            </Link>
          ) : null}
          {accountMenu}
        </div>
      </header>

      {error && (
        <p className="biz-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="biz-notice" role="status">
          {notice}
        </p>
      )}

      <fieldset disabled={busy}>
        {business && (
          <div className="biz-body">
            <nav className="biz-nav" aria-label="Business bölümleri">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="biz-nav-btn"
                  aria-current={t === tab ? 'page' : undefined}
                  onClick={() => goToTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>

            <div className="biz-work">
              {tab === 'Genel Bakış' && (
                <section>
                  <h1 className="biz-section-title">Genel Bakış</h1>
                  <p className="biz-section-lead">Doğrulanmış marka bilgileri ve editoryal yayınlar</p>
                  <article className="biz-card">
                    <div className="biz-overview-hero">
                      <BrandMark name={business.name} logoUrl={business.logo_url} size="hero" />
                      <div>
                        <h2>{business.name}</h2>
                        <p className="biz-overview-desc">{business.description || 'Açıklama henüz eklenmedi.'}</p>
                        <div className="biz-meta-row">
                          <span className={`biz-chip${business.verified || business.official ? ' biz-chip--gold' : ''}`}>
                            {business.official
                              ? 'Resmî BiligN'
                              : business.verified
                                ? 'Doğrulanmış Business'
                                : 'Doğrulama bekliyor'}
                          </span>
                          <span className="biz-chip">{business.status}</span>
                          <span className="biz-chip">{role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="biz-stats">
                      <div className="biz-stat">
                        <span className="biz-stat-value">{publicCount}</span>
                        <span className="biz-stat-label">Yayımlanmış Yansı</span>
                      </div>
                      <div className="biz-stat">
                        <span className="biz-stat-value">{draftCount}</span>
                        <span className="biz-stat-label">Taslak / inceleme</span>
                      </div>
                      <div className="biz-stat">
                        <span className="biz-stat-value">{usableKnowledgeCount}</span>
                        <span className="biz-stat-label">Havuz kaydı</span>
                      </div>
                    </div>
                    <p className="biz-section-lead" style={{ marginTop: 16, marginBottom: 0 }}>
                      Müşteri sohbetleri bu yönetim alanında paylaşılmaz.
                    </p>
                  </article>
                </section>
              )}

              {tab === 'Bilgi Havuzu' && (
                <section className="biz-knowledge-workspace" data-testid="biz-knowledge-workspace">
                  <header className="biz-knowledge-head">
                    <div className="biz-knowledge-head-copy">
                      <h2 className="biz-section-title">Bilgi Havuzu</h2>
                      <p className="biz-section-lead">
                        Marka bilgilerini kaydedin ve güncel tutun. Bu kayıt Yansı yayını oluşturmaz; Stüdyo ve bilgi
                        motoru, kullanıcıya açıklanmasına izin verilen kayıtlardan yararlanır.
                      </p>
                    </div>
                    {editor ? (
                      knowledgeFormOpen ? (
                        <button
                          type="button"
                          className="biz-knowledge-secondary"
                          data-testid="biz-knowledge-back-list"
                          onClick={closeKnowledgeForm}
                        >
                          Listeye dön
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="biz-btn-primary biz-knowledge-new"
                          data-testid="biz-knowledge-new"
                          onClick={openNewKnowledge}
                        >
                          + Yeni bilgi
                        </button>
                      )
                    ) : null}
                  </header>

                  {editor && knowledgeFormOpen ? (
                    <form
                      className="biz-form biz-knowledge-form"
                      key={`knowledge-form-${knowledgeFormKey}`}
                      data-testid="biz-knowledge-form"
                      data-mode={editKnowledge ? 'edit' : 'create'}
                      onInput={() => setKnowledgeDirty(true)}
                      onChange={() => setKnowledgeDirty(true)}
                      onSubmit={submit(async (data) => {
                        const editing = editKnowledge;
                        await api(`${base}/knowledge`, 'POST', {
                          ...data,
                          publicAllowed: data.publicAllowed === 'on',
                          ...(editing ? { itemId: editing.item_id } : {}),
                        });
                        setEditKnowledge(null);
                        setKnowledgeFormOpen(false);
                        setKnowledgeDirty(false);
                        setKnowledgeFormKey((k) => k + 1);
                        setNotice(editing ? 'Bilgi güncellendi.' : 'Bilgi kaydedildi.');
                      })}
                    >
                      <h3>{editKnowledge ? 'Bilgiyi güncelle' : 'Yeni bilgi'}</h3>
                      <label>
                        Başlık
                        <input
                          name="title"
                          aria-label="Bilgi başlığı"
                          placeholder="Başlık"
                          maxLength={160}
                          defaultValue={editKnowledge?.title || ''}
                          required
                        />
                      </label>
                      <label>
                        Kategori
                        <input
                          name="category"
                          placeholder="Kategori"
                          defaultValue={editKnowledge?.category || ''}
                        />
                      </label>
                      <label>
                        İçerik
                        <textarea
                          name="content"
                          aria-label="Bilgi içeriği"
                          placeholder="Marka bilgisi"
                          maxLength={12000}
                          defaultValue={editKnowledge?.content || ''}
                          required
                        />
                      </label>
                      <label>
                        Kaynak
                        <input
                          name="source"
                          placeholder="Kaynak bağlantısı veya açıklaması"
                          defaultValue={editKnowledge?.source || ''}
                          required
                        />
                      </label>
                      <label className="biz-check">
                        <input
                          type="checkbox"
                          name="publicAllowed"
                          defaultChecked={editKnowledge ? editKnowledge.public_allowed : true}
                        />
                        Kullanıcılara açıklanmasına izin ver
                      </label>
                      <div className="biz-actions">
                        <button type="submit" className="biz-btn-primary" data-testid="biz-knowledge-save">
                          {editKnowledge ? 'Güncelle' : 'Bilgiyi kaydet'}
                        </button>
                        <button type="button" data-testid="biz-knowledge-cancel" onClick={closeKnowledgeForm}>
                          Vazgeç
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div
                    className={`biz-knowledge-list${knowledgeFormOpen ? ' is-dimmed' : ''}`}
                    data-testid="biz-knowledge-list"
                  >
                    {!activeKnowledge.length ? (
                      <p className="biz-empty" data-testid="biz-knowledge-empty">
                        Henüz bilgi kaydı yok.
                        {editor ? ' “+ Yeni bilgi” ile ilk kaydı ekleyin.' : ''}
                      </p>
                    ) : null}
                    {activeKnowledge.map((k) => (
                      <article
                        className="biz-card biz-knowledge-card"
                        key={k.id}
                        data-testid={`biz-knowledge-card-${k.id}`}
                      >
                        <div className="biz-card-head">
                          <h3>{k.title}</h3>
                          <span className="biz-chip">
                            {k.public_allowed ? 'Kullanıcılara açık' : 'Yalnızca marka'}
                          </span>
                        </div>
                        <p className="biz-card-meta">
                          {k.category || 'genel'} · sürüm {k.version}
                        </p>
                        <p className="biz-copy">{k.content}</p>
                        <small>{k.source}</small>
                        {editor && (
                          <div className="biz-actions">
                            <button
                              type="button"
                              data-testid={`biz-knowledge-edit-${k.id}`}
                              onClick={() => openEditKnowledge(k)}
                            >
                              Düzenle
                            </button>
                            {role === 'owner' && k.status === 'published' && (
                              <button
                                type="button"
                                onClick={() => void run(() => transition('knowledge', k, 'archived'))}
                              >
                                Arşivle
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {tab === 'Yansı Stüdyosu' && (
                <section className="biz-yansi-workspace" data-testid="biz-yansi-workspace">
                  <BusinessYansiStudio
                    key={editDraft?.id || `studio-${selected}`}
                    businessId={selected}
                    knowledge={knowledge}
                    canEdit={editor}
                    editDraft={editDraft}
                    onClearEdit={() => setEditDraft(null)}
                    onOpenKnowledgePool={() => goToTab('Bilgi Havuzu')}
                    onDraftSaved={async () => {
                      setEditDraft(null);
                      if (selected) await load(selected);
                      setNotice('Taslak kaydedildi. İncelemeye gönderme owner onayını atlamaz.');
                    }}
                  />
                  <div className="biz-yansi-workspace-block">
                    <h2 className="biz-section-title">Taslaklar</h2>
                    <p className="biz-section-lead">
                      İnceleme, onay ve yayın mevcut Business kurallarıyla ilerler. AI üretim owner onayını atlamaz.
                    </p>
                    {!drafts.length && <p className="biz-empty">Henüz Yansı taslağı yok.</p>}
                    {drafts.map((d) => (
                      <article className="biz-card" key={d.id}>
                        <div className="biz-card-head">
                          <h3>{d.title}</h3>
                          <span className={statusClass(d.status)}>{d.status}</span>
                        </div>
                        <p className="biz-card-meta">revision {d.revision}</p>
                        <details>
                          <summary>Soru-cevap önizlemesi</summary>
                          {d.steps.map((s, i) => (
                            <div key={i}>
                              <strong>
                                {i + 1}. {s.question}
                              </strong>
                              <p className="biz-copy">{s.answer}</p>
                            </div>
                          ))}
                        </details>
                        {editor && d.status === 'draft' && !d.conversation_id && (
                          <div className="biz-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEditDraft(d);
                              }}
                            >
                              Taslağı düzenle
                            </button>
                          </div>
                        )}
                        {draftActions(d)}
                        {editor && d.status === 'approved' && (
                          <div className="biz-actions">
                            <button
                              type="button"
                              onClick={() =>
                                void run(async () => {
                                  const result = await api<{ clientConversationId: string }>(
                                    `${base}/drafts/${d.id}/editorial-conversation`,
                                    'POST'
                                  );
                                  setEditorialChat(result.clientConversationId);
                                  setNotice(
                                    `Editoryal sohbet hazır: ${result.clientConversationId}. Sohbet arşivinden açıp mevcut Ayna akışıyla özel Yansı oluştur; ardından slug ile yayın onayı ver.`
                                  );
                                })
                              }
                            >
                              Mevcut Ayna akışına hazırla
                            </button>
                          </div>
                        )}
                        {role === 'owner' && d.status === 'approved' && (
                          <form
                            className="biz-form"
                            onSubmit={submit((data) =>
                              api(`${base}/drafts/${d.id}/publish`, 'POST', {
                                slug: data.slug,
                                revision: d.revision,
                              })
                            )}
                          >
                            <input name="slug" placeholder="Özel sealed Yansı slug" required />
                            <button type="submit" className="biz-btn-primary">
                              Onaylı Business Yansı&apos;yı yayımla
                            </button>
                          </form>
                        )}
                      </article>
                    ))}
                    {editorialChat && (
                      <p>
                        <a href={`/standalone?chat=${encodeURIComponent(editorialChat)}`}>
                          Ayna için editoryal sohbeti aç
                        </a>
                      </p>
                    )}
                  </div>
                  {editor && (
                    <div className="biz-engine-panel" data-testid="biz-engine-panel">
                      <button
                        type="button"
                        className="biz-engine-toggle"
                        aria-expanded={engineOpen}
                        data-testid="biz-engine-toggle"
                        onClick={() => setEngineOpen((open) => !open)}
                      >
                        <span>Bilgi motorunu test et</span>
                        <span className="biz-engine-toggle-hint" aria-hidden>
                          {engineOpen ? '−' : '+'}
                        </span>
                      </button>
                      {engineOpen ? (
                        <form
                          className="biz-form biz-engine-form"
                          data-testid="biz-engine-form"
                          onSubmit={submit(async (data) => {
                            const result = await api<{ assistant_answer: string }>(`${base}/preview-answer`, 'POST', {
                              question: data.question,
                            });
                            setAnswer(result.assistant_answer);
                          })}
                        >
                          <p className="biz-section-lead" style={{ marginBottom: 0 }}>
                            Mevcut mesaj kotası uygulanır. Bu alan Yansı oluşturma akışından bağımsızdır.
                          </p>
                          <input name="question" placeholder="Sorun" required />
                          <button type="submit">Cevabı önizle</button>
                          {answer && <p className="biz-copy">{answer}</p>}
                        </form>
                      ) : null}
                    </div>
                  )}
                </section>
              )}

              {tab === 'Yayınlar' && (
                <section>
                  <h2 className="biz-section-title">Yayınlar</h2>
                  <p className="biz-section-lead">Aktif Business Yansıları ve taslak durumu.</p>
                  <div className="biz-stats" style={{ marginBottom: 16 }}>
                    <div className="biz-stat">
                      <span className="biz-stat-value">{publicCount}</span>
                      <span className="biz-stat-label">Aktif yayın</span>
                    </div>
                    <div className="biz-stat">
                      <span className="biz-stat-value">{draftCount}</span>
                      <span className="biz-stat-label">Taslak / incelemede</span>
                    </div>
                  </div>
                  {!publications.length && <p className="biz-empty">Henüz yayımlanmış Business Yansı yok.</p>}
                  {publications.map((p) => (
                    <article className="biz-card" key={p.slug + ':' + p.journey_version}>
                      <div className="biz-card-head">
                        <h3>
                          <a href={`/m/${encodeURIComponent(p.slug)}?journeyVersion=${p.journey_version}`}>
                            {p.slug} · v{p.journey_version}
                          </a>
                        </h3>
                        <span className="biz-chip">{p.visibility || '—'}</span>
                      </div>
                      {role === 'owner' && (
                        <div className="biz-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void run(() =>
                                api(`${base}/publications/${encodeURIComponent(p.slug)}/withdraw`, 'POST')
                              )
                            }
                          >
                            Yayından kaldır
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              )}

              {tab === 'Ayarlar' && (
                <section>
                  <h2 className="biz-section-title">Ayarlar</h2>
                  <p className="biz-section-lead">Marka kimliği ve yetkilendirme.</p>
                  {role === 'owner' ? (
                    <>
                      <form
                        className="biz-form"
                        onSubmit={submit((data) => api(`${base}/settings`, 'PATCH', data))}
                      >
                        <label>
                          Marka adı
                          <input name="name" aria-label="Marka adı" defaultValue={business.name} required />
                        </label>
                        <label>
                          Açıklama
                          <input
                            name="description"
                            aria-label="Marka açıklaması"
                            defaultValue={business.description}
                          />
                        </label>
                        <label>
                          Logo URL
                          <input
                            name="logoUrl"
                            aria-label="Logo URL"
                            placeholder="https://…"
                            defaultValue={business.logo_url || ''}
                          />
                        </label>
                        <button type="submit" className="biz-btn-primary">
                          Marka kimliğini kaydet
                        </button>
                      </form>
                      <article className="biz-card">
                        <h3>Yetkililer</h3>
                        {members.map((m) => (
                          <p className="biz-card-meta" key={m.user_id}>
                            {m.user_id} · {m.role}
                            {m.role !== 'owner' && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  onClick={() => void run(() => api(`${base}/members/${m.user_id}`, 'DELETE'))}
                                >
                                  Yetkiyi kaldır
                                </button>
                              </>
                            )}
                          </p>
                        ))}
                        <form
                          className="biz-form"
                          onSubmit={submit((data) => api(`${base}/members`, 'PUT', data))}
                        >
                          <input name="userId" placeholder="Kullanıcı UUID" required />
                          <select name="role" defaultValue="viewer">
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button type="submit">Yetkiyi kaydet</button>
                        </form>
                      </article>
                    </>
                  ) : (
                    <p className="biz-empty">Kimlik ve yetki ayarları yalnız owner tarafından değiştirilebilir.</p>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </fieldset>
    </main>
  );
}
