'use client';

import { useLayoutEffect } from 'react';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';
import { useAuth } from '@/context/AuthContext';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { withConversationYansiStatus } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import { useConversationYansiStatusMap } from '@/hooks/useConversationYansiStatusMap';

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
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const journeyOwnerId = resolveJourneyOwnerKey(user?.user_id);
  const yansiStatusByConversationId = useConversationYansiStatusMap(journeyOwnerId, {
    isAuthenticated,
    isAuthReady,
  });

  const conversationsWithStatus = conversations
    ? withConversationYansiStatus(conversations, yansiStatusByConversationId)
    : conversations;
  const conversationGroupsWithStatus = conversationGroups?.map((group) => ({
    ...group,
    conversations: withConversationYansiStatus(
      group.conversations,
      yansiStatusByConversationId
    ),
  }));

  useLayoutEffect(() => {
    setChrome({
      activeSection,
      conversations: conversationsWithStatus,
      conversationGroups: conversationGroupsWithStatus,
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
    conversationsWithStatus,
    conversationGroupsWithStatus,
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
