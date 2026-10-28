"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  businessRequest,
  fetchBrandAssetPreview,
  replaceBrandImage,
  uploadBrandImage,
  type BrandAsset,
  type Knowledge,
} from '@/lib/eza/businessYansi';

const TYPES = [
  { id: 'image', label: 'Görsel' },
  { id: 'video', label: 'Video' },
  { id: 'place', label: 'Konum' },
  { id: 'link', label: 'Bağlantı' },
] as const;

type AssetType = (typeof TYPES)[number]['id'];

const COPY: Record<string, string> = {
  asset_file_rejected: 'Görsel PNG, JPEG veya WebP olmalı.',
  asset_file_too_large: 'Görsel 2 MB sınırını aşıyor.',
  asset_file_empty: 'Görsel dosyası boş.',
  asset_url_rejected: 'Adres yalnızca güvenli bir HTTPS bağlantısı olabilir.',
  asset_coordinate_rejected: 'Enlem ve boylam geçerli bir aralıkta olmalı.',
  revision_conflict: 'Bu kayıt başka bir kayıtla değişti. Listeyi yenileyip tekrar deneyin.',
  published_knowledge_required: 'Yalnızca güncel bilgi kaydı seçilebilir.',
  archived_asset: 'Arşivlenmiş içerik düzenlenemez.',
};

function messageOf(error: unknown) {
  const text = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  return COPY[text] || text;
}

function typeLabel(type: string) {
  return TYPES.find((item) => item.id === type)?.label || type;
}

function statusLabel(asset: BrandAsset) {
  if (asset.status === 'archived') return 'Arşiv';
  return asset.public_allowed ? 'Herkese açık' : 'Marka içinde';
}

function AssetPreview({ businessId, asset }: { businessId: string; asset: BrandAsset }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (asset.asset_type !== 'image' || asset.locator_kind !== 'storage') return;
    let url = '';
    let active = true;
    fetchBrandAssetPreview(businessId, asset.id)
      .then((next) => {
        url = next;
        if (active) setSrc(next);
        else URL.revokeObjectURL(next);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.asset_type, asset.id, asset.locator_kind, asset.revision, businessId]);

  if (asset.asset_type === 'image') {
    return src ? (
      <img className="biz-asset-preview" src={src} alt="" />
    ) : (
      <div className="biz-asset-placeholder">Görsel önizlemesi</div>
    );
  }
  if (asset.asset_type === 'video' && asset.locator) {
    return <video className="biz-asset-preview" src={asset.locator} controls preload="metadata" />;
  }
  if (asset.asset_type === 'place') {
    return (
      <div className="biz-asset-placeholder">
        {asset.latitude && asset.longitude ? `${asset.latitude}, ${asset.longitude}` : 'Koordinat yok'}
      </div>
    );
  }
  if (asset.asset_type === 'link' && asset.locator) {
    return (
      <a className="biz-asset-placeholder" href={asset.locator} target="_blank" rel="noopener noreferrer">
        {asset.locator}
      </a>
    );
  }
  return <div className="biz-asset-placeholder">{typeLabel(asset.asset_type)}</div>;
}

export default function BusinessAssetLibrary({
  businessId,
  assets,
  knowledge,
  canEdit,
  busy,
  onUiStateChange,
  onChanged,
}: {
  businessId: string;
  assets: BrandAsset[];
  knowledge: Knowledge[];
  canEdit: boolean;
  busy: boolean;
  onUiStateChange?: (state: { formOpen: boolean; dirty: boolean }) => void;
  onChanged: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<BrandAsset | null>(null);
  const [assetType, setAssetType] = useState<AssetType>('image');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const published = useMemo(
    () => knowledge.filter((row) => row.status === 'published'),
    [knowledge],
  );

  useEffect(() => {
    onUiStateChange?.({ formOpen, dirty });
  }, [formOpen, dirty, onUiStateChange]);

  function openNew() {
    setEditing(null);
    setAssetType('image');
    setFormOpen(true);
    setDirty(false);
    setError('');
  }

  function openEdit(asset: BrandAsset) {
    setEditing(asset);
    setAssetType(asset.asset_type);
    setFormOpen(true);
    setDirty(false);
    setError('');
  }

  function closeForm() {
    if (dirty && !window.confirm('Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?')) return;
    setFormOpen(false);
    setEditing(null);
    setDirty(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || busy) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') || '').trim();
    const caption = String(data.get('caption') || '').trim();
    const publicAllowed = data.get('publicAllowed') === 'on';
    const versionIds = data.getAll('knowledge').map(String);
    const file = data.get('file');
    const chosen = editing?.asset_type || assetType;
    setSaving(true);
    setError('');
    try {
      let saved: BrandAsset;
      const fields = { title, caption, publicAllowed };
      if (chosen === 'image') {
        const image = file instanceof File && file.size > 0 ? file : null;
        if (editing && image) saved = await replaceBrandImage(businessId, editing.id, image, { ...fields, revision: editing.revision });
        else if (editing) {
          saved = await businessRequest(`/${businessId}/assets/${editing.id}`, 'PATCH', {
            assetType: 'image',
            ...fields,
            revision: editing.revision,
          });
        } else if (image) saved = await uploadBrandImage(businessId, image, fields);
        else throw new Error('Görsel seçin.');
      } else {
        const body = {
          assetType: chosen,
          title,
          caption,
          publicAllowed,
          locator: chosen === 'place' ? null : String(data.get('locator') || '').trim(),
          latitude: chosen === 'place' ? String(data.get('latitude') || '').trim() : null,
          longitude: chosen === 'place' ? String(data.get('longitude') || '').trim() : null,
          ...(editing ? { revision: editing.revision } : {}),
        };
        saved = editing
          ? await businessRequest(`/${businessId}/assets/${editing.id}`, 'PATCH', body)
          : await businessRequest(`/${businessId}/assets`, 'POST', body);
      }
      const previous = new Set(
        (editing?.links || []).filter((link) => link.status === 'active' && link.confirmation_current).map((link) => link.confirmed_version_id),
      );
      const next = new Set(versionIds);
      const same = previous.size === next.size && Array.from(previous).every((id) => next.has(id));
      if (!same || data.getAll('retire').length > 0) {
        await businessRequest(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: versionIds,
          revision: saved.revision,
        });
      }
      setFormOpen(false);
      setEditing(null);
      setDirty(false);
      await onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function archive(asset: BrandAsset) {
    if (saving || busy) return;
    if (!window.confirm('Bu içerik arşivlensin mi? Herkese açık kullanım kapanır.')) return;
    setSaving(true);
    setError('');
    try {
      await businessRequest(`/${businessId}/assets/${asset.id}/archive`, 'POST', { revision: asset.revision });
      await onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedLinks = new Set(
    (editing?.links || []).filter((link) => link.status === 'active' && link.confirmation_current).map((link) => link.confirmed_version_id),
  );
  const staleItems = new Set(
    (editing?.links || []).filter((link) => link.status === 'active' && !link.confirmation_current).map((link) => link.item_id),
  );

  return (
    <section className="biz-asset-library" data-testid="biz-asset-library">
      <header className="biz-section-head">
        <div>
          <h2 className="biz-section-title">İçerik Kütüphanesi</h2>
          <p className="biz-section-lead">
            Markanın görsel, video, konum ve bağlantı kayıtları. Bir kayıt bilgiye bağlanmadan durabilir veya birden fazla bilgiyle onaylanabilir.
          </p>
        </div>
        {canEdit && !formOpen ? (
          <button type="button" className="biz-btn-primary" data-testid="biz-asset-new" onClick={openNew}>
            + Yeni içerik
          </button>
        ) : null}
      </header>

      {error ? <p className="biz-form-error" role="alert">{error}</p> : null}

      {canEdit && formOpen ? (
        <form className="biz-form biz-asset-form" data-testid="biz-asset-form" onInput={() => setDirty(true)} onSubmit={(event) => void save(event)}>
          <h3>{editing ? 'İçeriği güncelle' : 'Yeni içerik'}</h3>
          {!editing ? (
            <label>
              Tür
              <select aria-label="İçerik türü" value={assetType} onChange={(event) => { setAssetType(event.target.value as AssetType); setDirty(true); }}>
                {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          ) : <p className="biz-card-meta">{typeLabel(editing.asset_type)}</p>}
          <label>
            Başlık
            <input name="title" aria-label="İçerik başlığı" maxLength={160} defaultValue={editing?.title || ''} required disabled={saving} />
          </label>
          <label>
            {assetType === 'place' ? 'Adres' : 'Açıklama'}
            <textarea name="caption" aria-label="İçerik açıklaması" maxLength={500} defaultValue={editing?.caption || ''} disabled={saving} />
          </label>
          {assetType === 'image' ? (
            <label>
              Görsel dosyası
              <input name="file" aria-label="Görsel dosyası" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} />
            </label>
          ) : null}
          {assetType === 'video' ? (
            <label>
              HTTPS video adresi
              <input name="locator" aria-label="Video adresi" type="url" inputMode="url" placeholder="https://" defaultValue={editing?.locator || ''} required disabled={saving} />
            </label>
          ) : null}
          {assetType === 'link' ? (
            <label>
              HTTPS adresi
              <input name="locator" aria-label="Bağlantı adresi" type="url" inputMode="url" placeholder="https://" defaultValue={editing?.locator || ''} required disabled={saving} />
            </label>
          ) : null}
          {assetType === 'place' ? (
            <div className="biz-asset-coords">
              <label>
                Enlem
                <input name="latitude" aria-label="Enlem" inputMode="decimal" defaultValue={editing?.latitude || ''} required disabled={saving} />
              </label>
              <label>
                Boylam
                <input name="longitude" aria-label="Boylam" inputMode="decimal" defaultValue={editing?.longitude || ''} required disabled={saving} />
              </label>
              <p className="biz-card-meta">Koordinatları siz girin. Sistem yer adı için koordinat üretmez.</p>
            </div>
          ) : null}
          <fieldset className="biz-asset-links">
            <legend>Bilgi kayıtları</legend>
            {!published.length ? <p className="biz-card-meta">Bağlanacak güncel bilgi kaydı yok. İçerik bağsız saklanabilir.</p> : null}
            {published.map((row) => (
              <label key={row.id} className="biz-check">
                <input type="checkbox" name="knowledge" value={row.id} defaultChecked={selectedLinks.has(row.id)} disabled={saving} />
                {row.title}
                {staleItems.has(row.item_id) ? <span className="biz-card-meta"> Yeni sürüm için yeniden onay gerekir.</span> : null}
              </label>
            ))}
            {Array.from(staleItems).map((itemId) => (
              <label key={`retire-${itemId}`} className="biz-check">
                <input type="checkbox" name="retire" value={itemId} disabled={saving} />
                Eski onay bağını kaldır
              </label>
            ))}
          </fieldset>
          <label className="biz-check">
            <input type="checkbox" name="publicAllowed" defaultChecked={editing ? editing.public_allowed : false} disabled={saving} />
            Kullanıcılara gösterilmesine izin ver
          </label>
          <div className="biz-actions">
            <button type="submit" className="biz-btn-primary" disabled={saving || busy}>{saving ? 'Kaydediliyor' : 'Kaydet'}</button>
            <button type="button" className="biz-btn-ghost" onClick={closeForm} disabled={saving}>Vazgeç</button>
          </div>
        </form>
      ) : null}

      {!assets.length ? <p className="biz-empty">Henüz içerik yok.</p> : null}
      <div className="biz-asset-grid">
        {assets.map((asset) => {
          const activeLinks = asset.links.filter((link) => link.status === 'active');
          const stale = activeLinks.some((link) => !link.confirmation_current);
          return (
            <article className="biz-asset-card" key={asset.id} data-testid={`biz-asset-${asset.id}`}>
              <AssetPreview businessId={businessId} asset={asset} />
              <div className="biz-card-head">
                <h3>{asset.title}</h3>
                <span className={`biz-status biz-status--${asset.status === 'archived' ? 'archived' : asset.public_allowed ? 'published' : 'draft'}`}>{statusLabel(asset)}</span>
              </div>
              <p className="biz-card-meta">{typeLabel(asset.asset_type)}{asset.caption ? ` · ${asset.caption}` : ''}</p>
              {activeLinks.length ? (
                <p className="biz-card-meta">{activeLinks.map((link) => link.knowledge_title).filter(Boolean).join(', ')}</p>
              ) : <p className="biz-card-meta">Bilgiye bağlı değil</p>}
              {stale ? <p className="biz-form-error">Bilgi yeni sürüme geçti. İlişkiyi yeniden onaylayın.</p> : null}
              {canEdit && asset.status !== 'archived' ? (
                <div className="biz-actions">
                  <button type="button" className="biz-btn-ghost" onClick={() => openEdit(asset)}>Düzenle</button>
                  <button type="button" className="biz-btn-ghost" onClick={() => void archive(asset)}>Arşivle</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
