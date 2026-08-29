'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  EZA_INFO_CONTRIBUTION,
  EZA_INFO_FOOTER_DOMAIN,
  EZA_INFO_FOOTER_LABEL,
  EZA_INFO_FOOTER_URL,
  EZA_INFO_WHAT_IS,
  EZA_INFO_WHAT_YOU_SEE,
} from '@/lib/eza/ezaPatternCopy';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function EzaInfoCard({ open, onClose }: Props) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    setEntered(false);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        'saina-eza-info-card-wrap',
        entered && !closing && 'saina-eza-info-card-wrap--open',
        closing && 'saina-eza-info-card-wrap--closing'
      )}
      data-testid="saina-eza-info-card"
    >
      <article
        className="saina-eza-info-card"
        role="region"
        aria-labelledby="saina-eza-info-card-title"
      >
        <button
          type="button"
          className="saina-eza-info-card__close"
          onClick={onClose}
          aria-label="Kapat"
          data-testid="saina-eza-info-card-close"
        >
          ×
        </button>

        <section className="saina-eza-info-card__primary">
          <h2 id="saina-eza-info-card-title" className="saina-eza-info-card__heading--primary">
            {EZA_INFO_WHAT_IS.title}
          </h2>
          {EZA_INFO_WHAT_IS.paragraphs.map((paragraph) => (
            <p key={paragraph} className="saina-eza-info-card__body">
              {paragraph}
            </p>
          ))}
        </section>

        <div className="saina-eza-info-card__columns">
          <section>
            <h3 className="saina-eza-info-card__heading">{EZA_INFO_CONTRIBUTION.title}</h3>
            {EZA_INFO_CONTRIBUTION.paragraphs.map((paragraph) => (
              <p key={paragraph} className="saina-eza-info-card__body">
                {paragraph}
              </p>
            ))}
          </section>
          <section>
            <h3 className="saina-eza-info-card__heading">{EZA_INFO_WHAT_YOU_SEE.title}</h3>
            {EZA_INFO_WHAT_YOU_SEE.paragraphs.map((paragraph) => (
              <p key={paragraph} className="saina-eza-info-card__body">
                {paragraph}
              </p>
            ))}
          </section>
        </div>

        <footer className="saina-eza-info-card__footer">
          <a
            href={EZA_INFO_FOOTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="saina-eza-info-card__footer-link"
          >
            <span className="saina-eza-info-card__footer-label">{EZA_INFO_FOOTER_LABEL}</span>
            <span className="saina-eza-info-card__footer-domain">{EZA_INFO_FOOTER_DOMAIN}</span>
          </a>
        </footer>
      </article>
    </div>
  );
}
