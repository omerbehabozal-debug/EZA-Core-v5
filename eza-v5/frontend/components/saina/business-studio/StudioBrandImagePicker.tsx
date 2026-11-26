'use client';

/**
 * In-studio brand image picker — reuses İçerik Kütüphanesi assets + preview API.
 * Does not navigate away from Studio and never flips private→public.
 */

import { useEffect, useMemo, useState } from 'react';
import type { BrandAsset } from '@/lib/eza/businessYansi';
import { fetchBrandAssetPreview } from '@/lib/eza/businessYansi';
import {
  coverImageEligibilityLabel,
  isPublishableCoverImage,
  libraryImageAssets,
} from '@/lib/eza/yansiV2PhotoCreate';

type Props = {
  open: boolean;
  businessId: string;
  assets: BrandAsset[];
  selectedAssetId?: string | null;
  heading?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (assetId: string) => void;
  /** Optional escape hatch to the full library management tab (not the primary select path). */
  onManageLibrary?: () => void;
};

function revokeObjectUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  } catch {
    /* jsdom */
  }
}

function PickerThumb({
  businessId,
  assetId,
  title,
  selected,
  disabled,
  badge,
  onSelect,
}: {
  businessId: string;
  assetId: string;
  title: string;
  selected: boolean;
  disabled: boolean;
  badge: string;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchBrandAssetPreview(businessId, assetId, 'thumb')
      .then((url) => {
        if (cancelled) {
          revokeObjectUrl(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      revokeObjectUrl(revoked);
    };
  }, [businessId, assetId]);

  return (
    <button
      type="button"
      className={`biz-photo-create-thumb${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
      data-testid={`biz-image-picker-item-${assetId}`}
      aria-pressed={selected}
      disabled={disabled}
      title={badge}
      onClick={onSelect}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="biz-photo-create-thumb-fallback">…</span>
      )}
      <span className="biz-photo-create-thumb-label">{title || 'Görsel'}</span>
      <span className="biz-image-picker-badge">{badge}</span>
    </button>
  );
}

export default function StudioBrandImagePicker({
  open,
  businessId,
  assets,
  selectedAssetId = null,
  heading = 'Kütüphaneden kapak seç',
  confirmLabel = 'Kapak olarak kullan',
  onClose,
  onConfirm,
  onManageLibrary,
}: Props) {
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(selectedAssetId);

  useEffect(() => {
    if (!open) return;
    setPendingId(selectedAssetId || null);
    setQuery('');
  }, [open, selectedAssetId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return libraryImageAssets(assets).filter((asset) => {
      if (!q) return true;
      return (asset.title || '').toLocaleLowerCase('tr').includes(q);
    });
  }, [assets, query]);

  const pendingEligible = pendingId
    ? assets.some((asset) => asset.id === pendingId && isPublishableCoverImage(asset))
    : false;

  if (!open) return null;

  return (
    <div
      className="biz-image-picker-overlay"
      role="presentation"
      data-testid="biz-image-picker-overlay"
      onClick={onClose}
    >
      <div
        className="biz-image-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="biz-image-picker-title"
        data-testid="biz-image-picker"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="biz-image-picker-head">
          <h3 id="biz-image-picker-title">{heading}</h3>
          <button
            type="button"
            className="biz-btn-ghost"
            data-testid="biz-image-picker-dismiss"
            onClick={onClose}
          >
            Vazgeç
          </button>
        </header>
        <p className="biz-card-meta">
          Yalnızca herkese açık yayımlanmış görseller kapak olabilir. Marka içi görseller
          otomatik herkese açılmaz.
        </p>
        <label className="biz-image-picker-search">
          Ara
          <input
            data-testid="biz-image-picker-search"
            value={query}
            placeholder="Başlıkta ara"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {rows.length === 0 ? (
          <p className="biz-empty" data-testid="biz-image-picker-empty">
            Kütüphanede görsel yok. Önce görsel yükleyin veya AI ile kapak oluşturun.
          </p>
        ) : (
          <div className="biz-photo-create-grid biz-image-picker-grid" role="listbox" aria-label="Görseller">
            {rows.map((asset) => {
              const eligible = isPublishableCoverImage(asset);
              const badge = coverImageEligibilityLabel(asset);
              return (
                <PickerThumb
                  key={asset.id}
                  businessId={businessId}
                  assetId={asset.id}
                  title={asset.title}
                  selected={pendingId === asset.id}
                  disabled={!eligible}
                  badge={badge}
                  onSelect={() => {
                    if (eligible) setPendingId(asset.id);
                  }}
                />
              );
            })}
          </div>
        )}
        <footer className="biz-image-picker-actions">
          {onManageLibrary ? (
            <button
              type="button"
              className="biz-btn-ghost"
              data-testid="biz-image-picker-manage"
              onClick={() => {
                onClose();
                onManageLibrary();
              }}
            >
              Kütüphaneyi yönet
            </button>
          ) : (
            <span />
          )}
          <div className="biz-actions">
            <button
              type="button"
              className="biz-btn-ghost"
              data-testid="biz-image-picker-cancel"
              onClick={onClose}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className="biz-btn-primary"
              data-testid="biz-image-picker-confirm"
              disabled={!pendingEligible || !pendingId}
              onClick={() => {
                if (!pendingId || !pendingEligible) return;
                onConfirm(pendingId);
                onClose();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
