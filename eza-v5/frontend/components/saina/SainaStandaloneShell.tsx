'use client';

import '@/styles/saina-mirror.css';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_MIRROR_EXPAND_LABEL, SAINA_MIRROR_EXPAND_TAB } from '@/lib/eza/sainaCopy';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import {
  DEFAULT_MIRROR_MOBILE_CONTEXT,
  type MirrorMobileContext,
} from '@/lib/eza/mirrorMobileState';
import type { SainaConversationItem } from '@/components/saina/SainaConversationSidebar';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from './SainaCommandPalette';
import SainaCinematicScene from './SainaCinematicScene';
import SainaHeroScene from './SainaHeroScene';
import SainaMobileMirrorRail from './SainaMobileMirrorRail';
import SainaPageTopBar from './SainaPageTopBar';
import SainaStandaloneMirrorPanel from './SainaStandaloneMirrorPanel';

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
  mirrorMobileContext?: MirrorMobileContext;
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
  isCompactShell,
  mirrorMobileContext,
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
  isCompactShell: boolean;
  mirrorMobileContext: MirrorMobileContext;
}) {
  const [mirrorCollapsed, setMirrorCollapsed] = useState(true);
  const showMessages = !isEmpty && messages != null;

  const tryOpenMirror = useCallback(() => {
    if (onRequestMirror && !onRequestMirror()) return;
    setMirrorCollapsed(false);
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
        <div className="saina-chat-col saina-chat-col--visible">
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
              <div
                className={cn(
                  'saina-chat-column',
                  !isCompactShell && 'saina-chat-column--mobile-rail'
                )}
                data-testid="saina-chat-column"
              >
                <div className="saina-chat-scroll-region">
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
                </div>

                <div className="saina-chat-bottom-anchor" data-testid="saina-chat-bottom-anchor">
                  {!isCompactShell ? (
                    <SainaMobileMirrorRail
                      context={mirrorMobileContext}
                      panelOpen={!mirrorCollapsed}
                      onOpen={tryOpenMirror}
                      onCollapse={() => setMirrorCollapsed(true)}
                    />
                  ) : null}
                  <div className="saina-composer-zone saina-standalone-composer">{composer}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isCompactShell ? (
          <div
            className={cn(
              'saina-mirror-col',
              mirrorCollapsed ? 'saina-mirror-col--collapsed' : 'saina-mirror-col--open'
            )}
          >
            <SainaStandaloneMirrorPanel showCollapse onCollapse={() => setMirrorCollapsed(true)} />
          </div>
        ) : null}

        {isCompactShell && mirrorCollapsed ? (
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
  mirrorMobileContext = DEFAULT_MIRROR_MOBILE_CONTEXT,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled = false,
  embedded = false,
}: SainaStandaloneShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isCompactShell = useSainaCompactShell();
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
      mirrorMobileContext={mirrorMobileContext}
      onMobileMenu={
        embedded ? () => openMobileSidebar?.() : () => setMobileSidebarOpen(true)
      }
      showMobileMenu={!isCompactShell}
      isCompactShell={isCompactShell}
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
              showMobileChrome={!isCompactShell}
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
