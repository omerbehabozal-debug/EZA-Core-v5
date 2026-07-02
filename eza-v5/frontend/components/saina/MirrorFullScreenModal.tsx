'use client';

import { useEffect } from 'react';
import { Download, Share2, Sparkles, X } from 'lucide-react';
import {
  SAINA_DOWNLOAD,
  SAINA_MODAL_MOCK_NOTE,
  SAINA_MODAL_TITLE,
  SAINA_REGENERATE,
  SAINA_SHARE,
} from '@/lib/eza/sainaCopy';
import SainaGeometricMark from './SainaGeometricMark';

type MirrorFullScreenModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function MirrorFullScreenModal({ open, onClose }: MirrorFullScreenModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="saina-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saina-mirror-modal-title"
      onClick={onClose}
    >
      <div className="saina-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="saina-modal-close"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X size={16} />
        </button>

        <div className="saina-modal-head">
          <div className="saina-modal-head-row">
            <SainaGeometricMark size={28} variant="gold" />
            <h2 id="saina-mirror-modal-title" className="saina-modal-title saina-serif">
              {SAINA_MODAL_TITLE}
            </h2>
          </div>
          <p className="saina-mirror-subtitle saina-modal-note">{SAINA_MODAL_MOCK_NOTE}</p>
        </div>

        <div className="saina-modal-poster-wrap">
          <div className="saina-modal-poster">
            <div className="saina-modal-poster-body">
              <div className="saina-modal-poster-mark">
                <SainaGeometricMark size={64} variant="light" />
              </div>
              <div className="saina-modal-poster-copy">
                <p className="saina-modal-poster-kicker">İpek Yolu Yansıması</p>
                <p className="saina-modal-poster-headline saina-serif">Ölçülü keşif</p>
                <p className="saina-modal-poster-quote">
                  &ldquo;Bazen yolun kendisi, varılacak yerden daha çok şey öğretir.&rdquo;
                </p>
              </div>
              <p className="saina-modal-poster-meta">9:16 · SAINA Ayna</p>
            </div>
          </div>
        </div>

        <div className="saina-btn-row saina-modal-actions">
          <button type="button" className="saina-secondary-btn" disabled>
            <Share2 size={14} />
            {SAINA_SHARE}
          </button>
          <button type="button" className="saina-secondary-btn" disabled>
            <Download size={14} />
            {SAINA_DOWNLOAD}
          </button>
          <button type="button" className="saina-secondary-btn" disabled>
            <Sparkles size={14} />
            {SAINA_REGENERATE}
          </button>
        </div>
      </div>
    </div>
  );
}
