'use client';

import { useLayoutEffect } from 'react';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';

/** Registers sidebar/topbar state before paint so route changes keep chrome stable. */
export function useSyncSainaChrome({
  activeSection,
  conversations,
  activeChatId,
  planTier,
  onNewChat,
  onSelectChat,
  onOpenPattern,
  onUpgrade,
  onRequestLogin,
  safeOnlyMode,
  onSafeOnlyModeChange,
  analysisModelId,
  onAnalysisModelChange,
  settingsDisabled,
  onOpenMirror,
  notifications,
}: Partial<SainaChromeState>) {
  const setChrome = useSainaChromeStore((s) => s.setChrome);

  useLayoutEffect(() => {
    setChrome({
      activeSection,
      conversations,
      activeChatId,
      planTier,
      onNewChat,
      onSelectChat,
      onOpenPattern,
      onUpgrade,
      onRequestLogin,
      safeOnlyMode,
      onSafeOnlyModeChange,
      analysisModelId,
      onAnalysisModelChange,
      settingsDisabled,
      onOpenMirror,
      notifications,
    });
  }, [
    setChrome,
    activeSection,
    conversations,
    activeChatId,
    planTier,
    onNewChat,
    onSelectChat,
    onOpenPattern,
    onUpgrade,
    onRequestLogin,
    safeOnlyMode,
    onSafeOnlyModeChange,
    analysisModelId,
    onAnalysisModelChange,
    settingsDisabled,
    onOpenMirror,
    notifications,
  ]);
}
