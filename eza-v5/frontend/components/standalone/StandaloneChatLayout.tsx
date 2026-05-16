'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import StandaloneSidebar from './StandaloneSidebar';
import EmptyState from './EmptyState';

interface StandaloneChatLayoutProps {
  children: React.ReactNode;
  isEmpty: boolean;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  canSaveChat?: boolean;
  onSaveChat?: () => void;
}

export default function StandaloneChatLayout({
  children,
  isEmpty,
  safeOnlyMode,
  onSafeOnlyModeChange,
  canSaveChat = false,
  onSaveChat,
}: StandaloneChatLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className={standaloneSkin.appRow}>
      <StandaloneSidebar
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={onSafeOnlyModeChange}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        canSaveChat={canSaveChat}
        onSaveChat={onSaveChat}
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
            standaloneSkin.chatStage,
            isEmpty ? 'flex min-h-0 flex-1 flex-col' : standaloneSkin.chatStageWithMessages
          )}
        >
          {isEmpty ? (
            <>
              <div className={standaloneSkin.emptyHero}>
                <EmptyState />
              </div>
              <div className={standaloneSkin.emptyComposerWrap}>{children}</div>
            </>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
