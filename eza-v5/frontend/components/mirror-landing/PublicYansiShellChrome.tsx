'use client';

/**
 * Syncs the shared BiligN chrome store while /m is the active view.
 * Omits empty conversation lists so Discover → Yansı does not flicker the sidebar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import { useAuthenticatedConversationBootstrap } from '@/hooks/useAuthenticatedConversationBootstrap';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import { SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';
import { buildStandaloneYansiHref } from '@/lib/eza/mirror/journey/yansiSidebarIdentity';
import type { SainaConversationItem } from '@/lib/eza/sainaConversationList';
import { renameConversationGroup } from '@/lib/eza/conversation-tree/conversationGroups';
import { deleteRenderedConversationGroup } from '@/lib/eza/conversation-tree/deleteRenderedConversationGroup';
import type { ConversationTreeGroupDeleteRequest } from '@/lib/eza/conversation-tree/types';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import {
  CHATS_UPDATED_EVENT,
  deleteChatArchive,
  getChatArchive,
  listChatArchives,
  readActiveChatId,
  resolveChatRouteAfterDelete,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import {
  deleteServerBackedConversation,
  hasServerBackedConversation,
} from '@/lib/eza/serverConversationStore';
import { renameAuthenticatedConversationGroup } from '@/lib/eza/serverConversationGroupStore';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

export default function PublicYansiShellChrome() {
  const router = useRouter();
  const { isPlus, isLoading: isPlanLoading, source } = usePlan();
  const { entitlements: accountEntitlements } = useAccountEntitlements();
  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [archivesReady, setArchivesReady] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const { isServerBacked, serverSummaries } = useAuthenticatedConversationBootstrap();

  const refreshArchives = useCallback(() => {
    if (isServerBacked) {
      setArchives(serverSummaries);
    } else {
      setArchives(listChatArchives());
    }
    setArchivesReady(true);
  }, [isServerBacked, serverSummaries]);

  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const {
    handleRequestLogin,
    handleOpenUpgrade: handleUpgrade,
    gateModals,
  } = useSainaGateModals({ planTier, defaultUpgradeFeature: 'saina_sidebar' });

  const { conversations, conversationGroups, activeChatId } = useSainaSidebarConversations(archives);

  const conversationSceneUrl = useMemo(() => {
    if (!activeChatId) return null;
    const url = getChatArchive(activeChatId)?.conversationSceneUrl;
    return url && isPersistableConversationSceneUrl(url) ? url : null;
  }, [archives, activeChatId]);

  const handleNewChat = useCallback(() => {
    router.replace(SAINA_NEW_CHAT_ROUTE, { scroll: false });
  }, [router]);

  const handleSelectChat = useCallback(
    (id: string) => {
      router.push(`/standalone?chat=${encodeURIComponent(id)}`, { scroll: false });
    },
    [router]
  );

  const handleSelectYansi = useCallback(
    (item: SainaConversationItem) => {
      const conv = (item.sourceConversationId || '').trim();
      const journeyId = (item.journeyId || '').trim();
      const version = Number(item.journeyVersion);
      if (!conv || !journeyId || !Number.isFinite(version) || version < 1) {
        if (conv) {
          router.push(`/standalone?chat=${encodeURIComponent(conv)}`, { scroll: false });
        }
        return;
      }
      router.push(
        buildStandaloneYansiHref({
          sourceConversationId: conv,
          journeyId,
          journeyVersion: version,
        }),
        { scroll: false }
      );
    },
    [router]
  );

  const executeDeleteChat = useCallback(
    async (id: string) => {
      const archive = getChatArchive(id);
      const serverBacked = isServerBacked && hasServerBackedConversation(id);
      if (!archive && !serverBacked) return;
      const wasActive = readActiveChatId() === id;
      if (serverBacked) {
        try {
          await deleteServerBackedConversation(id);
        } catch {
          return;
        }
      }
      deleteChatArchive(id);
      if (wasActive) {
        router.push(resolveChatRouteAfterDelete(), { scroll: false });
      }
    },
    [router, isServerBacked]
  );

  const { requestDelete, deleteModal } = useSainaDeleteChatModal({
    onConfirmDelete: executeDeleteChat,
  });

  const handleDeleteChat = useCallback(
    (id: string) => {
      if (!getChatArchive(id) && !(isServerBacked && hasServerBackedConversation(id))) {
        return;
      }
      requestDelete(id);
    },
    [requestDelete, isServerBacked]
  );

  const handleRenameGroup = useCallback(
    async (groupId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      if (isServerBacked) {
        await renameAuthenticatedConversationGroup(groupId, trimmed);
      } else {
        renameConversationGroup(groupId, trimmed);
      }
      refreshArchives();
    },
    [isServerBacked, refreshArchives]
  );

  const handleDeleteGroup = useCallback(
    async (group: ConversationTreeGroupDeleteRequest) => {
      const result = await deleteRenderedConversationGroup(group);
      if (result === 'blocked_non_empty') return;
      refreshArchives();
    },
    [refreshArchives]
  );

  const handleOpenPattern = useCallback(() => {
    router.push(MIRROR_PATTERN_ROUTE, { scroll: false });
  }, [router]);

  useSyncSainaChrome({
    activeSection: 'yansi',
    conversations: archivesReady ? conversations : undefined,
    conversationGroups: archivesReady ? conversationGroups : undefined,
    activeChatId,
    conversationSceneUrl,
    planTier,
    onNewChat: handleNewChat,
    onSelectChat: handleSelectChat,
    onSelectYansi: handleSelectYansi,
    onDeleteChat: handleDeleteChat,
    onRenameGroup: handleRenameGroup,
    onDeleteGroup: handleDeleteGroup,
    onOpenPattern: handleOpenPattern,
    onUpgrade: handleUpgrade,
    onRequestLogin: handleRequestLogin,
    safeOnlyMode,
    onSafeOnlyModeChange: setSafeOnlyMode,
    analysisModelId,
    onAnalysisModelChange: setAnalysisModelId,
  });

  useEffect(() => {
    refreshArchives();
    window.addEventListener(CHATS_UPDATED_EVENT, refreshArchives);
    window.addEventListener('focus', refreshArchives);
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, refreshArchives);
      window.removeEventListener('focus', refreshArchives);
    };
  }, [refreshArchives]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SAFE_ONLY);
    if (saved !== null) setSafeOnlyMode(saved === 'true');
    setAnalysisModelId(readStoredAnalysisModel());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAFE_ONLY, safeOnlyMode.toString());
  }, [safeOnlyMode]);

  useEffect(() => {
    writeStoredAnalysisModel(analysisModelId);
  }, [analysisModelId]);

  return (
    <>
      {gateModals}
      {deleteModal}
    </>
  );
}
