'use client';

/**
 * Mobile-only Ayna surface — bottom sheet equivalent of the desktop right panel.
 * Does not change Ayna identity / Journey selection authority.
 */

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { SAINA_MIRROR_TITLE } from '@/lib/eza/sainaCopy';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import SainaStandaloneMirrorPanel from './SainaStandaloneMirrorPanel';

export type SainaMobileAynaSheetProps = {
  open: boolean;
  onClose: () => void;
};

export default function SainaMobileAynaSheet({ open, onClose }: SainaMobileAynaSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusTrap({
    open,
    onClose,
    containerRef: panelRef,
    initialFocusRef: closeRef,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="saina-mobile-ayna-sheet-root"
      data-testid="saina-mobile-ayna-sheet"
      role="presentation"
    >
      <button
        type="button"
        className="saina-mobile-ayna-sheet-backdrop"
        aria-label="Ayna panelini kapat"
        data-testid="saina-mobile-ayna-sheet-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="saina-mobile-ayna-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="saina-mobile-ayna-sheet-panel"
      >
        <div className="saina-mobile-ayna-sheet-handle" aria-hidden>
          <span className="saina-mobile-ayna-sheet-handle-bar" />
        </div>
        <div className="saina-mobile-ayna-sheet-chrome">
          <h2 id={titleId} className="saina-mobile-ayna-sheet-title saina-serif">
            {SAINA_MIRROR_TITLE}
          </h2>
          <button
            type="button"
            ref={closeRef}
            className="saina-mobile-ayna-sheet-close"
            aria-label="Kapat"
            data-testid="saina-mobile-ayna-sheet-close"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="saina-mobile-ayna-sheet-body">
          <SainaStandaloneMirrorPanel showCollapse={false} />
        </div>
      </div>
    </div>
  );
}
