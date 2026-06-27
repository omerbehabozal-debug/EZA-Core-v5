'use client';

import '@/lib/eza/matchMediaPolyfill';
import '@/styles/saina-mirror.css';
import '@/styles/saina-transitions.css';

import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { resolveSainaAppView } from '@/lib/eza/sainaRoutes';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import { useSainaCommandShortcut } from '@/hooks/useSainaCommandShortcut';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import SainaConversationSidebar from '@/components/saina/SainaConversationSidebar';
import SainaCommandPalette from '@/components/saina/SainaCommandPalette';
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

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);

  useSainaCommandShortcut(openCommandPalette);

  useLayoutEffect(() => {
    setChrome({
      openMobileSidebar,
      openCommandPalette,
    });
  }, [setChrome, openCommandPalette, openMobileSidebar]);

  if (!view) {
    return <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">{children}</div>;
  }

  return (
    <MirrorEntriesProvider>
      <PlanHydrator />
      <div
      className={cn(
        'saina-page saina-app-root',
        view === 'chat' ? 'saina-standalone-shell' : 'saina-pattern-shell'
      )}
      data-testid={view === 'chat' ? 'saina-standalone-shell' : 'saina-pattern-shell'}
      data-saina-view={view}
    >
      <div className="saina-app-frame">
        <div className="saina-shell">
          <div className="saina-standalone-sidebar-wrap">
            <SainaConversationSidebar
              conversations={chrome.conversations}
              conversationGroups={chrome.conversationGroups}
              activeChatId={chrome.activeChatId}
              activeSection={view === 'pattern' ? 'pattern' : 'chat'}
              onNewChat={chrome.onNewChat}
              onSelectChat={chrome.onSelectChat}
              onOpenPattern={chrome.onOpenPattern}
              planTier={chrome.planTier}
              onUpgrade={chrome.onUpgrade}
              onRequestLogin={chrome.onRequestLogin}
              mobileOpen={mobileSidebarOpen}
              onMobileClose={() => setMobileSidebarOpen(false)}
              showMobileChrome={!isCompactShell}
            />
          </div>

          <div className={cn('saina-main-col', view === 'pattern' && 'saina-pattern-main-col')}>
            <div className={cn('saina-canvas', view === 'pattern' && 'saina-pattern-canvas-wrap')}>
              <SainaPersistentScene />
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
