'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  CHATS_UPDATED_EVENT,
  listChatArchives,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { useMirrorEntries } from '@/components/standalone/MirrorEntriesContext';
import RelationshipPatternView from '@/components/mirror/RelationshipPatternView';
import PatternPlusUpsellBanner from '@/components/mirror/relationship/PatternPlusUpsellBanner';
import SainaPatternShell from '@/components/saina/SainaPatternShell';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import UpgradeModal from '@/components/plan/UpgradeModal';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { gatePremiumFeature } from '@/lib/eza/plan/sainaFeatureGate';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { usePlan } from '@/lib/eza/plan/usePlan';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';
const FREE_EMPTY_ENTRIES: SavedBehavioralEntry[] = [];

export default function SainaPatternPageInner() {
  const router = useRouter();
  const realEntries = useMirrorEntries();
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();

  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeVariant, setUpgradeVariant] = useState<'upgrade' | 'auth_required'>('upgrade');
  const [upgradeFeature, setUpgradeFeature] = useState('relationship_pattern');

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

  const planTier = resolveSainaPlanTier({ isPlus, isLoading: isPlanLoading, source });
  const planResolved = !isPlanLoading;
  const isPremium = planResolved && gatePremiumFeature(planTier) === 'allow';

  const entries = useMemo(
    () => (isPremium ? realEntries : FREE_EMPTY_ENTRIES),
    [isPremium, realEntries]
  );

  const conversations = useMemo(
    () => mapArchivesToSainaConversations(archives),
    [archives]
  );

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

  const handleOpenPattern = useCallback(() => {
    /* Already on pattern route — keep sidebar card active. */
  }, []);

  const handleUpgrade = useCallback(() => {
    if (planTier === 'free') {
      setUpgradeFeature('relationship_pattern');
      setUpgradeVariant('upgrade');
      setUpgradeOpen(true);
      return;
    }
    openGateModal('relationship_pattern');
  }, [planTier, openGateModal]);

  const handleRequestLogin = useCallback(() => {
    setUpgradeFeature('saina_session');
    setUpgradeVariant('auth_required');
    setUpgradeOpen(true);
  }, []);

  useSyncSainaChrome({
    activeSection: 'pattern',
    conversations,
    activeChatId: null,
    planTier,
    onNewChat: handleNewChat,
    onSelectChat: handleSelectChat,
    onOpenPattern: handleOpenPattern,
    onUpgrade: handleUpgrade,
    onRequestLogin: handleRequestLogin,
    safeOnlyMode,
    onSafeOnlyModeChange: setSafeOnlyMode,
    analysisModelId,
    onAnalysisModelChange: setAnalysisModelId,
  });

  return (
    <>
      <SainaPatternShell
        conversations={conversations}
        activeChatId={null}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
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
            {!isPremium ? (
              <PatternPlusUpsellBanner
                className="relative z-[1] shrink-0"
                onCtaClick={handleUpgrade}
              />
            ) : null}
            <RelationshipPatternView
              entries={entries}
              previewMode={!isPremium}
              className="relative z-[1] min-h-0 flex-1"
            />
          </>
        )}
      </SainaPatternShell>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        variant={upgradeVariant}
        feature={upgradeFeature}
      />
    </>
  );
}
