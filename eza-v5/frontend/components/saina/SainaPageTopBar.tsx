'use client';

import { cn } from '@/lib/utils';

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
}: SainaPageTopBarProps) {
  return (
    <header className={cn('saina-top-bar', className)}>
      <div className="saina-top-bar-inner" aria-hidden="true" />
    </header>
  );
}
