'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AVATAR_CROP_VIEWPORT_PX,
  AVATAR_CROP_ZOOM_MAX,
  AVATAR_CROP_ZOOM_MIN,
  clampAvatarCropPan,
  defaultAvatarCropState,
  getAvatarCropImageStyle,
  createOrientedAvatarPreviewUrl,
  loadOrientedAvatarImage,
  renderAvatarCropToFile,
  type AvatarCropState,
  type OrientedAvatarImage,
} from '@/lib/eza/profile/avatarCrop';

export type ProfileAvatarCropEditorProps = {
  file: File;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
};

export default function ProfileAvatarCropEditor({
  file,
  open,
  busy = false,
  onCancel,
  onApply,
}: ProfileAvatarCropEditorProps) {
  const titleId = useId();
  const [image, setImage] = useState<OrientedAvatarImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<AvatarCropState>(defaultAvatarCropState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null
  );
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(null);
    setCrop(defaultAvatarCropState());
    void loadOrientedAvatarImage(file)
      .then(async (loaded) => {
        if (cancelled) return;
        const orientedUrl = await createOrientedAvatarPreviewUrl(loaded);
        if (cancelled) {
          URL.revokeObjectURL(orientedUrl);
          return;
        }
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return orientedUrl;
        });
        setImage(loaded);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Fotoğraf açılamadı.');
      });
    return () => {
      cancelled = true;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setImage(null);
    };
  }, [open, file]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !applying) {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, applying, onCancel]);

  const updateCrop = useCallback(
    (next: AvatarCropState) => {
      if (!image) return;
      setCrop(clampAvatarCropPan(image.width, image.height, next));
    },
    [image]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image || busy || applying) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !image) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    updateCrop({
      ...crop,
      offsetX: dragRef.current.offsetX + dx,
      offsetY: dragRef.current.offsetY + dy,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!image || busy || applying) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    updateCrop({
      ...crop,
      zoom: Math.min(AVATAR_CROP_ZOOM_MAX, Math.max(AVATAR_CROP_ZOOM_MIN, crop.zoom + delta)),
    });
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!image || event.touches.length !== 2) return;
    const [a, b] = [event.touches[0]!, event.touches[1]!];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchRef.current = { distance, zoom: crop.zoom };
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!image || !pinchRef.current || event.touches.length !== 2) return;
    event.preventDefault();
    const [a, b] = [event.touches[0]!, event.touches[1]!];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = distance / pinchRef.current.distance;
    updateCrop({
      ...crop,
      zoom: Math.min(
        AVATAR_CROP_ZOOM_MAX,
        Math.max(AVATAR_CROP_ZOOM_MIN, pinchRef.current.zoom * ratio)
      ),
    });
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleApply = async () => {
    if (!image || busy || applying) return;
    setApplying(true);
    try {
      const cropped = await renderAvatarCropToFile(image, crop, file.name);
      await onApply(cropped);
    } catch {
      setLoadError('Kırpılmış fotoğraf oluşturulamadı.');
    } finally {
      setApplying(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const imageStyle =
    image != null ? getAvatarCropImageStyle(image.width, image.height, crop) : null;

  return createPortal(
    <div
      className="bilign-avatar-crop-backdrop"
      data-testid="profile-avatar-crop-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !applying) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bilign-avatar-crop-dialog"
        data-testid="profile-avatar-crop-editor"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="bilign-avatar-crop-title">
          Fotoğrafı ayarla
        </h2>

        {loadError ? (
          <p className="bilign-avatar-crop-error" role="alert">
            {loadError}
          </p>
        ) : null}

        <div
          ref={viewportRef}
          className="bilign-avatar-crop-viewport"
          data-testid="profile-avatar-crop-viewport"
          style={{ width: AVATAR_CROP_VIEWPORT_PX, height: AVATAR_CROP_VIEWPORT_PX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {image && imageStyle && previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="bilign-avatar-crop-image"
              data-testid="profile-avatar-crop-image"
              style={{
                width: imageStyle.width,
                height: imageStyle.height,
                transform: imageStyle.transform,
              }}
            />
          ) : (
            <div className="bilign-avatar-crop-loading" aria-hidden />
          )}
          <div className="bilign-avatar-crop-mask" aria-hidden />
        </div>

        <div className="bilign-avatar-crop-zoom">
          <span aria-hidden>−</span>
          <input
            type="range"
            min={AVATAR_CROP_ZOOM_MIN}
            max={AVATAR_CROP_ZOOM_MAX}
            step={0.01}
            value={crop.zoom}
            disabled={!image || busy || applying}
            aria-label="Yakınlaştırma"
            data-testid="profile-avatar-crop-zoom"
            onChange={(event) =>
              updateCrop({ ...crop, zoom: Number(event.target.value) })
            }
          />
          <span aria-hidden>+</span>
        </div>

        <div className="bilign-avatar-crop-actions">
          <button
            type="button"
            className="bilign-avatar-crop-btn bilign-avatar-crop-btn--ghost"
            disabled={busy || applying}
            onClick={onCancel}
            data-testid="profile-avatar-crop-cancel"
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="bilign-avatar-crop-btn bilign-avatar-crop-btn--primary"
            disabled={!image || busy || applying}
            onClick={() => void handleApply()}
            data-testid="profile-avatar-crop-apply"
          >
            {applying ? 'Uygulanıyor…' : 'Uygula'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
