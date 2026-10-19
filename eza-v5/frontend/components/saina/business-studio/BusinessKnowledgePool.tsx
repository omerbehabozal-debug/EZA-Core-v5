'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Knowledge } from '@/lib/eza/businessYansi';

type SortKey = 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc';

type Props = {
  knowledge: Knowledge[];
  canEdit: boolean;
  busy: boolean;
  onSave: (payload: {
    title: string;
    category: string;
    content: string;
    source: string;
    publicAllowed: boolean;
    itemId?: string;
  }) => Promise<void>;
  onDelete: (row: Knowledge) => Promise<void>;
  onUiStateChange?: (state: { formOpen: boolean; dirty: boolean }) => void;
};

function fields(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function timestamp(row: Knowledge): number {
  const raw = row.updated_at || row.created_at || '';
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function createdTimestamp(row: Knowledge): number {
  const t = Date.parse(row.created_at || '');
  return Number.isFinite(t) ? t : timestamp(row);
}

function formatDate(row: Knowledge): string {
  const raw = row.updated_at || row.created_at;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function summary(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 137)}…`;
}

export default function BusinessKnowledgePool({
  knowledge,
  canEdit,
  busy,
  onSave,
  onDelete,
  onUiStateChange,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [editRow, setEditRow] = useState<Knowledge | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Knowledge | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortKey>('updated_desc');

  useEffect(() => {
    onUiStateChange?.({ formOpen, dirty });
  }, [formOpen, dirty, onUiStateChange]);

  const active = useMemo(() => knowledge.filter((k) => k.status !== 'archived'), [knowledge]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of active) {
      const c = (row.category || '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [active]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    let list = active.filter((row) => {
      if (category !== 'all' && (row.category || '').trim() !== category) return false;
      if (!q) return true;
      const hay = `${row.title} ${row.category} ${row.content} ${row.source}`.toLocaleLowerCase('tr');
      return hay.includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === 'updated_asc') return timestamp(a) - timestamp(b);
      if (sort === 'created_desc') return createdTimestamp(b) - createdTimestamp(a);
      if (sort === 'created_asc') return createdTimestamp(a) - createdTimestamp(b);
      return timestamp(b) - timestamp(a);
    });
    return list;
  }, [active, query, category, sort]);

  const detail = detailId ? active.find((k) => k.id === detailId) || null : null;

  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm('Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?');
  }

  function resetFormState() {
    setEditRow(null);
    setFormOpen(false);
    setDirty(false);
    setFormKey((k) => k + 1);
  }

  function closeForm() {
    if (!confirmDiscard()) return;
    resetFormState();
  }

  function openNew() {
    if (!confirmDiscard()) return;
    setEditRow(null);
    setDetailId(null);
    setDirty(false);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(row: Knowledge) {
    if (formOpen && editRow?.id === row.id && !dirty) return;
    if (!confirmDiscard()) return;
    setEditRow(row);
    setDetailId(row.id);
    setDirty(false);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saving) return;
    const data = fields(event.currentTarget);
    setSaving(true);
    try {
      await onSave({
        title: String(data.title || ''),
        category: String(data.category || ''),
        content: String(data.content || ''),
        source: String(data.source || ''),
        publicAllowed: data.publicAllowed === 'on',
        ...(editRow ? { itemId: editRow.item_id } : {}),
      });
      resetFormState();
    } catch {
      // Parent surfaces the error; keep form values and dirty state.
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || busy) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
      if (detailId === deleteTarget.id) setDetailId(null);
      if (editRow?.id === deleteTarget.id) resetFormState();
      setDeleteTarget(null);
    } catch {
      // Parent surfaces the error; keep the confirm dialog open.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="biz-knowledge-workspace" data-testid="biz-knowledge-workspace">
      <header className="biz-knowledge-head">
        <div className="biz-knowledge-head-copy">
          <h2 className="biz-section-title">Bilgi Havuzu</h2>
          <p className="biz-section-lead">
            Marka bilgilerini kaydedin ve güncel tutun. Bu kayıt Yansı yayını oluşturmaz; Stüdyo ve bilgi motoru,
            kullanıcıya açıklanmasına izin verilen kayıtlardan yararlanır.
          </p>
        </div>
        {canEdit ? (
          formOpen ? (
            <button
              type="button"
              className="biz-knowledge-secondary"
              data-testid="biz-knowledge-back-list"
              onClick={closeForm}
            >
              Listeye dön
            </button>
          ) : (
            <button
              type="button"
              className="biz-btn-primary biz-knowledge-new"
              data-testid="biz-knowledge-new"
              onClick={openNew}
            >
              + Yeni bilgi
            </button>
          )
        ) : null}
      </header>

      {canEdit && formOpen ? (
        <form
          className="biz-form biz-knowledge-form"
          key={`knowledge-form-${formKey}`}
          data-testid="biz-knowledge-form"
          data-mode={editRow ? 'edit' : 'create'}
          onInput={() => setDirty(true)}
          onChange={() => setDirty(true)}
          onSubmit={(e) => void handleSave(e)}
        >
          <h3>{editRow ? 'Bilgiyi güncelle' : 'Yeni bilgi'}</h3>
          <label>
            Başlık
            <input
              name="title"
              aria-label="Bilgi başlığı"
              placeholder="Başlık"
              maxLength={160}
              defaultValue={editRow?.title || ''}
              required
              disabled={busy || saving}
            />
          </label>
          <label>
            Kategori
            <input
              name="category"
              placeholder="Kategori"
              defaultValue={editRow?.category || ''}
              disabled={busy || saving}
            />
          </label>
          <label>
            İçerik
            <textarea
              name="content"
              aria-label="Bilgi içeriği"
              placeholder="Marka bilgisi"
              maxLength={12000}
              defaultValue={editRow?.content || ''}
              required
              disabled={busy || saving}
            />
          </label>
          <label>
            Kaynak
            <input
              name="source"
              placeholder="Kaynak bağlantısı veya açıklaması"
              defaultValue={editRow?.source || ''}
              required
              disabled={busy || saving}
            />
          </label>
          <label className="biz-check">
            <input
              type="checkbox"
              name="publicAllowed"
              defaultChecked={editRow ? editRow.public_allowed : true}
              disabled={busy || saving}
            />
            Kullanıcılara açıklanmasına izin ver
          </label>
          <div className="biz-actions">
            <button
              type="submit"
              className="biz-btn-primary"
              data-testid="biz-knowledge-save"
              disabled={busy || saving}
            >
              {saving ? 'Kaydediliyor…' : editRow ? 'Güncelle' : 'Bilgiyi kaydet'}
            </button>
            <button type="button" data-testid="biz-knowledge-cancel" onClick={closeForm} disabled={saving}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      {!formOpen ? (
        <>
          <div className="biz-knowledge-toolbar" data-testid="biz-knowledge-toolbar">
            <label className="biz-knowledge-search">
              <span className="biz-sr-only">Bilgilerde ara</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Bilgilerde ara"
                data-testid="biz-knowledge-search"
              />
            </label>
            <label>
              <span className="biz-sr-only">Kategori</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="biz-knowledge-category"
              >
                <option value="all">Tüm kategoriler</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="biz-sr-only">Sıralama</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                data-testid="biz-knowledge-sort"
              >
                <option value="updated_desc">Son güncelleme (yeni → eski)</option>
                <option value="updated_asc">Son güncelleme (eski → yeni)</option>
                <option value="created_desc">Eklenme (yeni → eski)</option>
                <option value="created_asc">Eklenme (eski → yeni)</option>
              </select>
            </label>
            <p className="biz-knowledge-count" data-testid="biz-knowledge-count">
              {rows.length} bilgi
            </p>
          </div>

          <div className="biz-knowledge-table-wrap" data-testid="biz-knowledge-list">
            {!rows.length ? (
              <p className="biz-empty" data-testid="biz-knowledge-empty">
                {active.length ? 'Filtreyle eşleşen kayıt yok.' : 'Henüz bilgi kaydı yok.'}
                {canEdit && !active.length ? ' “+ Yeni bilgi” ile ilk kaydı ekleyin.' : ''}
              </p>
            ) : (
              <table className="biz-knowledge-table">
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Kategori</th>
                    <th>Özet</th>
                    <th>Gizlilik</th>
                    <th>Son güncelleme</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      data-testid={`biz-knowledge-card-${row.id}`}
                      className={detailId === row.id ? 'is-selected' : undefined}
                    >
                      <td>
                        <button
                          type="button"
                          className="biz-knowledge-title-btn"
                          data-testid={`biz-knowledge-open-${row.id}`}
                          onClick={() => setDetailId((cur) => (cur === row.id ? null : row.id))}
                        >
                          {row.title}
                        </button>
                      </td>
                      <td>
                        <span className="biz-knowledge-cat">{row.category || 'genel'}</span>
                      </td>
                      <td>
                        <p className="biz-knowledge-summary">{summary(row.content)}</p>
                      </td>
                      <td>
                        <span className={`biz-chip${row.public_allowed ? ' biz-chip--gold' : ''}`}>
                          {row.public_allowed ? 'Kullanıcılara açık' : 'Kapalı'}
                        </span>
                      </td>
                      <td className="biz-knowledge-date">{formatDate(row)}</td>
                      <td>
                        <div className="biz-knowledge-row-actions">
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                data-testid={`biz-knowledge-edit-${row.id}`}
                                onClick={() => openEdit(row)}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                className="biz-knowledge-danger"
                                data-testid={`biz-knowledge-delete-${row.id}`}
                                onClick={() => setDeleteTarget(row)}
                              >
                                Sil
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              data-testid={`biz-knowledge-view-${row.id}`}
                              onClick={() => setDetailId(row.id)}
                            >
                              Görüntüle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {detail ? (
            <aside className="biz-knowledge-detail" data-testid="biz-knowledge-detail">
              <div className="biz-knowledge-detail-head">
                <h3>{detail.title}</h3>
                <button type="button" onClick={() => setDetailId(null)}>
                  Kapat
                </button>
              </div>
              <p className="biz-card-meta">
                {detail.category || 'genel'} · sürüm {detail.version} ·{' '}
                {detail.public_allowed ? 'Kullanıcılara açık' : 'Kapalı'}
              </p>
              <p className="biz-copy biz-knowledge-detail-body">{detail.content}</p>
              <small>Kaynak: {detail.source}</small>
              {canEdit ? (
                <div className="biz-actions">
                  <button type="button" className="biz-btn-primary" onClick={() => openEdit(detail)}>
                    Düzenle
                  </button>
                </div>
              ) : null}
            </aside>
          ) : null}
        </>
      ) : null}

      {deleteTarget ? (
        <div className="biz-knowledge-modal" role="dialog" aria-modal="true" data-testid="biz-knowledge-delete-dialog">
          <div className="biz-knowledge-modal-card">
            <h3>Bu bilgiyi silmek istiyor musunuz?</h3>
            <p className="biz-section-lead">{deleteTarget.title}</p>
            <div className="biz-actions">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Vazgeç
              </button>
              <button
                type="button"
                className="biz-knowledge-danger-solid"
                data-testid="biz-knowledge-delete-confirm"
                disabled={deleting || busy}
                onClick={() => void confirmDelete()}
              >
                {deleting ? 'Siliniyor…' : 'Bilgiyi sil'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
