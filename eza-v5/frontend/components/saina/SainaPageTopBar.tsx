'use client';

import { cn } from '@/lib/utils';
import SainaProfileMenu from './SainaProfileMenu';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';

type SainaPageTopBarProps = {
  className?: string;
  onOpenCommandPalette?: () => void;
  safeOnlyMode?: boolean;
  onSafeOnlyModeChange?: (enabled: boolean) => void;
  analysisModelId?: string;
  onAnalysisModelChange?: (modelId: string) => void;
  settingsDisabled?: boolean;
};

export default function SainaPageTopBar({
  className,
  safeOnlyMode = false,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled = false,
}: SainaPageTopBarProps) {
  return (
    <header className={cn('saina-top-bar', className)}>
      <div className="saina-top-bar-inner">
        <div
          className="saina-top-bar-actions saina-top-bar-action-cluster"
          role="group"
          aria-label="Profil"
        >
          <SainaProfileMenu
            safeOnlyMode={safeOnlyMode}
            onSafeOnlyModeChange={onSafeOnlyModeChange}
            analysisModelId={analysisModelId ?? DEFAULT_ANALYSIS_MODEL_ID}
            onAnalysisModelChange={onAnalysisModelChange}
            disabled={settingsDisabled}
          />
        </div>
      </div>
    </header>
  );
}
