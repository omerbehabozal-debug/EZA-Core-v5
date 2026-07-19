'use client';

import { useLayoutEffect } from 'react';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';

/** Registers sidebar/topbar state before paint so route changes keep chrome stable. */
export function useSyncSainaChrome({
  activeSection,
  conversations,
  conversationGroups,
  activeChatId,
  conversationSceneUrl,
  planTier,
  onNewChat,
  onSelectChat,
  onDeleteChat,
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
      conversationGroups,
      activeChatId,
      conversationSceneUrl: resolveChromeConversationSceneUrl(
        activeChatId,
        conversationSceneUrl
      ),
      planTier,
      onNewChat,
      onSelectChat,
      onDeleteChat,
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
    conversationGroups,
    activeChatId,
    conversationSceneUrl,
    planTier,
    onNewChat,
    onSelectChat,
    onDeleteChat,
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
