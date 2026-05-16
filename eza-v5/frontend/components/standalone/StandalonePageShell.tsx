'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import StandaloneSidebar from './StandaloneSidebar';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

interface StandalonePageShellProps {
  children: React.ReactNode;
  canSaveChat?: boolean;
  onSaveChat?: () => void;
}

export default function StandalonePageShell({
  children,
  canSaveChat = false,
  onSaveChat,
}: StandalonePageShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SAFE_ONLY);
    if (saved !== null) setSafeOnlyMode(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAFE_ONLY, safeOnlyMode.toString());
  }, [safeOnlyMode]);

  return (
    <div className={standaloneSkin.appRow}>
      <StandaloneSidebar
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={setSafeOnlyMode}
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
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
