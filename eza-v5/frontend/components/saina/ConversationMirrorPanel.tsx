'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  PanelRightClose,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  SAINA_CHECKLIST,
  SAINA_CREATE_MIRROR,
  SAINA_DOWNLOAD,
  SAINA_EMPTY_TEASER_BODY,
  SAINA_EMPTY_TEASER_TITLE,
  SAINA_EMPTY_TITLE,
  SAINA_GENERATING,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_HOW_LABEL,
  SAINA_MIRROR_SUBTITLE,
  SAINA_MIRROR_TITLE,
  SAINA_OPEN_PREVIEW,
  SAINA_READY_POSTER_INSIGHT,
  SAINA_READY_POSTER_TITLE,
  SAINA_READY_TITLE,
  SAINA_REGENERATE,
  SAINA_SHARE,
  SAINA_UPSELL_BODY,
  SAINA_UPSELL_CTA,
  SAINA_UPSELL_TITLE,
} from '@/lib/eza/sainaCopy';
import SainaGeometricMark from './SainaGeometricMark';
import MirrorFullScreenModal from './MirrorFullScreenModal';

export type MirrorPanelStatus = 'empty' | 'generating' | 'ready';

const GENERATING_MS = 2500;

type ConversationMirrorPanelProps = {
  showCollapse?: boolean;
  onCollapse?: () => void;
  onStatusChange?: (status: MirrorPanelStatus) => void;
};

export default function ConversationMirrorPanel({
  showCollapse = false,
  onCollapse,
  onStatusChange,
}: ConversationMirrorPanelProps) {
  const [status, setStatus] = useState<MirrorPanelStatus>('empty');
  const [modalOpen, setModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleCreate = () => {
    if (status === 'generating') return;
    clearTimer();
    setStatus('generating');
    timerRef.current = setTimeout(() => {
      setStatus('ready');
      timerRef.current = null;
    }, GENERATING_MS);
  };

  const handleRegenerate = () => {
    setModalOpen(false);
    handleCreate();
  };

  return (
    <>
      <aside className="saina-mirror-panel" aria-label="Conversation Mirror">
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
                  <PanelRightClose size={16} />
                </button>
              ) : null}
            </div>
            <p className="saina-mirror-subtitle">{SAINA_MIRROR_SUBTITLE}</p>
          </header>

          {status === 'empty' ? (
            <>
              <div className="saina-mirror-dotted-card">
                <div className="saina-mirror-icon-wrap">
                  <SainaGeometricMark size={80} variant="gold" />
                </div>
                <p className="saina-mirror-empty-title">{SAINA_EMPTY_TITLE}</p>
                <p className="saina-mirror-teaser-title saina-serif">{SAINA_EMPTY_TEASER_TITLE}</p>
                <p className="saina-mirror-teaser-body">{SAINA_EMPTY_TEASER_BODY}</p>
                <button type="button" className="saina-primary-btn" onClick={handleCreate}>
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
            </>
          ) : null}

          {status === 'generating' ? (
            <div className="saina-mirror-dotted-card saina-mirror-dotted-card--busy">
              <div className="saina-mirror-icon-wrap">
                <Loader2 size={44} className="saina-spin" color="#0F3D32" aria-hidden />
              </div>
              <p className="saina-mirror-generating">{SAINA_GENERATING}</p>
              <ul className="saina-checklist saina-checklist--elegant">
                {SAINA_CHECKLIST.map((item) => (
                  <li key={item}>
                    <Check size={14} className="saina-check-icon" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status === 'ready' ? (
            <div className="saina-ready-card">
              <p className="saina-ready-badge">
                <Sparkles size={16} className="saina-btn-sparkle" aria-hidden />
                {SAINA_READY_TITLE}
              </p>
              <div className="saina-preview-thumb">
                <div className="saina-preview-thumb-inner">
                  <SainaGeometricMark size={44} variant="light" />
                  <p className="saina-preview-thumb-title saina-serif">
                    {SAINA_READY_POSTER_TITLE}
                  </p>
                  <p className="saina-preview-thumb-insight">{SAINA_READY_POSTER_INSIGHT}</p>
                </div>
              </div>
              <button
                type="button"
                className="saina-primary-btn"
                onClick={() => setModalOpen(true)}
              >
                {SAINA_OPEN_PREVIEW}
              </button>
              <div className="saina-btn-row">
                <button type="button" className="saina-secondary-btn" disabled>
                  <Share2 size={14} />
                  {SAINA_SHARE}
                </button>
                <button type="button" className="saina-secondary-btn" disabled>
                  <Download size={14} />
                  {SAINA_DOWNLOAD}
                </button>
              </div>
              <button
                type="button"
                className="saina-secondary-btn saina-secondary-btn--full"
                onClick={handleRegenerate}
              >
                <Sparkles size={14} />
                {SAINA_REGENERATE}
              </button>
            </div>
          ) : null}

          <div className="saina-upsell-card">
            <p className="saina-upsell-title">{SAINA_UPSELL_TITLE}</p>
            <p className="saina-upsell-body">{SAINA_UPSELL_BODY}</p>
            <button type="button" className="saina-upsell-btn" disabled>
              {SAINA_UPSELL_CTA}
            </button>
          </div>
        </div>
      </aside>

      <MirrorFullScreenModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
