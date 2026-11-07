"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { AuthorizedVideo, CoverPreparation } from './CoverPreparation';
import {
  BRAND_LIBRARY_IMAGE_MAX_BYTES,
  STORED_VIDEO_MAX_BYTES,
  businessRequest,
  fetchBrandAssetPreview,
  replaceBrandImage,
  uploadBrandImage,
  uploadBrandVideo,
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
type MediaKind = 'image' | 'video';
type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

type UploadItem = {
  localId: string;
  kind: MediaKind;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  error: string;
  asset: BrandAsset | null;
  metaOpen: boolean;
  title: string;
  caption: string;
  knowledgeIds: string[];
};

const COPY: Record<string, string> = {
  asset_file_rejected: 'Dosya türü desteklenmiyor.',
  asset_file_too_large: 'Dosya boyut sınırı aşıldı.',
  asset_file_empty: 'Dosya boş.',
  asset_url_rejected: 'Adres yalnızca güvenli bir HTTPS bağlantısı olabilir.',
  asset_coordinate_rejected: 'Enlem ve boylam geçerli bir aralıkta olmalı.',
  asset_title_rejected: 'Başlık geçersiz.',
  revision_conflict: 'Bu kayıt başka bir kayıtla değişti. Listeyi yenileyip tekrar deneyin.',
  published_knowledge_required: 'Yalnızca güncel bilgi kaydı seçilebilir.',
  archived_asset: 'Arşivlenmiş içerik düzenlenemez.',
  video_too_large: 'Video 40 MB sınırını aşıyor.',
  video_too_long: 'Video 60 saniyeden uzun olamaz.',
  video_file_rejected: 'Video MP4 olmalı.',
  video_quota_unavailable: 'Video kotası geçici olarak kullanılamıyor. Biraz sonra deneyin.',
  video_rate_limited: 'Video yükleme limiti doldu. Biraz sonra deneyin.',
};

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const VIDEO_ACCEPT = 'video/mp4';
const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;
const UPLOAD_CONCURRENCY = 3;

function messageOf(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';
  if (code && COPY[code]) return COPY[code];
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

function isImageFile(file: File) {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(file.type);
}

function isVideoFile(file: File) {
  if (file.type === 'video/mp4') return true;
  return file.name.toLowerCase().endsWith('.mp4');
}

function mediaKindOf(file: File): MediaKind | null {
  if (isImageFile(file)) return 'image';
  if (isVideoFile(file)) return 'video';
  return null;
}

function linkHostname(locator: string | null | undefined) {
  if (!locator) return '';
  try {
    return new URL(locator).hostname || locator;
  } catch {
    return locator;
  }
}

function displayTitle(asset: BrandAsset) {
  if (asset.title?.trim()) return asset.title.trim();
  if (asset.asset_type === 'link') return linkHostname(asset.locator) || 'Başlıksız bağlantı';
  if (asset.asset_type === 'place') return asset.caption?.trim() || 'Başlıksız konum';
  if (asset.asset_type === 'video') return 'Başlıksız video';
  return 'Başlıksız görsel';
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
        else if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(next);
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    };
  }, [asset.asset_type, asset.id, asset.locator_kind, asset.revision, businessId]);

  if (asset.asset_type === 'image') {
    return src ? (
      <img className="biz-asset-preview" src={src} alt="" />
    ) : (
      <div className="biz-asset-placeholder">Görsel önizlemesi</div>
    );
  }
  if (asset.asset_type === 'video' && asset.locator_kind === 'storage') {
    return <AuthorizedVideo businessId={businessId} assetId={asset.id} label="Yüklenen video" />;
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
        {linkHostname(asset.locator) || asset.locator}
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
  const [assetType, setAssetType] = useState<'place' | 'link'>('place');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [metaAssetId, setMetaAssetId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<BrandAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  const published = useMemo(
    () => knowledge.filter((row) => row.status === 'published'),
    [knowledge],
  );

  useEffect(() => {
    onUiStateChange?.({ formOpen, dirty: dirty || uploads.some((item) => item.status === 'uploading' || item.metaOpen) });
  }, [formOpen, dirty, uploads, onUiStateChange]);

  useEffect(() => {
    return () => {
      uploadsRef.current.forEach((item) => {
        if (item.previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const owned = new Set(assets.map((row) => row.id));
    const stale = uploadsRef.current.filter(
      (item) => item.status === 'success' && item.asset && owned.has(item.asset.id) && !item.metaOpen,
    );
    if (!stale.length) return;
    stale.forEach((item) => {
      if (item.previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(item.previewUrl);
    });
    const drop = new Set(stale.map((item) => item.localId));
    const merged = uploadsRef.current.filter((item) => !drop.has(item.localId));
    uploadsRef.current = merged;
    setUploads(merged);
  }, [assets]);

  function patchUpload(localId: string, patch: Partial<UploadItem>) {
    const merged = uploadsRef.current.map((row) => (row.localId === localId ? { ...row, ...patch } : row));
    uploadsRef.current = merged;
    setUploads(merged);
  }

  function fileKey(file: File) {
    return `${file.name}::${file.size}::${file.lastModified}`;
  }

  async function runUpload(item: UploadItem) {
    const live = uploadsRef.current.find((row) => row.localId === item.localId);
    if (!live || live.status === 'success') return;
    patchUpload(item.localId, { status: 'uploading', progress: 0, error: '' });
    try {
      if (item.kind === 'image') {
        if (item.file.size > BRAND_LIBRARY_IMAGE_MAX_BYTES) throw new Error('asset_file_too_large');
        if (!isImageFile(item.file)) throw new Error('asset_file_rejected');
      } else {
        if (item.file.size > STORED_VIDEO_MAX_BYTES) throw new Error('video_too_large');
        if (!isVideoFile(item.file)) throw new Error('video_file_rejected');
      }
      const latest = uploadsRef.current.find((row) => row.localId === item.localId) || item;
      const fields = { title: latest.title, caption: latest.caption, publicAllowed: false };
      const saved =
        item.kind === 'image'
          ? await uploadBrandImage(businessId, item.file, fields, (ratio) => patchUpload(item.localId, { progress: ratio }))
          : await uploadBrandVideo(businessId, item.file, fields, (ratio) => patchUpload(item.localId, { progress: ratio }));
      const after = uploadsRef.current.find((row) => row.localId === item.localId);
      if (after?.knowledgeIds.length) {
        await businessRequest(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: after.knowledgeIds,
          revision: saved.revision,
        });
      }
      if (after?.metaOpen) {
        patchUpload(item.localId, { status: 'success', progress: 1, asset: saved, error: '' });
        await onChanged();
      } else {
        removeUpload(item.localId);
        await onChanged();
      }
    } catch (err) {
      patchUpload(item.localId, { status: 'error', error: messageOf(err), progress: 0 });
    } finally {
      void pumpUploads();
    }
  }

  function pumpUploads() {
    let active = uploadsRef.current.filter((row) => row.status === 'uploading').length;
    const started: UploadItem[] = [];
    const nextRows = uploadsRef.current.map((row) => {
      if (row.status !== 'queued' || active >= UPLOAD_CONCURRENCY) return row;
      active += 1;
      const claimed = { ...row, status: 'uploading' as const, progress: 0, error: '' };
      started.push(claimed);
      return claimed;
    });
    if (!started.length) return;
    uploadsRef.current = nextRows;
    setUploads(nextRows);
    started.forEach((row) => {
      void runUpload(row);
    });
  }

  function enqueueFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(Boolean);
    if (!files.length) return;
    const inFlight = new Set(
      uploadsRef.current
        .filter((row) => row.status === 'queued' || row.status === 'uploading' || row.status === 'success')
        .map((row) => fileKey(row.file)),
    );
    const next: UploadItem[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const kind = mediaKindOf(file);
      if (!kind) {
        rejected.push(file.name);
        continue;
      }
      const key = fileKey(file);
      if (inFlight.has(key)) continue;
      inFlight.add(key);
      next.push({
        localId: `${kind}-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        kind,
        file,
        previewUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
        status: 'queued',
        progress: 0,
        error: '',
        asset: null,
        metaOpen: false,
        title: '',
        caption: '',
        knowledgeIds: [],
      });
    }
    if (rejected.length) setError('Yalnızca PNG/JPEG/WebP görselleri ve MP4 videoları yüklenebilir.');
    if (!next.length) return;
    const merged = [...next, ...uploadsRef.current];
    uploadsRef.current = merged;
    setUploads(merged);
    if (!rejected.length) setError('');
    pumpUploads();
  }

  function removeUpload(localId: string) {
    const target = uploadsRef.current.find((row) => row.localId === localId);
    if (target?.previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(target.previewUrl);
    const merged = uploadsRef.current.filter((row) => row.localId !== localId);
    uploadsRef.current = merged;
    setUploads(merged);
  }

  function retryUpload(localId: string) {
    const merged = uploadsRef.current.map((row) =>
      row.localId === localId ? { ...row, status: 'queued' as const, progress: 0, error: '', asset: null } : row,
    );
    uploadsRef.current = merged;
    setUploads(merged);
    pumpUploads();
  }

  async function saveUploadMetadata(item: UploadItem) {
    if (!item.asset || saving || busy) return;
    setSaving(true);
    setError('');
    try {
      const saved = await businessRequest<BrandAsset>(`/${businessId}/assets/${item.asset.id}`, 'PATCH', {
        assetType: item.asset.asset_type,
        title: item.title,
        caption: item.caption,
        publicAllowed: item.asset.public_allowed,
        revision: item.asset.revision,
        locator: item.asset.locator_kind === 'https' ? item.asset.locator : null,
        latitude: item.asset.latitude,
        longitude: item.asset.longitude,
      });
      const previous = new Set(
        (item.asset.links || [])
          .filter((link) => link.status === 'active' && link.confirmation_current)
          .map((link) => link.confirmed_version_id),
      );
      const next = new Set(item.knowledgeIds);
      const same = previous.size === next.size && Array.from(previous).every((id) => next.has(id));
      if (!same) {
        await businessRequest(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: item.knowledgeIds,
          revision: saved.revision,
        });
      }
      removeUpload(item.localId);
      await onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  function openNew() {
    setEditing(null);
    setAssetType('place');
    setFormOpen(true);
    setDirty(false);
    setError('');
  }

  function openEdit(asset: BrandAsset) {
    setEditing(asset);
    setAssetType(asset.asset_type === 'link' ? 'link' : asset.asset_type === 'place' ? 'place' : 'place');
    setFormOpen(true);
    setDirty(false);
    setError('');
    setMetaAssetId(null);
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
        if (editing && image) {
          saved = await replaceBrandImage(businessId, editing.id, image, {
            ...fields,
            revision: editing.revision,
          });
        } else if (editing) {
          saved = await businessRequest(`/${businessId}/assets/${editing.id}`, 'PATCH', {
            assetType: 'image',
            ...fields,
            revision: editing.revision,
          });
        } else throw new Error('Görsel seçin.');
      } else if (chosen === 'video') {
        if (!editing) throw new Error('Videoları sürükleyip bırakarak veya seçerek yükleyin.');
        const storedVideo = editing.locator_kind === 'storage';
        saved = await businessRequest(`/${businessId}/assets/${editing.id}`, 'PATCH', {
          assetType: 'video',
          title,
          caption,
          publicAllowed,
          locator: storedVideo ? null : String(data.get('locator') || '').trim(),
          latitude: null,
          longitude: null,
          revision: editing.revision,
        });
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
        if (chosen === 'place' && (!body.latitude || !body.longitude)) {
          throw new Error('Konum kaydı için enlem ve boylam gerekli. Adres metninden koordinat üretilmez.');
        }
        if (chosen === 'link' && !body.locator) {
          throw new Error('asset_url_rejected');
        }
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

  async function confirmArchive() {
    if (!archiveTarget || saving || busy) return;
    const asset = archiveTarget;
    setSaving(true);
    setError('');
    try {
      await businessRequest(`/${businessId}/assets/${asset.id}/archive`, 'POST', { revision: asset.revision });
      setArchiveTarget(null);
      await onChanged();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveExistingMetadata(asset: BrandAsset, title: string, caption: string, knowledgeIds: string[]) {
    if (saving || busy) return;
    setSaving(true);
    setError('');
    try {
      const saved = await businessRequest<BrandAsset>(`/${businessId}/assets/${asset.id}`, 'PATCH', {
        assetType: asset.asset_type,
        title,
        caption,
        publicAllowed: asset.public_allowed,
        revision: asset.revision,
        locator: asset.locator_kind === 'https' ? asset.locator : null,
        latitude: asset.latitude,
        longitude: asset.longitude,
      });
      const previous = new Set(
        (asset.links || [])
          .filter((link) => link.status === 'active' && link.confirmation_current)
          .map((link) => link.confirmed_version_id),
      );
      const next = new Set(knowledgeIds);
      const same = previous.size === next.size && Array.from(previous).every((id) => next.has(id));
      if (!same) {
        await businessRequest(`/${businessId}/assets/${saved.id}/links`, 'POST', {
          knowledgeVersionIds: knowledgeIds,
          revision: saved.revision,
        });
      }
      setMetaAssetId(null);
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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (!canEdit || busy) return;
    enqueueFiles(event.dataTransfer.files);
  }

  const libraryIds = useMemo(() => new Set(assets.map((row) => row.id)), [assets]);
  const visibleUploads = uploads.filter(
    (item) => item.status !== 'success' || !item.asset || !libraryIds.has(item.asset.id) || item.metaOpen,
  );
  const formKind = editing?.asset_type || assetType;

  return (
    <section className="biz-asset-library" data-testid="biz-asset-library">
      <header className="biz-section-head">
        <div>
          <h2 className="biz-section-title">İçerik Kütüphanesi</h2>
          <p className="biz-section-lead">
            Görsel ve videoları sürükleyip bırakın veya seçin. Başlık zorunlu değildir; kayıtlar varsayılan olarak marka içinde kalır.
          </p>
        </div>
        {canEdit && !formOpen ? (
          <button type="button" className="biz-btn-ghost" data-testid="biz-asset-new" onClick={openNew}>
            Konum / bağlantı
          </button>
        ) : null}
      </header>

      {error ? <p className="biz-form-error" role="alert">{error}</p> : null}

      {canEdit ? (
        <div
          className={`biz-asset-dropzone${dragOver ? ' biz-asset-dropzone--active' : ''}`}
          data-testid="biz-asset-dropzone"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
        >
          <p>Görsel ve videoları buraya bırakın veya seçin</p>
          <p className="biz-card-meta">Görsel: PNG/JPEG/WebP · 15 MB · Video: MP4 · 40 MB / 60 sn · birden fazla dosya</p>
          <button
            type="button"
            className="biz-btn-primary"
            data-testid="biz-asset-pick-images"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Medya seç
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            multiple
            hidden
            aria-label="Medya dosyaları"
            data-testid="biz-asset-file-input"
            onChange={(event) => {
              if (event.target.files?.length) enqueueFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      ) : null}

      {visibleUploads.length ? (
        <div className="biz-asset-upload-grid" data-testid="biz-asset-upload-grid">
          {visibleUploads.map((item) => (
            <article className="biz-asset-card biz-asset-upload-card" key={item.localId} data-testid={`biz-upload-${item.localId}`}>
              {item.previewUrl && item.kind === 'image' ? (
                <img className="biz-asset-preview" src={item.previewUrl} alt="" />
              ) : item.previewUrl && item.kind === 'video' ? (
                <video className="biz-asset-preview" src={item.previewUrl} muted playsInline preload="metadata" />
              ) : (
                <div className="biz-asset-placeholder">Önizleme</div>
              )}
              <div className="biz-card-head">
                <h3>{item.title.trim() || item.file.name}</h3>
                <span className={`biz-status biz-status--${item.status === 'success' ? 'published' : item.status === 'error' ? 'archived' : 'draft'}`}>
                  {item.status === 'queued'
                    ? 'Sırada'
                    : item.status === 'uploading'
                      ? `Yükleniyor ${Math.round(item.progress * 100)}%`
                      : item.status === 'success'
                        ? 'Yüklendi'
                        : 'Hata'}
                </span>
              </div>
              <p className="biz-card-meta">{item.kind === 'video' ? 'Video' : 'Görsel'} · Marka içinde</p>
              {item.status === 'uploading' ? (
                <div className="biz-asset-progress" role="progressbar" aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
                </div>
              ) : null}
              {item.error ? <p className="biz-form-error">{item.error}</p> : null}
              <div className="biz-actions">
                {item.status === 'success' ? (
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid={`biz-upload-meta-${item.localId}`}
                    onClick={() => patchUpload(item.localId, { metaOpen: !item.metaOpen })}
                  >
                    +
                  </button>
                ) : null}
                {item.status === 'error' ? (
                  <button type="button" className="biz-btn-ghost" onClick={() => retryUpload(item.localId)}>
                    Yeniden dene
                  </button>
                ) : null}
                {item.status !== 'uploading' ? (
                  <button type="button" className="biz-btn-ghost" onClick={() => removeUpload(item.localId)}>
                    Kaldır
                  </button>
                ) : null}
              </div>
              {item.metaOpen ? (
                <div className="biz-asset-meta-panel" data-testid={`biz-upload-meta-panel-${item.localId}`}>
                  <label>
                    Başlık
                    <input
                      aria-label="Yükleme başlığı"
                      maxLength={160}
                      value={item.title}
                      onChange={(event) => patchUpload(item.localId, { title: event.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Açıklama
                    <textarea
                      aria-label="Yükleme açıklaması"
                      maxLength={500}
                      value={item.caption}
                      onChange={(event) => patchUpload(item.localId, { caption: event.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <fieldset className="biz-asset-links">
                    <legend>Bilgi kayıtları</legend>
                    {!published.length ? <p className="biz-card-meta">Bağlanacak güncel bilgi kaydı yok.</p> : null}
                    {published.map((row) => (
                      <label key={row.id} className="biz-check">
                        <input
                          type="checkbox"
                          checked={item.knowledgeIds.includes(row.id)}
                          disabled={saving}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...item.knowledgeIds, row.id]
                              : item.knowledgeIds.filter((id) => id !== row.id);
                            patchUpload(item.localId, { knowledgeIds: next });
                          }}
                        />
                        {row.title}
                      </label>
                    ))}
                  </fieldset>
                  <button type="button" className="biz-btn-primary" disabled={saving || !item.asset} onClick={() => void saveUploadMetadata(item)}>
                    Kaydet
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {canEdit && formOpen ? (
        <form className="biz-form biz-asset-form" data-testid="biz-asset-form" onInput={() => setDirty(true)} onSubmit={(event) => void save(event)}>
          <h3>{editing ? 'İçeriği güncelle' : 'Konum / bağlantı'}</h3>
          {!editing ? (
            <label>
              Tür
              <select
                aria-label="İçerik türü"
                value={assetType}
                onChange={(event) => {
                  setAssetType(event.target.value as 'place' | 'link');
                  setDirty(true);
                }}
              >
                <option value="place">Konum</option>
                <option value="link">Bağlantı</option>
              </select>
            </label>
          ) : (
            <p className="biz-card-meta">{typeLabel(editing.asset_type)}</p>
          )}
          {formKind === 'place' ? (
            <>
              <label>
                Adres / yer tanımı
                <textarea
                  name="caption"
                  aria-label="Adres veya yer tanımı"
                  maxLength={500}
                  defaultValue={editing?.caption || ''}
                  placeholder="Örn. Karaköy iskele yanı"
                  disabled={saving}
                />
              </label>
              <p className="biz-card-meta" data-testid="biz-place-coord-hint">
                Harita araması bu aşamada yok. Kaydetmek için enlem ve boylamı kendiniz girin; adres metninden koordinat üretilmez.
              </p>
              <div className="biz-asset-coords">
                <label>
                  Enlem
                  <input name="latitude" aria-label="Enlem" inputMode="decimal" defaultValue={editing?.latitude || ''} required disabled={saving} />
                </label>
                <label>
                  Boylam
                  <input name="longitude" aria-label="Boylam" inputMode="decimal" defaultValue={editing?.longitude || ''} required disabled={saving} />
                </label>
              </div>
              <label>
                Başlık (isteğe bağlı)
                <input name="title" aria-label="İçerik başlığı" maxLength={160} defaultValue={editing?.title || ''} disabled={saving} />
              </label>
            </>
          ) : null}
          {formKind === 'link' ? (
            <>
              <label>
                HTTPS adresi
                <input
                  name="locator"
                  aria-label="Bağlantı adresi"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  defaultValue={editing?.locator || ''}
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Başlık (isteğe bağlı)
                <input name="title" aria-label="İçerik başlığı" maxLength={160} defaultValue={editing?.title || ''} disabled={saving} />
              </label>
              <label>
                Açıklama (isteğe bağlı)
                <textarea name="caption" aria-label="İçerik açıklaması" maxLength={500} defaultValue={editing?.caption || ''} disabled={saving} />
              </label>
            </>
          ) : null}
          {formKind === 'image' || formKind === 'video' ? (
            <>
              <label>
                Başlık (isteğe bağlı)
                <input name="title" aria-label="İçerik başlığı" maxLength={160} defaultValue={editing?.title || ''} disabled={saving} />
              </label>
              <label>
                Açıklama
                <textarea name="caption" aria-label="İçerik açıklaması" maxLength={500} defaultValue={editing?.caption || ''} disabled={saving} />
              </label>
            </>
          ) : null}
          {editing?.asset_type === 'image' ? (
            <label>
              Görseli değiştir
              <input name="file" aria-label="Görsel dosyası" type="file" accept={IMAGE_ACCEPT} disabled={saving} />
            </label>
          ) : null}
          {editing?.asset_type === 'video' && editing.locator_kind === 'https' ? (
            <label>
              HTTPS video adresi
              <input name="locator" aria-label="Video adresi" type="url" inputMode="url" placeholder="https://" defaultValue={editing.locator || ''} required disabled={saving} />
            </label>
          ) : null}
          {editing?.asset_type === 'video' && editing.locator_kind === 'storage' ? (
            <p className="biz-card-meta">Yüklenen video duruyor. Kapak kendiliğinden hazırlanır.</p>
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
            <button type="submit" className="biz-btn-primary" disabled={saving || busy}>
              {saving ? 'Kaydediliyor' : 'Kaydet'}
            </button>
            <button type="button" className="biz-btn-ghost" onClick={closeForm} disabled={saving}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      {!assets.length && !visibleUploads.length ? <p className="biz-empty">Henüz içerik yok.</p> : null}
      <div className="biz-asset-grid" data-testid="biz-asset-grid">
        {assets.map((asset) => {
          const activeLinks = asset.links.filter((link) => link.status === 'active');
          const stale = activeLinks.some((link) => !link.confirmation_current);
          const metaOpen = metaAssetId === asset.id;
          const selected = new Set(
            activeLinks.filter((link) => link.confirmation_current).map((link) => link.confirmed_version_id),
          );
          return (
            <article className="biz-asset-card" key={asset.id} data-testid={`biz-asset-${asset.id}`}>
              <AssetPreview businessId={businessId} asset={asset} />
              {asset.asset_type === 'video' && asset.locator_kind === 'storage' && asset.status !== 'archived' ? (
                <CoverPreparation businessId={businessId} assetId={asset.id} />
              ) : null}
              <div className="biz-card-head">
                <h3>{displayTitle(asset)}</h3>
                <span className={`biz-status biz-status--${asset.status === 'archived' ? 'archived' : asset.public_allowed ? 'published' : 'draft'}`}>
                  {statusLabel(asset)}
                </span>
              </div>
              <p className="biz-card-meta">
                {typeLabel(asset.asset_type)}
                {asset.asset_type !== 'place' && asset.caption ? ` · ${asset.caption}` : ''}
                {asset.asset_type === 'link' && asset.locator ? ` · ${linkHostname(asset.locator)}` : ''}
              </p>
              {activeLinks.length ? (
                <p className="biz-card-meta">{activeLinks.map((link) => link.knowledge_title).filter(Boolean).join(', ')}</p>
              ) : (
                <p className="biz-card-meta">Bilgiye bağlı değil</p>
              )}
              {stale ? <p className="biz-form-error">Bilgi yeni sürüme geçti. İlişkiyi yeniden onaylayın.</p> : null}
              {canEdit && asset.status !== 'archived' ? (
                <div className="biz-actions">
                  <button type="button" className="biz-btn-ghost" data-testid={`biz-asset-plus-${asset.id}`} onClick={() => setMetaAssetId(metaOpen ? null : asset.id)}>
                    +
                  </button>
                  <button type="button" className="biz-btn-ghost" onClick={() => openEdit(asset)}>
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="biz-btn-ghost"
                    data-testid={`biz-asset-archive-${asset.id}`}
                    disabled={saving || busy}
                    onClick={() => {
                      setMetaAssetId(null);
                      setArchiveTarget(asset);
                    }}
                  >
                    Arşive Kaldır
                  </button>
                </div>
              ) : null}
              {archiveTarget?.id === asset.id ? (
                <div
                  className="biz-asset-archive-confirm"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby={`biz-archive-title-${asset.id}`}
                  data-testid={`biz-asset-archive-confirm-${asset.id}`}
                >
                  <p id={`biz-archive-title-${asset.id}`}>Bu içerik aktif kütüphaneden kaldırılacak.</p>
                  <div className="biz-actions">
                    <button type="button" className="biz-btn-ghost" disabled={saving} onClick={() => setArchiveTarget(null)}>
                      İptal
                    </button>
                    <button
                      type="button"
                      className="biz-btn-primary"
                      data-testid={`biz-asset-archive-confirm-submit-${asset.id}`}
                      disabled={saving || busy}
                      onClick={() => void confirmArchive()}
                    >
                      Arşive Kaldır
                    </button>
                  </div>
                </div>
              ) : null}
              {metaOpen ? (
                <ExistingMetaPanel
                  asset={asset}
                  published={published}
                  selected={selected}
                  saving={saving}
                  onCancel={() => setMetaAssetId(null)}
                  onSave={(nextTitle, nextCaption, knowledgeIds) => void saveExistingMetadata(asset, nextTitle, nextCaption, knowledgeIds)}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ExistingMetaPanel({
  asset,
  published,
  selected,
  saving,
  onCancel,
  onSave,
}: {
  asset: BrandAsset;
  published: Knowledge[];
  selected: Set<string>;
  saving: boolean;
  onCancel: () => void;
  onSave: (title: string, caption: string, knowledgeIds: string[]) => void;
}) {
  const [title, setTitle] = useState(asset.title || '');
  const [caption, setCaption] = useState(asset.caption || '');
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>(Array.from(selected));
  return (
    <div className="biz-asset-meta-panel" data-testid={`biz-asset-meta-panel-${asset.id}`}>
      <label>
        Başlık
        <input aria-label="Kayıtlı içerik başlığı" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} />
      </label>
      <label>
        Açıklama
        <textarea aria-label="Kayıtlı içerik açıklaması" maxLength={500} value={caption} onChange={(event) => setCaption(event.target.value)} disabled={saving} />
      </label>
      <fieldset className="biz-asset-links">
        <legend>Bilgi kayıtları</legend>
        {!published.length ? <p className="biz-card-meta">Bağlanacak güncel bilgi kaydı yok.</p> : null}
        {published.map((row) => (
          <label key={row.id} className="biz-check">
            <input
              type="checkbox"
              checked={knowledgeIds.includes(row.id)}
              disabled={saving}
              onChange={(event) => {
                setKnowledgeIds((ids) => (event.target.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id)));
              }}
            />
            {row.title}
          </label>
        ))}
      </fieldset>
      <div className="biz-actions">
        <button type="button" className="biz-btn-primary" disabled={saving} onClick={() => onSave(title, caption, knowledgeIds)}>
          Kaydet
        </button>
        <button type="button" className="biz-btn-ghost" disabled={saving} onClick={onCancel}>
          Kapat
        </button>
      </div>
    </div>
  );
}
