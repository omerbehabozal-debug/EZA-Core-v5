'use client';

import '@/styles/saina-mirror.css';
import { useCallback, useState } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAINA_MIRROR_EXPAND_LABEL,
  SAINA_MIRROR_EXPAND_TAB,
  SAINA_MIRROR_READY_BADGE,
} from '@/lib/eza/sainaCopy';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaConversationMain from '@/components/saina/SainaConversationMain';
import ConversationMirrorPanel, {
  type MirrorPanelStatus,
} from '@/components/saina/ConversationMirrorPanel';
type MobileView = 'chat' | 'mirror';

/**
 * Sprint A — SAINA Conversation Mirror static mock.
 * Styles: styles/saina-mirror.css (via dev layout).
 */
export default function SainaConversationMockPage() {
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [mirrorCollapsed, setMirrorCollapsed] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<MirrorPanelStatus>('empty');

  const handleMirrorStatusChange = useCallback((status: MirrorPanelStatus) => {
    setMirrorStatus(status);
  }, []);

  return (
    <div className="saina-page">
      <div className="saina-app-frame">
        <div className="saina-shell">
          <SainaConversationSidebar />

          <div className="saina-main-col">
            <div className="saina-canvas">
              <SainaCinematicScene />

              <div
                className={cn(
                  'saina-center-wrap',
                  mirrorCollapsed && 'saina-center-wrap--mirror-collapsed'
                )}
              >
                <div
                  className={cn(
                    'saina-chat-col',
                    mobileView === 'chat' && 'saina-chat-col--visible'
                  )}
                >
                  <SainaConversationMain />
                </div>

                <div
                  className={cn(
                    'saina-mirror-col',
                    mobileView === 'mirror' && 'saina-mirror-col--visible',
                    mirrorCollapsed ? 'saina-mirror-col--collapsed' : 'saina-mirror-col--open'
                  )}
                >
                  <ConversationMirrorPanel
                    showCollapse
                    onCollapse={() => setMirrorCollapsed(true)}
                    onStatusChange={handleMirrorStatusChange}
                  />
                </div>

                {mirrorCollapsed ? (
                  <button
                    type="button"
                    className="saina-mirror-expand-pill"
                    data-testid="saina-mirror-expand-pill"
                    onClick={() => setMirrorCollapsed(false)}
                    aria-label={SAINA_MIRROR_EXPAND_LABEL}
                  >
                    <Sparkles size={18} className="saina-mirror-expand-sparkle" aria-hidden />
                    <span className="saina-mirror-expand-label">{SAINA_MIRROR_EXPAND_TAB}</span>
                    {mirrorStatus === 'ready' ? (
                      <span className="saina-mirror-ready-pill">{SAINA_MIRROR_READY_BADGE}</span>
                    ) : null}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      </div>

      <nav className="saina-mobile-tabs" aria-label="Mobil görünüm">
        <button
          type="button"
          className={cn(
            'saina-mobile-tab',
            mobileView === 'chat' && 'saina-mobile-tab--active'
          )}
          onClick={() => setMobileView('chat')}
        >
          <MessageSquare size={16} />
          Sohbet
        </button>
        <button
          type="button"
          className={cn(
            'saina-mobile-tab',
            mobileView === 'mirror' && 'saina-mobile-tab--active'
          )}
          onClick={() => setMobileView('mirror')}
        >
          <Sparkles size={16} />
          Ayna
          {mirrorStatus === 'ready' ? (
            <span className="saina-mobile-tab-badge">{SAINA_MIRROR_READY_BADGE}</span>
          ) : null}
        </button>
      </nav>
    </div>
  );
}
