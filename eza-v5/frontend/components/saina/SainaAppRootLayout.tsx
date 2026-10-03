'use client';

import '@/lib/eza/matchMediaPolyfill';
import '@/styles/saina-mirror.css';
import '@/styles/saina-yansi-desktop.css';
import '@/styles/saina-profile-panel.css';
import '@/styles/saina-transitions.css';
import '@/styles/yansi-reel-responsive.css';

import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { resolveSainaAppView } from '@/lib/eza/sainaRoutes';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { useSainaVisualViewportInset } from '@/hooks/useSainaVisualViewportInset';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from '@/components/saina/SainaCommandPalette';
import SainaPageTopBar from '@/components/saina/SainaPageTopBar';
import SainaPersistentScene from '@/components/saina/SainaPersistentScene';
import SainaRouteTransition from '@/components/saina/SainaRouteTransition';
import { MirrorEntriesProvider } from '@/components/standalone/MirrorEntriesContext';
import PlanHydrator from '@/components/plan/PlanHydrator';

type SainaAppRootLayoutProps = {
  children: ReactNode;
};

export default function SainaAppRootLayout({ children }: SainaAppRootLayoutProps) {
  const pathname = usePathname();
  const view = resolveSainaAppView(pathname);
  const chrome = useSainaChromeStore();
  const setChrome = useSainaChromeStore((s) => s.setChrome);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isCompactShell = useSainaCompactShell();
  useSainaVisualViewportInset();

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);

  useSainaCommandShortcut(openCommandPalette);

  useLayoutEffect(() => {
    setChrome({
      openMobileSidebar,
      openCommandPalette,
    });
  }, [setChrome, openCommandPalette, openMobileSidebar, pathname]);

  if (!view) {
    return <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">{children}</div>;
  }

  return (
    <MirrorEntriesProvider>
      <PlanHydrator />
      <div
      className={cn(
        'saina-page saina-app-root saina-standalone-shell',
        view === 'discover' && 'saina-discover-shell',
        view === 'pattern' && 'saina-pattern-shell',
        view === 'yansi' && 'saina-yansi-shell'
      )}
      data-testid={
        view === 'chat'
          ? 'saina-standalone-shell'
          : view === 'discover'
            ? 'saina-discover-shell'
            : view === 'yansi'
              ? 'saina-yansi-shell'
              : 'saina-pattern-shell'
      }
      data-saina-view={view}
    >
      <div className="saina-app-frame">
        <div className="saina-shell">
          <div className="saina-standalone-sidebar-wrap">
            <SainaConversationSidebar
              conversations={chrome.conversations}
              conversationGroups={chrome.conversationGroups}
              activeChatId={chrome.activeChatId}
              activeYansiIdentity={chrome.activeYansiIdentity}
              activeSection={
                view === 'pattern'
                  ? 'pattern'
                  : view === 'discover' || view === 'yansi'
                    ? 'discover'
                    : 'chat'
              }
              onNewChat={chrome.onNewChat}
              onSelectChat={chrome.onSelectChat}
              onSelectYansi={chrome.onSelectYansi}
              onDeleteChat={chrome.onDeleteChat}
              onRenameGroup={chrome.onRenameGroup}
              onDeleteGroup={chrome.onDeleteGroup}
              onOpenPattern={chrome.onOpenPattern}
              planTier={chrome.planTier}
              onUpgrade={chrome.onUpgrade}
              onRequestLogin={chrome.onRequestLogin}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              showMobileChrome={!isCompactShell}
            />
          </div>

          <div
            className={cn(
              'saina-main-col',
              (view === 'pattern' || view === 'discover' || view === 'yansi') &&
                'saina-pattern-main-col'
            )}
          >
            {view === 'yansi' ? (
              <div className="saina-yansi-shell-topbar" data-testid="saina-yansi-shell-topbar">
                <SainaPageTopBar
                  onOpenCommandPalette={openCommandPalette}
                  safeOnlyMode={chrome.safeOnlyMode}
                  onSafeOnlyModeChange={chrome.onSafeOnlyModeChange}
                  analysisModelId={chrome.analysisModelId}
                  onAnalysisModelChange={chrome.onAnalysisModelChange}
                />
              </div>
            ) : null}
            <div
              className={cn(
                'saina-canvas',
                view === 'pattern' && 'saina-pattern-canvas-wrap',
                view === 'discover' && 'saina-discover-canvas-wrap',
                view === 'yansi' && 'saina-yansi-canvas-wrap'
              )}
            >
              {view === 'yansi' ? null : <SainaPersistentScene />}
              <SainaRouteTransition routeKey={view}>{children}</SainaRouteTransition>
            </div>
          </div>
        </div>
      </div>

      <SainaCommandPalette
        open={commandPaletteOpen}
        onClose={closeCommandPalette}
        conversations={chrome.conversations}
        onNewChat={chrome.onNewChat}
        onSelectChat={chrome.onSelectChat}
        onOpenMirror={chrome.onOpenMirror}
        onOpenPattern={chrome.onOpenPattern}
      />
    </div>
    </MirrorEntriesProvider>
  );
}
