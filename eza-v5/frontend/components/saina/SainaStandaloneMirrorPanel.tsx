'use client';

import { PanelRightClose, Sparkles } from 'lucide-react';
import {
  SAINA_CREATE_MIRROR,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_SUBTITLE,
  SAINA_MIRROR_TITLE,
  SAINA_STANDALONE_MIRROR_PLACEHOLDER_BODY,
  SAINA_STANDALONE_MIRROR_PLACEHOLDER_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaGeometricMark from './SainaGeometricMark';

type SainaStandaloneMirrorPanelProps = {
  showCollapse?: boolean;
  onCollapse?: () => void;
};

/** UI-only mirror panel for production /standalone — no generate API (Sprint B.1). */
export default function SainaStandaloneMirrorPanel({
  showCollapse = false,
  onCollapse,
}: SainaStandaloneMirrorPanelProps) {
  return (
    <aside className="saina-mirror-panel" aria-label="Conversation Mirror" data-testid="saina-standalone-mirror-panel">
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

        <div className="saina-mirror-empty-card">
          <div className="saina-mirror-icon-wrap">
            <SainaGeometricMark size={36} variant="gold" />
          </div>
          <p className="saina-mirror-empty-title">{SAINA_STANDALONE_MIRROR_PLACEHOLDER_TITLE}</p>
          <p className="saina-mirror-cta-note">{SAINA_STANDALONE_MIRROR_PLACEHOLDER_BODY}</p>
          <button type="button" className="saina-mirror-primary-btn" disabled aria-disabled="true">
            <Sparkles size={16} aria-hidden />
            {SAINA_CREATE_MIRROR}
          </button>
        </div>
      </div>
    </aside>
  );
}
