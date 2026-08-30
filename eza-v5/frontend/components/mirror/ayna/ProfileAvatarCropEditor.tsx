'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import {
  AVATAR_CROP_VIEWPORT_PX,
  AVATAR_CROP_ZOOM_MAX,
  AVATAR_CROP_ZOOM_MIN,
  clampAvatarCropPan,
  defaultAvatarCropState,
  getAvatarCropImageStyle,
  createOrientedAvatarPreviewUrl,
  loadOrientedAvatarImage,
  releaseOrientedAvatarImage,
  renderAvatarCropToFile,
  type AvatarCropState,
  type OrientedAvatarImage,
} from '@/lib/eza/profile/avatarCrop';
import {
  avatarCropGesturePointerCancel,
  avatarCropGesturePointerDown,
  avatarCropGesturePointerMove,
  avatarCropGesturePointerUp,
  createAvatarCropGestureState,
  type AvatarCropGestureState,
} from '@/lib/eza/profile/avatarCropGesture';

export type ProfileAvatarCropEditorProps = {
  file: File;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onApply: (file: File) => void | Promise<void>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export default function ProfileAvatarCropEditor({
  file,
  open,
  busy = false,
  onCancel,
  onApply,
  returnFocusRef,
}: ProfileAvatarCropEditorProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [image, setImage] = useState<OrientedAvatarImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<AvatarCropState>(defaultAvatarCropState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [viewportPx, setViewportPx] = useState(AVATAR_CROP_VIEWPORT_PX);
  const gestureRef = useRef<AvatarCropGestureState>(createAvatarCropGestureState());
  const cropRef = useRef(crop);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  cropRef.current = crop;

  const resetGesture = useCallback(() => {
    gestureRef.current = createAvatarCropGestureState();
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(null);
    setCrop(defaultAvatarCropState());
    resetGesture();
    void loadOrientedAvatarImage(file)
      .then(async (loaded) => {
        if (cancelled) {
          releaseOrientedAvatarImage(loaded);
          return;
        }
        const orientedUrl = await createOrientedAvatarPreviewUrl(loaded);
        if (cancelled) {
          URL.revokeObjectURL(orientedUrl);
          releaseOrientedAvatarImage(loaded);
          return;
        }
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return orientedUrl;
        });
        setImage((prev) => {
          releaseOrientedAvatarImage(prev);
          return loaded;
        });
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
      setImage((prev) => {
        releaseOrientedAvatarImage(prev);
        return null;
      });
      resetGesture();
    };
  }, [open, file, resetGesture]);

  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const el = viewportRef.current;
    const sync = () => {
      const size = Math.round(el.clientWidth);
      if (size > 0) setViewportPx(size);
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, image]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = useCallback(() => {
    if (busy || applying) return;
    onCancel();
  }, [busy, applying, onCancel]);

  useModalFocusTrap({
    open,
    onClose: handleClose,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
    returnFocusRef,
  });

  const updateCrop = useCallback(
    (next: AvatarCropState) => {
      if (!image) return;
      setCrop(clampAvatarCropPan(image.width, image.height, next, viewportPx));
    },
    [image, viewportPx]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image || busy || applying) return;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    gestureRef.current = avatarCropGesturePointerDown(
      gestureRef.current,
      event.pointerId,
      event.clientX,
      event.clientY,
      cropRef.current
    );
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!image) return;
    const result = avatarCropGesturePointerMove(
      gestureRef.current,
      event.pointerId,
      event.clientX,
      event.clientY
    );
    gestureRef.current = result.state;
    if (result.offsetX != null && result.offsetY != null) {
      updateCrop({
        ...cropRef.current,
        offsetX: result.offsetX,
        offsetY: result.offsetY,
      });
    } else if (result.zoom != null) {
      updateCrop({
        ...cropRef.current,
        zoom: Math.min(AVATAR_CROP_ZOOM_MAX, Math.max(AVATAR_CROP_ZOOM_MIN, result.zoom)),
      });
    }
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (
      typeof target.hasPointerCapture === 'function' &&
      typeof target.releasePointerCapture === 'function' &&
      target.hasPointerCapture(event.pointerId)
    ) {
      target.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = avatarCropGesturePointerUp(gestureRef.current, event.pointerId);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (
      typeof target.hasPointerCapture === 'function' &&
      typeof target.releasePointerCapture === 'function' &&
      target.hasPointerCapture(event.pointerId)
    ) {
      target.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = avatarCropGesturePointerCancel(gestureRef.current, event.pointerId);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!image || busy || applying) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    updateCrop({
      ...cropRef.current,
      zoom: Math.min(
        AVATAR_CROP_ZOOM_MAX,
        Math.max(AVATAR_CROP_ZOOM_MIN, cropRef.current.zoom + delta)
      ),
    });
  };

  const handleApply = async () => {
    if (!image || busy || applying) return;
    setApplying(true);
    try {
      const cropped = await renderAvatarCropToFile(image, crop, file.name, viewportPx);
      await onApply(cropped);
    } catch {
      setLoadError('Kırpılmış fotoğraf oluşturulamadı.');
    } finally {
      setApplying(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const imageStyle =
    image != null ? getAvatarCropImageStyle(image.width, image.height, crop, viewportPx) : null;

  return createPortal(
    <div
      className="bilign-avatar-crop-backdrop"
      data-testid="profile-avatar-crop-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !applying) handleClose();
      }}
    >
      <div
        ref={dialogRef}
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={onPointerCancel}
          onWheel={onWheel}
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
              updateCrop({ ...cropRef.current, zoom: Number(event.target.value) })
            }
          />
          <span aria-hidden>+</span>
        </div>

        <div className="bilign-avatar-crop-actions">
          <button
            ref={cancelRef}
            type="button"
            className="bilign-avatar-crop-btn bilign-avatar-crop-btn--ghost"
            disabled={busy || applying}
            onClick={handleClose}
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
