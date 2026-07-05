'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SAINA_DISCOVER_EMPTY_BODY,
  SAINA_DISCOVER_EMPTY_TITLE,
  SAINA_DISCOVER_ERROR,
  SAINA_DISCOVER_ERROR_RETRY,
  SAINA_DISCOVER_HERO_LINE_1,
  SAINA_DISCOVER_HERO_LINE_2,
  SAINA_DISCOVER_HERO_LINE_3,
  SAINA_DISCOVER_TITLE,
} from '@/lib/eza/mirror-network/discoverCopy';
import { fetchDiscoverMirrorsForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import SainaDiscoverList from '@/components/saina/SainaDiscoverList';
import UpgradeModal from '@/components/plan/UpgradeModal';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { gatePremiumFeature } from '@/lib/eza/plan/sainaFeatureGate';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { usePlan } from '@/lib/eza/plan/usePlan';
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
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

export default function SainaDiscoverPage() {
  const router = useRouter();
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();

  const [items, setItems] = useState<DiscoverMirror[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [allExperienced, setAllExperienced] = useState(false);
  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeVariant, setUpgradeVariant] = useState<'upgrade' | 'auth_required'>('upgrade');
  const [upgradeFeature, setUpgradeFeature] = useState('saina_sidebar');

  const refreshArchives = useCallback(() => {
    setArchives(listChatArchives());
  }, []);

  const planTier = resolveSainaPlanTier({ isPlus, isLoading: isPlanLoading, source });

  const { conversations, conversationGroups, activeChatId } = useSainaSidebarConversations(archives);

  const conversationSceneUrl = useMemo(() => {
    if (!activeChatId) return null;
    const url = getChatArchive(activeChatId)?.conversationSceneUrl;
    return url && isPersistableConversationSceneUrl(url) ? url : null;
  }, [archives, activeChatId]);

  const openGateModal = useCallback(
    (feature: string) => {
      const outcome = gatePremiumFeature(planTier);
      setUpgradeFeature(feature);
      setUpgradeVariant(outcome === 'upgrade_required' ? 'upgrade' : 'auth_required');
      setUpgradeOpen(true);
    },
    [planTier]
  );

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
    if (gatePremiumFeature(planTier) !== 'allow') {
      openGateModal('relationship_pattern');
      return;
    }
    router.push(MIRROR_PATTERN_ROUTE, { scroll: false });
  }, [planTier, openGateModal, router]);

  const handleUpgrade = useCallback(() => {
    if (planTier === 'free') {
      setUpgradeFeature('saina_sidebar');
      setUpgradeVariant('upgrade');
      setUpgradeOpen(true);
      return;
    }
    openGateModal('saina_sidebar');
  }, [planTier, openGateModal]);

  const handleRequestLogin = useCallback(() => {
    setUpgradeFeature('saina_session');
    setUpgradeVariant('auth_required');
    setUpgradeOpen(true);
  }, []);

  useSyncSainaChrome({
    activeSection: 'discover',
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
  });

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    setError(false);
    const result = await fetchDiscoverMirrorsForViewer({ targetCount: 24 });
    if (!result.ok) {
      setError(true);
      setItems([]);
      setAllExperienced(false);
      setLoading(false);
      return;
    }
    setItems(result.items);
    setAllExperienced(result.allExperienced);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

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
    const refresh = () => {
      void loadDiscover();
    };
    window.addEventListener(CHATS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, refresh);
  }, [loadDiscover]);

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

  return (
    <>
      <div className="saina-discover-page" data-testid="saina-discover-page">
        <header className="saina-discover-hero">
          <p className="saina-discover-eyebrow">{SAINA_DISCOVER_TITLE}</p>
          <h1 className="saina-discover-headline saina-serif">{SAINA_DISCOVER_HERO_LINE_1}</h1>
          <p className="saina-discover-subhead">
            {SAINA_DISCOVER_HERO_LINE_2}
            <br />
            {SAINA_DISCOVER_HERO_LINE_3}
          </p>
        </header>

        {error ? (
          <div className="saina-discover-state saina-discover-state--error" role="alert">
            <p className="saina-discover-state__title">{SAINA_DISCOVER_ERROR}</p>
            <p className="saina-discover-state__body">{SAINA_DISCOVER_ERROR_RETRY}</p>
            <button type="button" className="saina-discover-retry" onClick={() => void loadDiscover()}>
              Tekrar dene
            </button>
          </div>
        ) : null}

        {!error && !loading && items.length === 0 ? (
          <div className="saina-discover-state" data-testid="saina-discover-empty">
            <p className="saina-discover-state__title">{SAINA_DISCOVER_EMPTY_TITLE}</p>
            <p className="saina-discover-state__body">
              {allExperienced
                ? 'Şimdilik deneyebileceğin yeni merak kalmadı. Biraz sonra tekrar bak.'
                : SAINA_DISCOVER_EMPTY_BODY}
            </p>
            <button
              type="button"
              className="saina-discover-retry"
              onClick={() => router.push('/standalone')}
            >
              Sohbete git
            </button>
          </div>
        ) : null}

        {!error && (loading || items.length > 0) ? (
          <SainaDiscoverList items={items} loading={loading} />
        ) : null}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        variant={upgradeVariant}
        feature={upgradeFeature}
      />
      {deleteModal}
    </>
  );
}
