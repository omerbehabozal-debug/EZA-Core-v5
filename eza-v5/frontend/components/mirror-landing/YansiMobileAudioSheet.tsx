'use client';

/**
 * Mobile public /m audio sheet — only exposes capabilities that exist today:
 * - speechSynthesis listen toggle (audioOn)
 * - reveal rhythm (calm / normal / fast)
 * No language / voice / playback-speed controls (unsupported).
 */

import { useEffect, useId, useRef } from 'react';
import { X, Volume2 } from 'lucide-react';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { useYansiExperienceSession } from '@/components/mirror-landing/YansiExperienceSession';
import {
  YANSI_RHYTHM_IDS,
  YANSI_RHYTHM_LABELS,
  type YansiRhythmId,
} from '@/lib/eza/mirror/yansiRhythm';

export type YansiMobileAudioSheetProps = {
  open: boolean;
  onClose: () => void;
};

export default function YansiMobileAudioSheet({ open, onClose }: YansiMobileAudioSheetProps) {
  const session = useYansiExperienceSession();
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

  if (!open || !session) return null;

  return (
    <div className="yansi-mobile-audio-sheet-root" data-testid="yansi-mobile-audio-sheet" role="presentation">
      <button
        type="button"
        className="yansi-mobile-audio-sheet-backdrop"
        aria-label="Ses panelini kapat"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="yansi-mobile-audio-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="yansi-mobile-audio-sheet-panel"
      >
        <div className="yansi-mobile-audio-sheet-handle" aria-hidden>
          <span className="yansi-mobile-audio-sheet-handle-bar" />
        </div>
        <div className="yansi-mobile-audio-sheet-chrome">
          <h2 id={titleId} className="yansi-mobile-audio-sheet-title">
            Yansı&apos;yı dinle
          </h2>
          <button
            type="button"
            ref={closeRef}
            className="yansi-mobile-audio-sheet-close"
            aria-label="Kapat"
            data-testid="yansi-mobile-audio-sheet-close"
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="yansi-mobile-audio-sheet-body">
          {session.speechSupported ? (
            <button
              type="button"
              className="yansi-mobile-audio-sheet-primary"
              data-testid="yansi-mobile-audio-toggle"
              data-active={session.audioOn ? 'true' : 'false'}
              aria-pressed={session.audioOn}
              onClick={() => {
                const next = !session.audioOn;
                session.setAudioOn(next);
                if (next) onClose();
              }}
            >
              <Volume2 size={18} aria-hidden />
              {session.audioOn ? 'Dinlemeyi durdur' : 'Dinlemeyi başlat'}
            </button>
          ) : (
            <p className="yansi-mobile-audio-sheet-note" data-testid="yansi-mobile-audio-unsupported">
              Bu cihazda sesli okuma desteklenmiyor.
            </p>
          )}

          <div className="yansi-mobile-audio-sheet-section">
            <p className="yansi-mobile-audio-sheet-label">Ritim</p>
            <div className="yansi-mobile-audio-sheet-rhythm" role="listbox" aria-label="Ritim">
              {YANSI_RHYTHM_IDS.map((id: YansiRhythmId) => {
                const selected = session.rhythm === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="yansi-mobile-audio-sheet-rhythm-btn"
                    data-testid={`yansi-mobile-audio-rhythm-${id}`}
                    data-selected={selected ? 'true' : 'false'}
                    onClick={() => session.setRhythm(id)}
                  >
                    {YANSI_RHYTHM_LABELS[id]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
