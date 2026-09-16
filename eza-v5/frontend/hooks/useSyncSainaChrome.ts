'use client';

import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { resolveChromeConversationSceneUrl } from '@/lib/eza/resolveChromeConversationSceneUrl';
import { useSainaChromeStore, type SainaChromeState } from '@/lib/eza/sainaChromeStore';
import { useAuth } from '@/context/AuthContext';
import { resolveJourneyOwnerKey } from '@/lib/eza/mirror/journey/journeyOwnerKey';
import { withConversationYansiStatus } from '@/lib/eza/mirror/journey/resolveConversationYansiStatus';
import { useConversationYansiStatusMap } from '@/hooks/useConversationYansiStatusMap';
import type { ConversationTreeGroupDeleteRequest } from '@/lib/eza/conversation-tree/types';

/** Parent may omit callbacks; stable wrappers read the latest via ref. */
type ChromeCallbacks = Partial<
  Pick<
    SainaChromeState,
    | 'onNewChat'
    | 'onSelectChat'
    | 'onSelectYansi'
    | 'onDeleteChat'
    | 'onRenameGroup'
    | 'onDeleteGroup'
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
    .map((c) =>
      [
        c.id,
        c.kind ?? 'conversation',
        c.title,
        c.preview,
        c.time,
        (c as { savedAt?: string }).savedAt ?? '',
        (c as { groupId?: string | null }).groupId ?? '',
        (c as { yansiStatus?: string }).yansiStatus ?? '',
        c.thumbImageUrl ?? '',
        c.yansiSourceIdentity ?? '',
        String((c as { additionalYansiCount?: number }).additionalYansiCount ?? ''),
        String((c as { representativeYansiCount?: number }).representativeYansiCount ?? ''),
        (c as { conversationSceneUrl?: string | null }).conversationSceneUrl ?? '',
      ].join(':')
    )
    .join('|');
}

/** Registers sidebar/topbar state before paint so route changes keep chrome stable. */
export function useSyncSainaChrome({
  activeSection,
  conversations,
  conversationGroups,
  activeChatId,
  activeYansiIdentity,
  selectedYansiSceneUrl,
  conversationSceneUrl,
  planTier,
  onNewChat,
  onSelectChat,
  onSelectYansi,
  onDeleteChat,
  onRenameGroup,
  onDeleteGroup,
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
            [
              g.id,
              g.title,
              g.updatedAt,
              g.sortOrder,
              g.source ?? '',
              g.clientGroupId ?? '',
              g.conversations.length,
              conversationsSignature(g.conversations),
            ].join(':')
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
    onSelectYansi,
    onDeleteChat,
    onRenameGroup,
    onDeleteGroup,
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
  const stableOnSelectYansi = useCallback((item: SainaChromeState['conversations'][number]) => {
    callbacksRef.current.onSelectYansi?.(item);
  }, []);
  const stableOnDeleteChat = useCallback((id: string) => {
    callbacksRef.current.onDeleteChat?.(id);
  }, []);
  const stableOnRenameGroup = useCallback((id: string, title: string) => {
    void callbacksRef.current.onRenameGroup?.(id, title);
  }, []);
  const stableOnDeleteGroup = useCallback((group: ConversationTreeGroupDeleteRequest) => {
    void callbacksRef.current.onDeleteGroup?.(group);
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
    const nextYansi = activeYansiIdentity ?? null;
    const nextYansiScene = selectedYansiSceneUrl ?? null;
    const unchanged =
      current.activeSection === activeSection &&
      current.conversations === stableConversations &&
      current.conversationGroups === stableGroups &&
      current.activeChatId === activeChatId &&
      current.activeYansiIdentity === nextYansi &&
      current.selectedYansiSceneUrl === nextYansiScene &&
      current.conversationSceneUrl === nextSceneUrl &&
      current.planTier === planTier &&
      current.safeOnlyMode === safeOnlyMode &&
      current.analysisModelId === analysisModelId &&
      current.settingsDisabled === settingsDisabled &&
      current.notifications === notifications &&
      current.onNewChat === stableOnNewChat &&
      current.onSelectChat === stableOnSelectChat &&
      current.onSelectYansi === stableOnSelectYansi &&
      current.onDeleteChat === stableOnDeleteChat &&
      current.onRenameGroup === stableOnRenameGroup &&
      current.onDeleteGroup === stableOnDeleteGroup &&
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
      activeYansiIdentity: nextYansi,
      selectedYansiSceneUrl: nextYansiScene,
      conversationSceneUrl: nextSceneUrl,
      planTier,
      onNewChat: stableOnNewChat,
      onSelectChat: stableOnSelectChat,
      onSelectYansi: stableOnSelectYansi,
      onDeleteChat: stableOnDeleteChat,
      onRenameGroup: stableOnRenameGroup,
      onDeleteGroup: stableOnDeleteGroup,
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
    activeYansiIdentity,
    selectedYansiSceneUrl,
    conversationSceneUrl,
    planTier,
    safeOnlyMode,
    analysisModelId,
    settingsDisabled,
    notifications,
    stableOnNewChat,
    stableOnSelectChat,
    stableOnSelectYansi,
    stableOnDeleteChat,
    stableOnRenameGroup,
    stableOnDeleteGroup,
    stableOnOpenPattern,
    stableOnUpgrade,
    stableOnRequestLogin,
    stableOnSafeOnlyModeChange,
    stableOnAnalysisModelChange,
    stableOnOpenMirror,
  ]);
}
