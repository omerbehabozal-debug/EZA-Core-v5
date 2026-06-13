'use client';

import '@/styles/saina-mirror.css';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Menu, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import type { SainaConversationItem } from '@/components/saina/SainaConversationSidebar';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from './SainaCommandPalette';
import SainaCinematicScene from './SainaCinematicScene';
import SainaHeroScene from './SainaHeroScene';
import SainaPageTopBar from './SainaPageTopBar';
import SainaStandaloneMirrorPanel from './SainaStandaloneMirrorPanel';

type MobileView = 'chat' | 'mirror';

const SAINA_DESKTOP_SIDEBAR_MIN_PX = 1024;

function useMinWidth(minWidth: number) {
  const [matches, setMatches] = useState(true);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [minWidth]);

  return matches;
}

export type SainaStandaloneShellProps = {
  heroTitle: string;
  isEmpty: boolean;
  messages: ReactNode;
  composer: ReactNode;
  conversations: SainaConversationItem[];
  activeChatId: string | null;
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onOpenPattern?: () => void;
  planTier?: SainaPlanTier;
  onUpgrade?: () => void;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  settingsDisabled?: boolean;
};

export default function SainaStandaloneShell({
  heroTitle,
  isEmpty,
  messages,
  composer,
  conversations,
  activeChatId,
  onNewChat,
  onSelectChat,
  onOpenPattern,
  planTier,
  onUpgrade,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled = false,
}: SainaStandaloneShellProps) {
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [mirrorCollapsed, setMirrorCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isDesktopLayout = useMinWidth(SAINA_DESKTOP_SIDEBAR_MIN_PX);

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  useSainaCommandShortcut(openCommandPalette);

  const handleCommandOpenMirror = useCallback(() => {
    setMirrorCollapsed(false);
    setMobileView('mirror');
  }, []);

  const showMessages = !isEmpty && messages != null;

  return (
    <div className="saina-page saina-standalone-shell" data-testid="saina-standalone-shell">
      <div className="saina-app-frame">
        <div className="saina-shell">
          <div className="saina-standalone-sidebar-wrap">
            <SainaConversationSidebar
              conversations={conversations}
              activeChatId={activeChatId}
              onNewChat={onNewChat}
              onSelectChat={onSelectChat}
              onOpenPattern={onOpenPattern}
              planTier={planTier}
              onUpgrade={onUpgrade}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              showMobileChrome={!isDesktopLayout}
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
                    {!isDesktopLayout ? (
                      <div className="saina-standalone-mobile-bar">
                        <button
                          type="button"
                          className="saina-standalone-menu-btn"
                          data-testid="saina-mobile-menu-btn"
                          onClick={() => setMobileSidebarOpen(true)}
                          aria-label="Menü"
                        >
                          <Menu size={20} />
                        </button>
                      </div>
                    ) : null}
                    <SainaPageTopBar
                      onOpenCommandPalette={openCommandPalette}
                      safeOnlyMode={safeOnlyMode}
                      onSafeOnlyModeChange={onSafeOnlyModeChange}
                      analysisModelId={analysisModelId}
                      onAnalysisModelChange={onAnalysisModelChange}
                      settingsDisabled={settingsDisabled}
                    />
                    <div className="saina-main-body" data-testid="saina-main-body">
                      <SainaHeroScene title={heroTitle} />

                      <div className="saina-chat-column" data-testid="saina-chat-column">
                        {showMessages ? (
                          <div className="saina-chat-float">
                            <div
                              className="saina-chat-card saina-chat-card--growth"
                              data-testid="saina-chat-card"
                            >
                              <div
                                className="saina-standalone-messages-scroll"
                                data-testid="saina-chat-messages-scroll"
                              >
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

      <SainaCommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        conversations={conversations}
        onNewChat={onNewChat}
        onSelectChat={onSelectChat}
        onOpenMirror={handleCommandOpenMirror}
        onOpenPattern={onOpenPattern}
      />
    </div>
  );
}
