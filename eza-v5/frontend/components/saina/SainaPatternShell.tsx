'use client';

import '@/styles/saina-mirror.css';
import '@/styles/saina-pattern.css';

import { useCallback, useState } from 'react';
import { Menu } from 'lucide-react';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import type { SainaConversationItem } from '@/components/saina/SainaConversationSidebar';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from '@/components/saina/SainaCommandPalette';
import SainaCinematicScene from '@/components/saina/SainaCinematicScene';
import SainaPageTopBar from '@/components/saina/SainaPageTopBar';

export type SainaPatternShellProps = {
  children: React.ReactNode;
  conversations: SainaConversationItem[];
  activeChatId?: string | null;
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onOpenPattern?: () => void;
  planTier?: SainaPlanTier;
  onUpgrade?: () => void;
  onRequestLogin?: () => void;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  embedded?: boolean;
};

function SainaPatternSurface({
  children,
  onOpenCommandPalette,
  onMobileMenu,
  showMobileMenu,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
}: {
  children: React.ReactNode;
  onOpenCommandPalette: () => void;
  onMobileMenu?: () => void;
  showMobileMenu: boolean;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
}) {
  return (
    <div className="saina-main saina-pattern-main">
      {showMobileMenu ? (
        <div className="saina-standalone-mobile-bar">
          <button
            type="button"
            className="saina-standalone-menu-btn"
            data-testid="saina-pattern-mobile-menu-btn"
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
      />

      <div className="saina-pattern-content-scroll">
        <div className="saina-pattern-column">
          <div className="saina-pattern-stage flex min-h-0 flex-1 flex-col">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SainaPatternShell({
  children,
  conversations,
  activeChatId = null,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenPattern,
  planTier,
  onUpgrade,
  onRequestLogin,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  embedded = false,
}: SainaPatternShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isCompactShell = useSainaCompactShell();
  const openMobileSidebar = useSainaChromeStore((s) => s.openMobileSidebar);
  const openCommandPaletteFromStore = useSainaChromeStore((s) => s.openCommandPalette);

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  useSainaCommandShortcut(embedded ? () => openCommandPaletteFromStore?.() : openCommandPalette);

  const patternSurface = (
    <SainaPatternSurface
      onOpenCommandPalette={
        embedded ? () => openCommandPaletteFromStore?.() : openCommandPalette
      }
      onMobileMenu={
        embedded ? () => openMobileSidebar?.() : () => setMobileSidebarOpen(true)
      }
      showMobileMenu={!isCompactShell}
      safeOnlyMode={safeOnlyMode}
      onSafeOnlyModeChange={onSafeOnlyModeChange}
      analysisModelId={analysisModelId}
      onAnalysisModelChange={onAnalysisModelChange}
    >
      {children}
    </SainaPatternSurface>
  );

  if (embedded) {
    return patternSurface;
  }

  return (
    <div className="saina-page saina-pattern-shell" data-testid="saina-pattern-shell">
      <div className="saina-app-frame">
        <div className="saina-shell">
          <div className="saina-standalone-sidebar-wrap">
            <SainaConversationSidebar
              conversations={conversations}
              activeChatId={activeChatId}
              activeSection="pattern"
              onNewChat={onNewChat}
              onSelectChat={onSelectChat}
              onDeleteChat={onDeleteChat}
              onOpenPattern={onOpenPattern}
              planTier={planTier}
              onUpgrade={onUpgrade}
              onRequestLogin={onRequestLogin}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              showMobileChrome={!isCompactShell}
            />
          </div>
          <div className="saina-main-col saina-pattern-main-col">
            <div className="saina-canvas saina-pattern-canvas-wrap">
              <SainaCinematicScene />
              {patternSurface}
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
        onOpenPattern={onOpenPattern}
      />
    </div>
  );
}
