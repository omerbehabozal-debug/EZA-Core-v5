'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Volume2, Waves } from 'lucide-react';
import { useYansiExperienceSession } from '@/components/mirror-landing/YansiExperienceSession';
import {
  YANSI_RHYTHM_IDS,
  YANSI_RHYTHM_LABELS,
  type YansiRhythmId,
} from '@/lib/eza/mirror/yansiRhythm';

/**
 * Desktop-only Yansı experience control: Audio + Rhythm. Not an app toolbar.
 */
export default function YansiExperienceControls() {
  const session = useYansiExperienceSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const closePopover = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closePopover();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopover();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closePopover]);

  if (!session) return null;

  const rhythmLabel = YANSI_RHYTHM_LABELS[session.rhythm];

  return (
    <aside
      className="yansi-exp-rail"
      data-testid="yansi-experience-controls"
      data-yansi-experience-rail="true"
      aria-label="Yansı deneyim kontrolleri"
    >
      {session.speechSupported ? (
        <button
          type="button"
          className="yansi-exp-rail__btn"
          data-testid="yansi-experience-audio"
          data-active={session.audioOn ? 'true' : 'false'}
          aria-label={session.audioOn ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}
          aria-pressed={session.audioOn}
          title="Sesli okuma"
          onClick={() => session.setAudioOn(!session.audioOn)}
        >
          <Volume2 className="yansi-exp-rail__icon" size={21} strokeWidth={1.6} aria-hidden />
        </button>
      ) : null}

      <div className="yansi-exp-rail__rhythm-wrap" ref={wrapRef}>
        <button
          type="button"
          ref={triggerRef}
          className="yansi-exp-rail__btn"
          data-testid="yansi-experience-rhythm"
          data-active={open ? 'true' : 'false'}
          aria-label={`Ritim: ${rhythmLabel}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          title={`Ritim: ${rhythmLabel}`}
          onClick={() => setOpen((v) => !v)}
        >
          <Waves className="yansi-exp-rail__icon" size={21} strokeWidth={1.6} aria-hidden />
        </button>
        {open ? (
          <div
            id={listId}
            className="yansi-exp-rail__popover"
            role="listbox"
            aria-label="Ritim"
            data-testid="yansi-experience-rhythm-menu"
          >
            <p className="yansi-exp-rail__popover-title">Ritim</p>
            {YANSI_RHYTHM_IDS.map((id: YansiRhythmId) => {
              const selected = session.rhythm === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="yansi-exp-rail__option"
                  data-testid={`yansi-experience-rhythm-${id}`}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => {
                    session.setRhythm(id);
                    closePopover();
                  }}
                >
                  <span className="yansi-exp-rail__radio" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                  {YANSI_RHYTHM_LABELS[id]}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
