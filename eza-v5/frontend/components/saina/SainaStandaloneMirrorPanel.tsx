'use client';

import { Check, PanelRightClose, Sparkles } from 'lucide-react';
import {
  SAINA_CHECKLIST,
  SAINA_CREATE_MIRROR,
  SAINA_EMPTY_TEASER_BODY,
  SAINA_EMPTY_TEASER_TITLE,
  SAINA_EMPTY_TITLE,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_HOW_LABEL,
  SAINA_MIRROR_SUBTITLE,
  SAINA_MIRROR_TITLE,
  SAINA_UPSELL_BODY,
  SAINA_UPSELL_CTA,
  SAINA_UPSELL_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaGeometricMark from './SainaGeometricMark';

type SainaStandaloneMirrorPanelProps = {
  showCollapse?: boolean;
  onCollapse?: () => void;
};

/** UI-only mirror panel for production /standalone — visual parity with mock empty state (Sprint B.2A). */
export default function SainaStandaloneMirrorPanel({
  showCollapse = false,
  onCollapse,
}: SainaStandaloneMirrorPanelProps) {
  return (
    <aside
      className="saina-mirror-panel"
      aria-label="Conversation Mirror"
      data-testid="saina-standalone-mirror-panel"
    >
      <div className="saina-mirror-inner">
        <header className="saina-mirror-header">
          <div className="saina-mirror-header-top">
            <div className="saina-mirror-header-row">
              <Sparkles size={18} className="saina-mirror-sparkle" aria-hidden />
              <h2 className="saina-mirror-title saina-serif">{SAINA_MIRROR_TITLE}</h2>
            </div>
            {showCollapse && onCollapse ? (
              <button
                type="button"
                className="saina-mirror-collapse-btn"
                onClick={onCollapse}
                aria-label={SAINA_MIRROR_COLLAPSE_LABEL}
                title={SAINA_MIRROR_COLLAPSE_LABEL}
              >
                <PanelRightClose size={16} aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="saina-mirror-subtitle">{SAINA_MIRROR_SUBTITLE}</p>
        </header>

        <div className="saina-mirror-dotted-card">
          <div className="saina-mirror-icon-wrap">
            <SainaGeometricMark size={80} variant="gold" />
          </div>
          <p className="saina-mirror-empty-title">{SAINA_EMPTY_TITLE}</p>
          <p className="saina-mirror-teaser-title saina-serif">{SAINA_EMPTY_TEASER_TITLE}</p>
          <p className="saina-mirror-teaser-body">{SAINA_EMPTY_TEASER_BODY}</p>
          <button
            type="button"
            className="saina-primary-btn"
            disabled
            aria-disabled="true"
          >
            <Sparkles size={18} className="saina-btn-sparkle" aria-hidden />
            {SAINA_CREATE_MIRROR}
          </button>
        </div>

        <div className="saina-mirror-how">
          <p className="saina-mirror-how-label">{SAINA_MIRROR_HOW_LABEL}</p>
          <ul className="saina-checklist saina-checklist--elegant">
            {SAINA_CHECKLIST.map((item) => (
              <li key={item}>
                <Check size={14} className="saina-check-icon" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="saina-upsell-card">
          <p className="saina-upsell-title">{SAINA_UPSELL_TITLE}</p>
          <p className="saina-upsell-body">{SAINA_UPSELL_BODY}</p>
          <button type="button" className="saina-upsell-btn" disabled>
            {SAINA_UPSELL_CTA}
          </button>
        </div>
      </div>
    </aside>
  );
}
