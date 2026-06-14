'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAINA_TOP_SEARCH_PLACEHOLDER } from '@/lib/eza/sainaCopy';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import SainaNotificationsDropdown from './SainaNotificationsDropdown';
import SainaProfileMenu from './SainaProfileMenu';

type SainaPageTopBarProps = {
  className?: string;
  onOpenCommandPalette?: () => void;
  safeOnlyMode?: boolean;
  onSafeOnlyModeChange?: (enabled: boolean) => void;
  analysisModelId?: string;
  onAnalysisModelChange?: (modelId: string) => void;
  settingsDisabled?: boolean;
  userInitial?: string;
};

export default function SainaPageTopBar({
  className,
  onOpenCommandPalette,
  safeOnlyMode = false,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled = false,
  userInitial = 'E',
}: SainaPageTopBarProps) {
  const showSettings =
    onSafeOnlyModeChange != null &&
    onAnalysisModelChange != null &&
    analysisModelId != null;

  const notifications = useSainaChromeStore((s) => s.notifications ?? []);

  const openPalette = () => {
    onOpenCommandPalette?.();
  };

  return (
    <header className={cn('saina-top-bar', className)}>
      <div className="saina-top-bar-inner">
        <div className="saina-search-wrap">
          <Search size={16} className="saina-search-icon" aria-hidden />
          <input
            type="search"
            placeholder={SAINA_TOP_SEARCH_PLACEHOLDER}
            className="saina-search-input"
            readOnly
            aria-label="Ara"
            data-testid="saina-top-search-trigger"
            onClick={openPalette}
            onFocus={(event) => {
              openPalette();
              event.currentTarget.blur();
            }}
          />
          <span className="saina-search-kbd" aria-hidden>
            ⌘ K
          </span>
        </div>

        <div
          className="saina-top-bar-actions saina-top-bar-action-cluster"
          role="group"
          aria-label="Bildirimler ve profil"
        >
          <SainaNotificationsDropdown notifications={notifications} />
          {showSettings ? (
            <SainaProfileMenu
              safeOnlyMode={safeOnlyMode}
              onSafeOnlyModeChange={onSafeOnlyModeChange}
              analysisModelId={analysisModelId}
              onAnalysisModelChange={onAnalysisModelChange}
              disabled={settingsDisabled}
              userInitial={userInitial}
            />
          ) : (
            <div className="saina-top-avatar-wrap">
              <div className="saina-profile-avatar saina-profile-avatar--top">{userInitial}</div>
              <span className="saina-status-dot" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
