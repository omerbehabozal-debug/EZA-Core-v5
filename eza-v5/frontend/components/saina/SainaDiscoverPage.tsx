'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useSainaCompactShell } from '@/hooks/useSainaMinWidth';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import SainaPageTopBar from '@/components/saina/SainaPageTopBar';
import {
  SAINA_DISCOVER_EMPTY_BODY,
  SAINA_DISCOVER_EMPTY_TITLE,
  SAINA_DISCOVER_ERROR,
  SAINA_DISCOVER_ERROR_RETRY,
  SAINA_DISCOVER_HERO_LINE_1,
  SAINA_DISCOVER_HERO_LINE_2,
  SAINA_DISCOVER_HERO_LINE_3,
  SAINA_DISCOVER_INVALID_MODE,
  SAINA_DISCOVER_STRONG_CURIOSITY_BODY,
  SAINA_DISCOVER_STRONG_CURIOSITY_TITLE,
  SAINA_DISCOVER_TITLE,
} from '@/lib/eza/mirror-network/discoverCopy';
import { fetchDiscoverPageForViewer } from '@/lib/eza/mirror-network/discoverExperiencedMirrors';
import type { DiscoverMirror } from '@/lib/eza/mirror-network/fetchDiscoverMirrors';
import {
  DEFAULT_DISCOVER_MODE,
  discoverHrefForMode,
  getOrCreateDiscoverRandomSession,
  parseDiscoverModeFromSearch,
  readDiscoverScrollPosition,
  saveDiscoverScrollPosition,
  shouldApplyDiscoverResponse,
  type DiscoverMode,
} from '@/lib/eza/mirror-network/discoverModes';
import {
  DISCOVER_FIRST_EMPTY_FILL_PAGES,
  appendDiscoverItems,
  createDiscoverNextPageGate,
  discoverPrefetchObserverOptions,
  shouldAcceptDiscoverPage,
} from '@/lib/eza/mirror-network/discoverFeed';
import SainaDiscoverList from '@/components/saina/SainaDiscoverList';
import SainaDiscoverModeSelector from '@/components/saina/SainaDiscoverModeSelector';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import { SAINA_NEW_CHAT_ROUTE } from '@/lib/eza/sainaRoutes';
import { useSainaSidebarConversations } from '@/hooks/useSainaSidebarConversations';
import { canStartDiscoverFromEntitlements } from '@/lib/eza/plan/sainaDiscoverQuota';
import { resolveDiscoverLimitMessage } from '@/lib/eza/plan/sainaQuotaMessages';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
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
import { useAuthenticatedConversationBootstrap } from '@/hooks/useAuthenticatedConversationBootstrap';
import { deleteServerBackedConversation } from '@/lib/eza/serverConversationStore';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';

const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

export default function SainaDiscoverPage() {
  const router = useRouter();
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements } = useAccountEntitlements();

  const [items, setItems] = useState<DiscoverMirror[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [allExperienced, setAllExperienced] = useState(false);
  const [mode, setMode] = useState<DiscoverMode>(DEFAULT_DISCOVER_MODE);
  const [modeInvalid, setModeInvalid] = useState(false);
  const [strongCuriosityReady, setStrongCuriosityReady] = useState(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const randomSessionRef = useRef<string | null>(null);
  const modeRef = useRef<DiscoverMode>(DEFAULT_DISCOVER_MODE);
  const nextPageGateRef = useRef(createDiscoverNextPageGate());
  const loadNextPageRef = useRef<() => void>(() => {});
  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const { isServerBacked, serverSummaries } = useAuthenticatedConversationBootstrap();

  const refreshArchives = useCallback(() => {
    if (isServerBacked) {
      setArchives(serverSummaries);
    } else {
      setArchives(listChatArchives());
    }
  }, [isServerBacked, serverSummaries]);

  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const discoverLimitReached = !canStartDiscoverFromEntitlements(accountEntitlements);
  const discoverLimitMessage = resolveDiscoverLimitMessage(accountEntitlements.tier);
  const isCompactShell = useSainaCompactShell();
  const openMobileSidebar = () => useSainaChromeStore.getState().openMobileSidebar?.();
  const openCommandPalette = () => useSainaChromeStore.getState().openCommandPalette?.();
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

  const handleOpenDiscoverUpgrade = useCallback(() => {
    handleUpgrade('saina_discover');
  }, [handleUpgrade]);

  const handleOpenPattern = useCallback(() => {
    router.push(MIRROR_PATTERN_ROUTE, { scroll: false });
  }, [router]);


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

  const loadDiscover = useCallback(async (nextMode: DiscoverMode) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    nextPageGateRef.current.reset();
    modeRef.current = nextMode;
    offsetRef.current = 0;
    hasMoreRef.current = false;
    setHasMore(false);
    setLoading(true);
    setLoadingMore(false);
    setLoadMoreError(false);
    setError(false);
    setItems([]);
    setAllExperienced(false);
    setStrongCuriosityReady(false);
    const randomSession =
      nextMode === 'random' ? getOrCreateDiscoverRandomSession() : null;
    randomSessionRef.current = randomSession;

    const collected: DiscoverMirror[] = [];
    let nextOffset = 0;
    let pageHasMore = false;
    let ready = false;
    let experienced = false;
    const maxPages = nextMode === 'random' ? DISCOVER_FIRST_EMPTY_FILL_PAGES : 1;

    for (let page = 0; page < maxPages; page += 1) {
      const result = await fetchDiscoverPageForViewer({
        offset: nextOffset,
        mode: nextMode,
        randomSession: nextMode === 'random' ? randomSessionRef.current : null,
        signal: controller.signal,
      });
      if (!shouldApplyDiscoverResponse(requestId, requestIdRef.current)) {
        return;
      }
      if (!result.ok) {
        if (controller.signal.aborted) return;
        if (collected.length > 0) {
          setItems(collected);
          setLoading(false);
          setLoadMoreError(true);
          return;
        }
        setError(true);
        setItems([]);
        setAllExperienced(false);
        setLoading(false);
        void import('@/lib/eza/opsTelemetry').then(({ reportOpsFailure }) => {
          reportOpsFailure('discover_load_failed', 'DISCOVER_LOAD_FAILED');
        });
        return;
      }
      randomSessionRef.current = result.randomSession ?? randomSessionRef.current;
      ready = result.strongCuriosityReady;
      experienced = result.allExperienced;
      const merged = appendDiscoverItems(collected, result.items);
      collected.splice(0, collected.length, ...merged.items);
      offsetRef.current = result.nextOffset;
      nextOffset = result.nextOffset;
      pageHasMore = result.hasMore;
      hasMoreRef.current = pageHasMore;
      if (collected.length > 0 || !pageHasMore) break;
    }

    setItems(collected);
    setAllExperienced(experienced && collected.length === 0);
    setStrongCuriosityReady(ready);
    setHasMore(pageHasMore);
    setLoading(false);

    if (pageHasMore) {
      void loadNextPageRef.current();
    }
  }, []);

  const loadNextPage = useCallback(async () => {
    if (!hasMoreRef.current) return;
    if (!nextPageGateRef.current.tryBegin()) return;
    const requestId = requestIdRef.current;
    const expectedOffset = offsetRef.current;
    const nextMode = modeRef.current;
    setLoadMoreError(false);
    setLoadingMore(true);
    const result = await fetchDiscoverPageForViewer({
      offset: expectedOffset,
      mode: nextMode,
      randomSession: nextMode === 'random' ? randomSessionRef.current : null,
      signal: abortRef.current?.signal,
    });
    if (
      !shouldAcceptDiscoverPage({
        requestId,
        currentId: requestIdRef.current,
        expectedOffset,
        receivedOffset: result.ok ? result.offset : expectedOffset,
      })
    ) {
      nextPageGateRef.current.end();
      setLoadingMore(false);
      return;
    }
    nextPageGateRef.current.end();
    setLoadingMore(false);
    if (!result.ok) {
      if (abortRef.current?.signal.aborted) return;
      setLoadMoreError(true);
      return;
    }
    randomSessionRef.current = result.randomSession ?? randomSessionRef.current;
    setStrongCuriosityReady(result.strongCuriosityReady);
    offsetRef.current = result.nextOffset;
    hasMoreRef.current = result.hasMore;
    setHasMore(result.hasMore);
    setItems((prev) => appendDiscoverItems(prev, result.items).items);
  }, []);

  loadNextPageRef.current = loadNextPage;

  const applySearchMode = useCallback(() => {
    const parsed = parseDiscoverModeFromSearch(
      typeof window === 'undefined' ? '' : window.location.search
    );
    if (!parsed.ok) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setModeInvalid(true);
      setMode(DEFAULT_DISCOVER_MODE);
      setItems([]);
      setLoading(false);
      setError(false);
      return;
    }
    setModeInvalid(false);
    setMode(parsed.mode);
    void loadDiscover(parsed.mode);
  }, [loadDiscover]);

  const handleModeChange = useCallback(
    (next: DiscoverMode) => {
      if (next === mode && !modeInvalid) return;
      setModeInvalid(false);
      setMode(next);
      router.replace(discoverHrefForMode(next), { scroll: false });
      void loadDiscover(next);
    },
    [loadDiscover, mode, modeInvalid, router]
  );

  useEffect(() => {
    applySearchMode();
    const onPop = () => applySearchMode();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      abortRef.current?.abort();
    };
  }, [applySearchMode]);

  useEffect(() => {
    if (loading || !hasMore || items.length === 0) return;
    const root = scrollRootRef.current;
    const target = sentinelRef.current;
    if (!root || !target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadNextPageRef.current();
      }
    }, discoverPrefetchObserverOptions(root));
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, items.length, loading]);

  // Phase 8.7 — persist scroll so Discover←Yansı back keeps place + randomSession.
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const onScroll = () => {
      saveDiscoverScrollPosition(mode, root.scrollTop);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [mode]);

  useEffect(() => {
    if (loading || items.length === 0) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const saved = readDiscoverScrollPosition(mode);
    if (saved == null || saved <= 0) return;
    root.scrollTop = saved;
  }, [loading, items.length, mode]);

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
      void loadDiscover(mode);
    };
    window.addEventListener(CHATS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHATS_UPDATED_EVENT, refresh);
  }, [loadDiscover, mode]);

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
      <div className="saina-main saina-discover-main">
        {!isCompactShell ? (
          <div className="saina-standalone-mobile-bar">
            <button
              type="button"
              className="saina-standalone-menu-btn"
              data-testid="saina-discover-mobile-menu-btn"
              onClick={openMobileSidebar}
              aria-label="Menü"
            >
              <Menu size={20} />
            </button>
          </div>
        ) : null}

        <SainaPageTopBar
          onOpenCommandPalette={openCommandPalette}
          safeOnlyMode={safeOnlyMode}
          onSafeOnlyModeChange={setSafeOnlyMode}
          analysisModelId={analysisModelId}
          onAnalysisModelChange={setAnalysisModelId}
        />

        <div className="saina-discover-content-scroll" ref={scrollRootRef}>
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

        <SainaDiscoverModeSelector mode={mode} onChange={handleModeChange} />

        {modeInvalid ? (
          <div className="saina-discover-state saina-discover-state--error" role="alert">
            <p className="saina-discover-state__title">{SAINA_DISCOVER_INVALID_MODE}</p>
          </div>
        ) : null}

        {discoverLimitReached && !modeInvalid ? (
          <div
            className="saina-discover-state saina-discover-state--limit"
            data-testid="saina-discover-limit-banner"
            role="status"
          >
            <p className="saina-discover-state__body saina-discover-state__body--preline">
              {discoverLimitMessage}
            </p>
            <button
              type="button"
              className="saina-discover-retry"
              onClick={handleOpenDiscoverUpgrade}
            >
              Hesabını Yükselt
            </button>
          </div>
        ) : null}

        {error && !modeInvalid ? (
          <div className="saina-discover-state saina-discover-state--error" role="alert">
            <p className="saina-discover-state__title">{SAINA_DISCOVER_ERROR}</p>
            <p className="saina-discover-state__body">{SAINA_DISCOVER_ERROR_RETRY}</p>
            <button type="button" className="saina-discover-retry" onClick={() => void loadDiscover(mode)}>
              Tekrar dene
            </button>
          </div>
        ) : null}

        {!error &&
        !modeInvalid &&
        !loading &&
        mode === 'strong_curiosity' &&
        items.length === 0 &&
        !strongCuriosityReady ? (
          <div
            className="saina-discover-state"
            data-testid="saina-discover-strong-curiosity-pending"
            data-strong-curiosity-ready="false"
          >
            <p className="saina-discover-state__title">{SAINA_DISCOVER_STRONG_CURIOSITY_TITLE}</p>
            <p className="saina-discover-state__body">{SAINA_DISCOVER_STRONG_CURIOSITY_BODY}</p>
          </div>
        ) : null}

        {!error &&
        !modeInvalid &&
        items.length === 0 &&
        !loading &&
        (mode !== 'strong_curiosity' || strongCuriosityReady) ? (
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
              onClick={() => router.push(SAINA_NEW_CHAT_ROUTE)}
            >
              Sohbete git
            </button>
          </div>
        ) : null}

        {!error && !modeInvalid && (loading || items.length > 0) ? (
          <SainaDiscoverList
            items={items}
            loading={loading}
            loadingMore={loadingMore}
            loadMoreError={loadMoreError}
            onRetryLoadMore={() => loadNextPageRef.current()}
            sentinelRef={sentinelRef}
            discoverLimitReached={discoverLimitReached}
            onDiscoverLimit={handleOpenDiscoverUpgrade}
          />
        ) : null}
          </div>
        </div>
      </div>

      {gateModals}
      {deleteModal}
    </>
  );
}
