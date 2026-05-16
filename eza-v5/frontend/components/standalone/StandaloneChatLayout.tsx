'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import StandaloneSidebar from './StandaloneSidebar';
import EmptyState from './EmptyState';

interface StandaloneChatLayoutProps {
  children?: React.ReactNode;
  composer: React.ReactNode;
  isEmpty: boolean;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  hasActiveChat?: boolean;
  onNewChat?: () => void;
}

export default function StandaloneChatLayout({
  children,
  composer,
  isEmpty,
  safeOnlyMode,
  onSafeOnlyModeChange,
  hasActiveChat = false,
  onNewChat,
}: StandaloneChatLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className={standaloneSkin.appRow}>
      <StandaloneSidebar
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={onSafeOnlyModeChange}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        hasActiveChat={hasActiveChat}
        onNewChat={onNewChat}
      />

      <main className={standaloneSkin.main}>
        <div className="flex shrink-0 items-center px-2 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className={standaloneSkin.iconBtn}
            aria-label="Menü"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            isEmpty ? standaloneSkin.chatStage : standaloneSkin.chatStageFull,
            isEmpty ? 'flex min-h-0 flex-1 flex-col' : standaloneSkin.chatStageWithMessages
          )}
        >
          {isEmpty ? (
            <>
              <div className={standaloneSkin.emptyHero}>
                <EmptyState />
              </div>
              <div className={standaloneSkin.emptyComposerWrap}>{composer}</div>
            </>
          ) : (
            <div className="grid min-h-0 w-full min-w-0 flex-1 grid-rows-[1fr_auto]">
              <div className={standaloneSkin.mainScroll}>
                <div className={standaloneSkin.chatColumn}>{children}</div>
              </div>
              <div className={standaloneSkin.composerBar}>
                <div className={standaloneSkin.chatColumn}>{composer}</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
