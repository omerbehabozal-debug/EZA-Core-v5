'use client';

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';
import { useAuth } from '@/context/AuthContext';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { withConversationYansiStatus } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import { useConversationYansiStatusMap } from '@/hooks/useConversationYansiStatusMap';

/** Parent may omit callbacks; stable wrappers read the latest via ref. */
type ChromeCallbacks = Partial<
  Pick<
    SainaChromeState,
    | 'onNewChat'
    | 'onSelectChat'
    | 'onDeleteChat'
    | 'onOpenPattern'
    | 'onUpgrade'
    | 'onRequestLogin'
    | 'onSafeOnlyModeChange'
    | 'onAnalysisModelChange'
    | 'onOpenMirror'
  >
>;

function conversationsSignature(
  items: SainaChromeState['conversations'] | undefined
): string {
  if (!items?.length) return '';
  return items
    .map((c) => `${c.id}:${c.title}:${(c as { yansiStatus?: string }).yansiStatus ?? ''}`)
    .join('|');
}

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

  const conversationsWithStatus = useMemo(
    () =>
      conversations
        ? withConversationYansiStatus(conversations, yansiStatusByConversationId)
        : conversations,
    [conversations, yansiStatusByConversationId]
  );
  const conversationGroupsWithStatus = useMemo(
    () =>
      conversationGroups?.map((group) => ({
        ...group,
        conversations: withConversationYansiStatus(
          group.conversations,
          yansiStatusByConversationId
        ),
      })),
    [conversationGroups, yansiStatusByConversationId]
  );

  // Keep last mapped list when signature is unchanged — status-map object identity churns.
  const conversationsSig = conversationsSignature(conversationsWithStatus);
  const stableConversationsRef = useRef(conversationsWithStatus);
  const lastConversationsSigRef = useRef(conversationsSig);
  if (conversationsSig !== lastConversationsSigRef.current) {
    lastConversationsSigRef.current = conversationsSig;
    stableConversationsRef.current = conversationsWithStatus;
  }
  const stableConversations =
    conversationsWithStatus === undefined
      ? undefined
      : stableConversationsRef.current;

  const groupsSig = useMemo(
    () =>
      (conversationGroupsWithStatus ?? [])
        .map(
          (g) =>
            `${g.id}:${conversationsSignature(g.conversations)}`
        )
        .join('||'),
    [conversationGroupsWithStatus]
  );
  const stableGroupsRef = useRef(conversationGroupsWithStatus);
  const lastGroupsSigRef = useRef(groupsSig);
  if (groupsSig !== lastGroupsSigRef.current) {
    lastGroupsSigRef.current = groupsSig;
    stableGroupsRef.current = conversationGroupsWithStatus;
  }
  const stableGroups =
    conversationGroupsWithStatus === undefined
      ? undefined
      : stableGroupsRef.current;

  // Callback identities change every parent render; keep stable wrappers in the store
  // so layout subscribers are not bounced in an infinite setChrome loop.
  const callbacksRef = useRef<ChromeCallbacks>({});
  callbacksRef.current = {
    onNewChat,
    onSelectChat,
    onDeleteChat,
    onOpenPattern,
    onUpgrade,
    onRequestLogin,
    onSafeOnlyModeChange,
    onAnalysisModelChange,
    onOpenMirror,
  };

  const stableOnNewChat = useCallback(() => {
    callbacksRef.current.onNewChat?.();
  }, []);
  const stableOnSelectChat = useCallback((id: string) => {
    callbacksRef.current.onSelectChat?.(id);
  }, []);
  const stableOnDeleteChat = useCallback((id: string) => {
    callbacksRef.current.onDeleteChat?.(id);
  }, []);
  const stableOnOpenPattern = useCallback(() => {
    callbacksRef.current.onOpenPattern?.();
  }, []);
  const stableOnUpgrade = useCallback(() => {
    callbacksRef.current.onUpgrade?.();
  }, []);
  const stableOnRequestLogin = useCallback(() => {
    callbacksRef.current.onRequestLogin?.();
  }, []);
  const stableOnSafeOnlyModeChange = useCallback((enabled: boolean) => {
    callbacksRef.current.onSafeOnlyModeChange?.(enabled);
  }, []);
  const stableOnAnalysisModelChange = useCallback((modelId: string) => {
    callbacksRef.current.onAnalysisModelChange?.(modelId);
  }, []);
  const stableOnOpenMirror = useCallback(() => {
    callbacksRef.current.onOpenMirror?.();
  }, []);

  useLayoutEffect(() => {
    const current = useSainaChromeStore.getState();
    const nextSceneUrl = resolveChromeConversationSceneUrl(
      activeChatId,
      conversationSceneUrl
    );
    const unchanged =
      current.activeSection === activeSection &&
      current.conversations === stableConversations &&
      current.conversationGroups === stableGroups &&
      current.activeChatId === activeChatId &&
      current.conversationSceneUrl === nextSceneUrl &&
      current.planTier === planTier &&
      current.safeOnlyMode === safeOnlyMode &&
      current.analysisModelId === analysisModelId &&
      current.settingsDisabled === settingsDisabled &&
      current.notifications === notifications &&
      current.onNewChat === stableOnNewChat &&
      current.onSelectChat === stableOnSelectChat &&
      current.onDeleteChat === stableOnDeleteChat &&
      current.onOpenPattern === stableOnOpenPattern &&
      current.onUpgrade === stableOnUpgrade &&
      current.onRequestLogin === stableOnRequestLogin &&
      current.onSafeOnlyModeChange === stableOnSafeOnlyModeChange &&
      current.onAnalysisModelChange === stableOnAnalysisModelChange &&
      current.onOpenMirror === stableOnOpenMirror;
    if (unchanged) return;

    setChrome({
      activeSection,
      conversations: stableConversations,
      conversationGroups: stableGroups,
      activeChatId,
      conversationSceneUrl: nextSceneUrl,
      planTier,
      onNewChat: stableOnNewChat,
      onSelectChat: stableOnSelectChat,
      onDeleteChat: stableOnDeleteChat,
      onOpenPattern: stableOnOpenPattern,
      onUpgrade: stableOnUpgrade,
      onRequestLogin: stableOnRequestLogin,
      safeOnlyMode,
      onSafeOnlyModeChange: stableOnSafeOnlyModeChange,
      analysisModelId,
      onAnalysisModelChange: stableOnAnalysisModelChange,
      settingsDisabled,
      onOpenMirror: stableOnOpenMirror,
      notifications,
      openMobileSidebar: current.openMobileSidebar,
      openCommandPalette: current.openCommandPalette,
    });
  }, [
    setChrome,
    activeSection,
    stableConversations,
    stableGroups,
    activeChatId,
    conversationSceneUrl,
    planTier,
    safeOnlyMode,
    analysisModelId,
    settingsDisabled,
    notifications,
    stableOnNewChat,
    stableOnSelectChat,
    stableOnDeleteChat,
    stableOnOpenPattern,
    stableOnUpgrade,
    stableOnRequestLogin,
    stableOnSafeOnlyModeChange,
    stableOnAnalysisModelChange,
    stableOnOpenMirror,
  ]);
}
