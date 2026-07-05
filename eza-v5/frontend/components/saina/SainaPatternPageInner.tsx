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
import PatternPlusUpsellBanner from '@/components/mirror/relationship/PatternPlusUpsellBanner';
import SainaPatternShell from '@/components/saina/SainaPatternShell';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { usePatternDeviceSync } from '@/hooks/usePatternDeviceSync';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import {
  canViewRelationshipMapData,
  filterEntriesForMapAccess,
  getRelationshipMapAccess,
} from '@/lib/eza/plan/sainaRelationshipMapAccess';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { usePlan } from '@/lib/eza/plan/usePlan';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';
import { trackRelationshipPatternViewed } from '@/lib/eza/mirror/relationshipPatternAnalytics';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

export default function SainaPatternPageInner() {
  const router = useRouter();
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements, isLoading: entitlementsLoading } =
    useAccountEntitlements();

  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);

  const refreshArchives = useCallback(() => {
    setArchives(listChatArchives());
  }, []);

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

  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const mapAccess = getRelationshipMapAccess(accountEntitlements);
  const canViewMapData = canViewRelationshipMapData(mapAccess);
  const {
    handleRequestLogin,
    handleOpenUpgrade: handleUpgrade,
    gateModals,
  } = useSainaGateModals({ planTier, defaultUpgradeFeature: 'relationship_pattern' });
  const planResolved = !isPlanLoading && !entitlementsLoading;

  const { entries, deviceState, systemNotifications } = usePatternDeviceSync({
    hasMapDataAccess: canViewMapData,
    archives,
  });

  const displayEntries = useMemo(
    () =>
      filterEntriesForMapAccess(
        entries,
        mapAccess,
        accountEntitlements.entitlements.relationshipMapCutoffIso
      ),
    [entries, mapAccess, accountEntitlements.entitlements.relationshipMapCutoffIso]
  );

  const { conversations, conversationGroups, activeChatId } = useSainaSidebarConversations(archives);

  const conversationSceneUrl = useMemo(() => {
    if (!activeChatId) return null;
    const url = getChatArchive(activeChatId)?.conversationSceneUrl;
    return url && isPersistableConversationSceneUrl(url) ? url : null;
  }, [archives, activeChatId]);


  const handleNewChat = useCallback(() => {
    router.replace('/standalone', { scroll: false });
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
      if (!archive) return;

      const wasActive = readActiveChatId() === id;
      deleteChatArchive(id);

      if (wasActive) {
        router.push(resolveChatRouteAfterDelete(), { scroll: false });
      }
    },
    [router]
  );

  const { requestDelete, deleteModal } = useSainaDeleteChatModal({
    onConfirmDelete: executeDeleteChat,
  });

  const handleDeleteChat = useCallback(
    (id: string) => {
      if (!getChatArchive(id)) return;
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
    notifications: canViewMapData ? systemNotifications : [],
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
        {!planResolved ? (
          <div className="saina-route-fallback min-h-[32vh] flex-1" aria-hidden />
        ) : (
          <>
            {!canViewMapData ? (
              <PatternPlusUpsellBanner
                className="relative z-[1] shrink-0"
                onCtaClick={handleUpgrade}
              />
            ) : null}
            <RelationshipPatternView
              entries={displayEntries}
              deviceState={deviceState}
              previewMode={!canViewMapData}
              mapAccess={mapAccess}
              className="relative z-[1] min-h-0 flex-1"
            />
          </>
        )}
      </SainaPatternShell>

      {gateModals}
      {deleteModal}
    </>
  );
}
