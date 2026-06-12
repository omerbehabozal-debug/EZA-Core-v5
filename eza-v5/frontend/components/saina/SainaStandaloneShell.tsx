'use client';

import '@/styles/saina-mirror.css';

import { useState, type ReactNode } from 'react';
import { Menu, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import StandaloneSidebar from '@/components/standalone/StandaloneSidebar';
import SainaCinematicScene from './SainaCinematicScene';
import SainaHeroScene from './SainaHeroScene';
import SainaPageTopBar from './SainaPageTopBar';
import SainaStandaloneMirrorPanel from './SainaStandaloneMirrorPanel';

type MobileView = 'chat' | 'mirror';

export type SainaStandaloneShellProps = {
  heroTitle: string;
  isEmpty: boolean;
  messages: ReactNode;
  composer: ReactNode;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  hasActiveChat?: boolean;
  onNewChat?: () => void;
};

export default function SainaStandaloneShell({
  heroTitle,
  isEmpty,
  messages,
  composer,
  safeOnlyMode,
  onSafeOnlyModeChange,
  hasActiveChat = false,
  onNewChat,
}: SainaStandaloneShellProps) {
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [mirrorCollapsed, setMirrorCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const showMessages = !isEmpty && messages != null;

  return (
    <div className="saina-page saina-standalone-shell" data-testid="saina-standalone-shell">
      <div className="saina-app-frame">
        <div className="saina-shell">
          <div className="saina-standalone-sidebar-wrap">
            <StandaloneSidebar
              safeOnlyMode={safeOnlyMode}
              onSafeOnlyModeChange={onSafeOnlyModeChange}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              hasActiveChat={hasActiveChat}
              onNewChat={onNewChat}
            />
          </div>

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
                  <div className="saina-main">
                    <div className="saina-standalone-mobile-bar lg:hidden">
                      <button
                        type="button"
                        className="saina-standalone-menu-btn"
                        onClick={() => setMobileSidebarOpen(true)}
                        aria-label="Menü"
                      >
                        <Menu size={20} />
                      </button>
                    </div>
                    <SainaPageTopBar />
                    <div className="saina-main-body" data-testid="saina-main-body">
                      <SainaHeroScene title={heroTitle} />

                      <div className="saina-chat-column" data-testid="saina-chat-column">
                        {showMessages ? (
                          <div className="saina-chat-float">
                            <div className="saina-chat-card" data-testid="saina-chat-card">
                              <div className="saina-chat-messages saina-standalone-messages">
                                {messages}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="saina-composer-zone saina-standalone-composer">{composer}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    'saina-mirror-col',
                    mobileView === 'mirror' && 'saina-mirror-col--visible',
                    mirrorCollapsed ? 'saina-mirror-col--collapsed' : 'saina-mirror-col--open'
                  )}
                >
                  <SainaStandaloneMirrorPanel
                    showCollapse
                    onCollapse={() => setMirrorCollapsed(true)}
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
          className={cn('saina-mobile-tab', mobileView === 'chat' && 'saina-mobile-tab--active')}
          onClick={() => setMobileView('chat')}
        >
          <MessageSquare size={16} />
          Sohbet
        </button>
        <button
          type="button"
          className={cn('saina-mobile-tab', mobileView === 'mirror' && 'saina-mobile-tab--active')}
          onClick={() => setMobileView('mirror')}
        >
          <Sparkles size={16} />
          Ayna
        </button>
      </nav>
    </div>
  );
}
