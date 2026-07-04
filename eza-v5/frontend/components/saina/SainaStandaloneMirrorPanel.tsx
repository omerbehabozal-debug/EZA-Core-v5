'use client';

import { useMemo } from 'react';
import { Check, PanelRightClose, Sparkles } from 'lucide-react';
import {
  SAINA_CHECKLIST,
  SAINA_MIRROR_COLLAPSE_LABEL,
  SAINA_MIRROR_HOW_LABEL,
  SAINA_MIRROR_TITLE,
} from '@/lib/eza/sainaCopy';
import { resolveMirrorPanelCopyForChat } from '@/lib/eza/mirror/resolveMirrorPanelCopy';
import { getChatArchive } from '@/lib/standaloneChatArchive';
import { useMirrorEntries, useActiveConversationMirrorId } from '@/components/standalone/MirrorEntriesContext';
import StandaloneObservationExperience from '@/components/standalone/StandaloneObservationExperience';

type SainaStandaloneMirrorPanelProps = {
  showCollapse?: boolean;
  onCollapse?: () => void;
};

/** Conversation mirror — wired to behavioral history + scene generation pipeline. */
export default function SainaStandaloneMirrorPanel({
  showCollapse = false,
  onCollapse,
}: SainaStandaloneMirrorPanelProps) {
  const entries = useMirrorEntries();
  const conversationId = useActiveConversationMirrorId();

  const mirrorPanelCopy = useMemo(() => {
    const chat = conversationId ? getChatArchive(conversationId) : null;
    return resolveMirrorPanelCopyForChat(chat);
  }, [conversationId]);

  return (
    <aside
      className="saina-mirror-panel"
      aria-label={SAINA_MIRROR_TITLE}
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
          <p className="saina-mirror-subtitle">{mirrorPanelCopy.panelSubtitle}</p>
        </header>

        <div className="saina-mirror-panel-experience">
          <StandaloneObservationExperience
            entries={entries}
            embedded
            conversationId={conversationId ?? undefined}
            mirrorPanelCopy={mirrorPanelCopy}
          />
        </div>

        <div className="saina-mirror-how saina-mirror-how--compact">
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
      </div>
    </aside>
  );
}
