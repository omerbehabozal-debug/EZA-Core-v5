'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Minus, Plus } from 'lucide-react';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { useYansiExperienceSession } from './YansiExperienceSession';

/** Desktop public replay only. A non-modal popover, with no layout or replay ownership. */
export default function YansiReadingSettings({ onOpen, activeIdentity }: { onOpen?: () => void; activeIdentity?: string }) {
  const session = useYansiExperienceSession();
  const desktop = useSainaCompactShell();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  useEffect(() => { setOpen(false); }, [desktop, session?.slug, activeIdentity]);

  useLayoutEffect(() => {
    if (!open || !desktop) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      const gap = 12;
      setPosition({
        left: Math.max(gap, Math.min(anchor.left - box.width - gap, window.innerWidth - box.width - gap)),
        top: Math.max(gap, Math.min(anchor.bottom - box.height, window.innerHeight - box.height - gap)),
      });
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (panel.current) observer?.observe(panel.current);
    if (trigger.current) observer?.observe(trigger.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, desktop]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);

  if (!desktop || !session) return null;
  const { reading, setReading } = session;
  const adjust = (value: number) => setReading({ ...reading, fontSize: Math.max(16, Math.min(24, value)) });
  return <>
    <button ref={trigger} type="button" className="yansi-exp-rail__btn yansi-reading-trigger"
      data-testid="yansi-reading-trigger" data-active={open || reading.mode === 'editorial' ? 'true' : 'false'}
      aria-label="Okuma ayarları" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { if (open) close(true); else { onOpen?.(); setOpen(true); } }}>
      <span aria-hidden="true">Aa</span>
    </button>
    {open && createPortal(<div ref={panel} id={id} className="yansi-reading-panel" role="dialog" aria-labelledby={titleId}
      data-testid="yansi-reading-panel" style={position}
      onWheel={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(false);
      }}>
      <h2 id={titleId}><BookOpen size={18} aria-hidden="true" />Okuma Ayarları</h2>
      <fieldset><legend>Okuma biçimi</legend><div className="yansi-reading-segment">
        {(['standard', 'editorial'] as const).map((mode) => <button key={mode} type="button" aria-pressed={reading.mode === mode}
          onClick={() => {
            if (reading.mode === mode) return;
            const untouchedDefaults = reading.mode === 'standard'
              ? reading.fontSize === 16 && reading.spacing === 'normal'
              : reading.fontSize === 18 && reading.spacing === 'roomy';
            setReading(untouchedDefaults
              ? { mode, fontSize: mode === 'editorial' ? 18 : 16, spacing: mode === 'editorial' ? 'roomy' : 'normal' }
              : { ...reading, mode });
          }}>{mode === 'editorial' ? 'Editoryal' : 'Standart'}</button>)}
      </div></fieldset>
      <fieldset><legend>Yazı boyutu <span>{reading.fontSize} px</span></legend>
        <div className="yansi-reading-size">
          <button type="button" aria-label="Yazıyı küçült" disabled={reading.fontSize === 16} onClick={() => adjust(reading.fontSize - 1)}><Minus size={16} aria-hidden="true" /></button>
          <input type="range" min={16} max={24} step={1} value={reading.fontSize} aria-label="Yazı boyutu"
            aria-valuetext={`${reading.fontSize} piksel`} onChange={(event) => adjust(Number(event.target.value))} />
          <button type="button" aria-label="Yazıyı büyüt" disabled={reading.fontSize === 24} onClick={() => adjust(reading.fontSize + 1)}><Plus size={16} aria-hidden="true" /></button>
        </div>
      </fieldset>
      <fieldset><legend>Metin ferahlığı</legend><div className="yansi-reading-segment">
        {(['normal', 'roomy'] as const).map((spacing) => <button key={spacing} type="button" aria-pressed={reading.spacing === spacing}
          onClick={() => setReading({ ...reading, spacing })}>{spacing === 'roomy' ? 'Ferah' : 'Normal'}</button>)}
      </div></fieldset>
    </div>, document.body)}
  </>;
}
