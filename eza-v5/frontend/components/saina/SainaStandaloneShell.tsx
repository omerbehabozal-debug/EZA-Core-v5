'use client';

import '@/styles/saina-mirror.css';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
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
  onRequestLogin?: () => void;
  onRequestMirror?: () => boolean;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  settingsDisabled?: boolean;
  /** Outer chrome + scene provided by SainaAppRootLayout. */
  embedded?: boolean;
};

function SainaChatSurface({
  heroTitle,
  isEmpty,
  messages,
  composer,
  onOpenCommandPalette,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled,
  onRequestMirror,
  onMobileMenu,
  showMobileMenu,
  onMirrorControlReady,
}: {
  heroTitle: string;
  isEmpty: boolean;
  messages: ReactNode;
  composer: ReactNode;
  onOpenCommandPalette: () => void;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  settingsDisabled?: boolean;
  onRequestMirror?: () => boolean;
  onMobileMenu?: () => void;
  showMobileMenu: boolean;
  onMirrorControlReady?: (openMirror: () => void) => void;
}) {
  const [mobileView, setMobileView] = useState<MobileView>('chat');
  const [mirrorCollapsed, setMirrorCollapsed] = useState(true);
  const showMessages = !isEmpty && messages != null;

  const tryOpenMirror = useCallback(() => {
    if (onRequestMirror && !onRequestMirror()) return;
    setMirrorCollapsed(false);
    setMobileView('mirror');
  }, [onRequestMirror]);

  useEffect(() => {
    onMirrorControlReady?.(tryOpenMirror);
  }, [onMirrorControlReady, tryOpenMirror]);

  return (
    <>
      <div
        className={cn(
          'saina-center-wrap',
          mirrorCollapsed && 'saina-center-wrap--mirror-collapsed'
        )}
      >
        <div className={cn('saina-chat-col', mobileView === 'chat' && 'saina-chat-col--visible')}>
          <div className="saina-main">
            {showMobileMenu ? (
              <div className="saina-standalone-mobile-bar">
                <button
                  type="button"
                  className="saina-standalone-menu-btn"
                  data-testid="saina-mobile-menu-btn"
                  onClick={onMobileMenu}
                  aria-label="Menü"
                >
                  <Menu size={20} />
                </button>
              </div>
            ) : null}
            <SainaPageTopBar
              onOpenCommandPalette={onOpenCommandPalette}
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
          <SainaStandaloneMirrorPanel showCollapse onCollapse={() => setMirrorCollapsed(true)} />
        </div>

        {mirrorCollapsed ? (
          <button
            type="button"
            className="saina-mirror-expand-pill"
            data-testid="saina-mirror-expand-pill"
            onClick={tryOpenMirror}
            aria-label={SAINA_MIRROR_EXPAND_LABEL}
          >
            <Sparkles size={18} className="saina-mirror-expand-sparkle" aria-hidden />
            <span className="saina-mirror-expand-label">{SAINA_MIRROR_EXPAND_TAB}</span>
          </button>
        ) : null}
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
          onClick={tryOpenMirror}
        >
          <Sparkles size={16} />
          Ayna
        </button>
      </nav>
    </>
  );
}

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
  onRequestLogin,
  onRequestMirror,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled = false,
  embedded = false,
}: SainaStandaloneShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isDesktopLayout = useMinWidth(SAINA_DESKTOP_SIDEBAR_MIN_PX);
  const openMobileSidebar = useSainaChromeStore((s) => s.openMobileSidebar);
  const openCommandPaletteFromStore = useSainaChromeStore((s) => s.openCommandPalette);
  const setChrome = useSainaChromeStore((s) => s.setChrome);
  const mirrorControlRef = useRef<() => void>(() => {});

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  useSainaCommandShortcut(embedded ? () => openCommandPaletteFromStore?.() : openCommandPalette);

  useLayoutEffect(() => {
    if (!embedded) return;
    setChrome({ onOpenMirror: () => mirrorControlRef.current() });
  }, [embedded, setChrome]);

  const handleCommandOpenMirror = useCallback(() => {
    mirrorControlRef.current();
  }, []);

  const chatSurface = (
    <SainaChatSurface
      heroTitle={heroTitle}
      isEmpty={isEmpty}
      messages={messages}
      composer={composer}
      onOpenCommandPalette={
        embedded ? () => openCommandPaletteFromStore?.() : openCommandPalette
      }
      safeOnlyMode={safeOnlyMode}
      onSafeOnlyModeChange={onSafeOnlyModeChange}
      analysisModelId={analysisModelId}
      onAnalysisModelChange={onAnalysisModelChange}
      settingsDisabled={settingsDisabled}
      onRequestMirror={onRequestMirror}
      onMobileMenu={
        embedded ? () => openMobileSidebar?.() : () => setMobileSidebarOpen(true)
      }
      showMobileMenu={!isDesktopLayout}
      onMirrorControlReady={(openMirror) => {
        mirrorControlRef.current = openMirror;
      }}
    />
  );

  if (embedded) {
    return chatSurface;
  }

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
              onRequestLogin={onRequestLogin}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              showMobileChrome={!isDesktopLayout}
            />
          </div>
          <div className="saina-main-col">
            <div className="saina-canvas">
              <SainaCinematicScene />
              {chatSurface}
            </div>
          </div>
        </div>
      </div>
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
