'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CHATS_UPDATED_EVENT,
  deleteChatArchive,
  getChatArchive,
  listChatArchives,
  readActiveChatId,
  resolveChatRouteAfterDelete,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';
import SainaPatternShell from '@/components/saina/SainaPatternShell';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { usePatternDeviceSync } from '@/hooks/usePatternDeviceSync';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import { filterEntriesForMapAccess } from '@/lib/eza/plan/sainaRelationshipMapAccess';
import { useRelationshipMapAccess } from '@/lib/eza/plan/useRelationshipMapAccess';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { usePlan } from '@/lib/eza/plan/usePlan';
import { useAuthenticatedConversationBootstrap } from '@/hooks/useAuthenticatedConversationBootstrap';
import { deleteServerBackedConversation } from '@/lib/eza/serverConversationStore';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';
import { trackRelationshipPatternViewed } from '@/lib/eza/mirror/relationshipPatternAnalytics';
import { useSetConversationMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import { SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';
import { useAuth } from '@/context/AuthContext';
import {
  getEzaUserPreferences,
  isEzaEnabled,
  setEzaUserPreferences,
  subscribeEzaUserPreferences,
  type EzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';
const EZA_ACTIVATION_MS = 1000;

export default function SainaPatternPageInner() {
  const router = useRouter();
  const { user } = useAuth();
  const ownerUserId = user?.user_id?.trim() || null;
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements } = useAccountEntitlements();
  const setConversationMirrorEntries = useSetConversationMirrorEntries();

  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [ezaPrefs, setEzaPrefs] = useState<EzaUserPreferences>(() =>
    getEzaUserPreferences(ownerUserId)
  );
  const [isEzaActivating, setIsEzaActivating] = useState(false);
  const { isServerBacked, serverSummaries } = useAuthenticatedConversationBootstrap();

  const ezaEnabled = isEzaEnabled(ezaPrefs);

  const refreshArchives = useCallback(() => {
    if (isServerBacked) {
      setArchives(serverSummaries);
    } else {
      setArchives(listChatArchives());
    }
  }, [isServerBacked, serverSummaries]);

  useEffect(() => {
    setConversationMirrorEntries([], null);
  }, [setConversationMirrorEntries]);

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

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  useEffect(() => {
    trackRelationshipPatternViewed();
  }, []);

  useEffect(() => {
    setEzaPrefs(getEzaUserPreferences(ownerUserId));
    return subscribeEzaUserPreferences(() => {
      setEzaPrefs(getEzaUserPreferences(ownerUserId));
    });
  }, [ownerUserId]);

  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const {
    mapAccess,
    cutoffIso,
  } = useRelationshipMapAccess();
  const { handleRequestLogin, handleOpenUpgrade: handleUpgrade, gateModals } =
    useSainaGateModals({ planTier, defaultUpgradeFeature: 'relationship_pattern' });

  const { entries, deviceState, systemNotifications } = usePatternDeviceSync({
    hasMapDataAccess: ezaEnabled,
    archives,
  });

  const displayEntries = useMemo(
    () =>
      ezaEnabled ? filterEntriesForMapAccess(entries, mapAccess, cutoffIso) : [],
    [ezaEnabled, entries, mapAccess, cutoffIso]
  );

  const handleActivateEza = useCallback(() => {
    setIsEzaActivating(true);
    setEzaPrefs(
      setEzaUserPreferences(ownerUserId, {
        ezaDataProcessingEnabled: true,
        ezaVisibilityEnabled: true,
      })
    );
    window.setTimeout(() => setIsEzaActivating(false), EZA_ACTIVATION_MS);
  }, [ownerUserId]);

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
      router.push(`/standalone?chat=${id}`, { scroll: false });
    },
    [router]
  );

  const executeDeleteChat = useCallback(
    (id: string) => {
      const archive = getChatArchive(id);
      if (!archive && !isServerBacked) return;

      const wasActive = readActiveChatId() === id;
      if (isServerBacked) {
        void deleteServerBackedConversation(id).finally(() => {
          deleteChatArchive(id);
          if (wasActive) {
            router.push(resolveChatRouteAfterDelete(), { scroll: false });
          }
        });
        return;
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
      if (!getChatArchive(id) && !isServerBacked) return;
      requestDelete(id);
    },
    [requestDelete]
  );

  const handleOpenPattern = useCallback(() => {
    /* Already on pattern route — keep sidebar card active. */
  }, []);

  useSyncSainaChrome({
    activeSection: 'pattern',
    conversations,
    conversationGroups,
    activeChatId,
    conversationSceneUrl,
    planTier,
    onNewChat: handleNewChat,
    onSelectChat: handleSelectChat,
    onDeleteChat: handleDeleteChat,
    onOpenPattern: handleOpenPattern,
    onUpgrade: handleUpgrade,
    onRequestLogin: handleRequestLogin,
    safeOnlyMode,
    onSafeOnlyModeChange: setSafeOnlyMode,
    analysisModelId,
    onAnalysisModelChange: setAnalysisModelId,
    notifications: ezaEnabled ? systemNotifications : [],
  });

  return (
    <>
      <SainaPatternShell
        conversations={conversations}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onOpenPattern={handleOpenPattern}
        planTier={planTier}
        onUpgrade={handleUpgrade}
        onRequestLogin={handleRequestLogin}
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={setSafeOnlyMode}
        analysisModelId={analysisModelId}
        onAnalysisModelChange={setAnalysisModelId}
        embedded
      >
        <RelationshipPatternView
          entries={displayEntries}
          deviceState={deviceState}
          mapAccess={mapAccess}
          ezaEnabled={ezaEnabled}
          onActivateEza={handleActivateEza}
          isEzaActivating={isEzaActivating}
          className="relative z-[1] min-h-0 flex-1"
        />
      </SainaPatternShell>

      {gateModals}
      {deleteModal}
    </>
  );
}
