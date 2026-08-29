'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EZA_INFO_DRAWER_SECTIONS } from '@/lib/eza/ezaPatternCopy';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function EzaInfoDrawer({ open, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="saina-eza-drawer-root" data-testid="saina-eza-info-drawer">
      <button
        type="button"
        className="saina-eza-drawer-scrim"
        aria-label="EZA bilgi panelini kapat"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        className="saina-eza-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saina-eza-drawer-title"
        tabIndex={-1}
      >
        <div className="saina-eza-drawer-header">
          <p id="saina-eza-drawer-title" className="saina-eza-drawer-kicker">
            EZA
          </p>
          <button
            type="button"
            className="saina-eza-drawer-close saina-pattern-close-btn"
            onClick={onClose}
            aria-label="Kapat"
            data-testid="saina-eza-info-drawer-close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="saina-eza-drawer-body">
          {EZA_INFO_DRAWER_SECTIONS.map((section) => (
            <section key={section.title} className="saina-eza-drawer-section">
              <h2
                className={cn(
                  'saina-eza-drawer-heading',
                  section.title === 'EZA nedir?' && 'saina-eza-drawer-heading--primary'
                )}
              >
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="saina-eza-drawer-paragraph">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
