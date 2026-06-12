'use client';

import { Bell, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import SainaProfileMenu from './SainaProfileMenu';

type SainaPageTopBarProps = {
  className?: string;
  safeOnlyMode?: boolean;
  onSafeOnlyModeChange?: (enabled: boolean) => void;
  analysisModelId?: string;
  onAnalysisModelChange?: (modelId: string) => void;
  settingsDisabled?: boolean;
  userInitial?: string;
};

export default function SainaPageTopBar({
  className,
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

  return (
    <header className={cn('saina-top-bar', className)}>
      <div className="saina-top-bar-inner">
        <div className="saina-search-wrap">
          <Search size={16} className="saina-search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Bir şey ara..."
            className="saina-search-input"
            readOnly
            aria-label="Ara"
          />
          <span className="saina-search-kbd" aria-hidden>
            ⌘ K
          </span>
        </div>
        <div className="saina-top-bar-actions">
          <button type="button" className="saina-icon-btn saina-icon-btn--glass" aria-label="Bildirimler">
            <Bell size={16} />
          </button>
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
