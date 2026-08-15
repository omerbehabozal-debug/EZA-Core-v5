/**
 * Standalone Chat Page - Pure Score Analyzer Mode
 * Public Access (App Router Version)
 * No authentication required
 * 
 * Features:
 * - Score-only mode (0-100 badges)
 * - SAFE-only mode (rewrite enabled)
 * - Tier-based message limits (backend authority)
 * - Çoklu sohbet sekmeleri; otomatik kayıt; sekmeye dönünce kaldığın yerden devam
 * - Minimal UI (no tooltips, no extra info)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MessageList from '@/components/standalone/MessageList';
import SainaComposer from '@/components/saina/SainaComposer';
import JourneyWindowDecisionBanner from '@/components/mirror/JourneyWindowDecisionBanner';
import JourneyGenerationStatus from '@/components/mirror/JourneyGenerationStatus';
import Review8Screen from '@/components/mirror/Review8Screen';
import {
  canAcceptAnotherJourneyQuestion,
  canSendMoreJourneyQuestions,
  confirmJourneyWindow,
  extractQaPairs,
  getAwaitingDecisionWindow,
  isMirrorJourneyV1ClientEnabled,
  loadMirrorJourneyArtifact,
  markJourneyWindowReady,
  markJourneyWindowReviewing,
  markMirrorJourneyArtifactGenerating,
  pairsForWindow,
  reopenJourneyWindowDecision,
  resolveAuthorDisplayName,
  resolveParentJourneyId,
  saveJourneyConversationState,
  skipJourneyWindow,
  syncJourneyConversationState,
  type JourneyConversationState,
  type Review8Draft,
} from '@/lib/eza/mirror/journey';
import { loadJourneyConversationState } from '@/lib/eza/mirror/journey/journeyWindowStore';
import { MIRROR_JOURNEY_CONVERSATION_CLOSED } from '@/lib/eza/mirror/copy';
import { useAuth } from '@/context/AuthContext';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { useSainaDeleteChatModal } from '@/hooks/useSainaDeleteChatModal';
import { usePatternDeviceSync } from '@/hooks/usePatternDeviceSync';
import { useSainaGateModals } from '@/hooks/useSainaGateModals';
import NewChatGroupPicker from '@/components/saina/NewChatGroupPicker';
import {
  createConversationGroup,
  listConversationGroups,
  GROUPS_UPDATED_EVENT,
} from '@/lib/eza/conversation-tree/conversationGroups';
import { buildConversationTree } from '@/lib/eza/conversation-tree/groupTree';
import { rememberActiveGroupExpanded } from '@/lib/eza/conversation-tree/groupExpandedState';
import { trackConversationGroupCreated } from '@/lib/eza/conversation-tree/conversationTreeAnalytics';
import type { ConversationGroup } from '@/lib/eza/conversation-tree/types';
import { mapArchivesToSainaConversations } from '@/lib/eza/sainaConversationList';
import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';
import {
  canViewRelationshipMapData,
  getRelationshipMapAccess,
} from '@/lib/eza/plan/sainaRelationshipMapAccess';
import { useAccountEntitlements } from '@/lib/eza/plan/useAccountEntitlements';
import { usePlan } from '@/lib/eza/plan/usePlan';
import {
  extractQuotaDetail,
  isQuotaLimitReason,
  resolveChatLimitMessage,
} from '@/lib/eza/plan/sainaQuotaMessages';
import { buildSainaQuotaHeaders, hasSainaAuthToken } from '@/lib/eza/plan/sainaQuotaHeaders';
import { resolveSainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { useStreamResponse } from '@/hooks/useStreamResponse';
import type {
  BehavioralSnapshot,
  StandaloneFeedbackContext,
  StandaloneObservation,
} from '@/lib/types';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import {
  buildConversationMirrorEntries,
  persistChatTurnFromResponse,
} from '@/lib/eza/mirror/conversationMirrorEntries';
import {
  getEzaUserPreferences,
  shouldShowEzaInExperience,
  subscribeEzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';
import { useSetConversationMirrorEntries, PENDING_CONVERSATION_MIRROR_ID } from '@/components/standalone/MirrorEntriesContext';
import {
  clearActiveConversationLiveMessages,
  setActiveConversationLiveMessages,
} from '@/lib/eza/mirror/activeConversationLiveMessages';
import {
  CHATS_UPDATED_EVENT,
  clearMirrorAutoReplyPending,
  createStandaloneChat,
  deleteChatArchive,
  getChatArchive,
  listChatArchives,
  pruneEmptyChats,
  resolveChatRouteAfterDelete,
  saveStandaloneChat,
  writeActiveChatId,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { MIRROR_GUEST_CHAT_REPLY_PARAM } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import {
  isSainaNewChatRequest,
  SAINA_DISCOVER_ROUTE,
  SAINA_NEW_CHAT_ROUTE,
} from '@/lib/eza/sainaRoutes';
import {
  DELETED_CHAT_IDS_STORAGE_KEY,
  isChatDeleted,
} from '@/lib/standaloneChatDelete';
import { trackSecondUserMessageSent } from '@/lib/eza/mirror-network/mirrorSohbetAnalytics';
import MirrorBranchSuggestion from '@/components/standalone/MirrorBranchSuggestion';
import MirrorBirthSuggestion from '@/components/standalone/MirrorBirthSuggestion';
import { shouldShowBranchSuggestion } from '@/lib/eza/conversation-tree/branchSuggestionPolicy';
import {
  isBranchSuggestionDismissed,
  isBranchSuggestionShown,
  markBranchSuggestionDismissed,
  markBranchSuggestionShown,
} from '@/lib/eza/conversation-tree/branchSuggestionSession';
import {
  resolveBranchCardsForChat,
  startMirrorBranchConversation,
} from '@/lib/eza/conversation-tree/mirrorBranchConversation';
import {
  trackBranchCardClicked,
  trackBranchSuggestionShown,
} from '@/lib/eza/conversation-tree/conversationTreeAnalytics';
import {
  evaluateMirrorBirth,
  shouldShowMirrorBirthSuggestion,
} from '@/lib/eza/mirror-birth/mirrorBirthPolicy';
import {
  isMirrorBirthDismissed,
  isMirrorBirthShown,
  markMirrorBirthDismissed,
  markMirrorBirthShown,
} from '@/lib/eza/mirror-birth/mirrorBirthSession';
import { hasConversationMirrorArtifact } from '@/lib/eza/mirror-birth/mirrorBirthConversation';
import {
  requestMirrorBirthGeneration,
  trackMirrorBirthAccepted,
  trackMirrorBirthDismissed,
  trackMirrorBirthSuggested,
} from '@/lib/eza/mirror-birth/mirrorBirthAnalytics';
import { setMirrorBirthDebugState } from '@/lib/eza/mirror-birth/mirrorBirthDebugState';
import { useSainaChromeStore } from '@/lib/eza/sainaChromeStore';
import {
  fromArchivedMessages,
  toArchivedMessages,
} from '@/lib/standaloneChatSession';
import { feedbackContextFromGovernance, parseGovernance } from '@/lib/standaloneFeedback';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';
import { buildChatHistoryPayload } from '@/lib/standaloneChatHistory';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import type { MirrorMobileContext } from '@/lib/eza/mirrorMobileState';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number; // 0-100 for user message
  assistantScore?: number; // 0-100 for assistant message
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp: Date;
  behavioral?: BehavioralSnapshot | null;
  standaloneObservation?: StandaloneObservation | null;
  feedback?: StandaloneFeedbackContext | null;
  /** Streaming assistant — not an eligible Journey Q/A until complete. */
  incomplete?: boolean;
}

// localStorage keys
const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';

/** Hydrate chat from ?chat= on first paint — avoids empty Ayna flash after Keşfet remount. */
function readChatStateFromUrl(chatIdFromUrl: string | null): {
  chatId: string | null;
  messages: Message[];
} {
  if (!chatIdFromUrl || isChatDeleted(chatIdFromUrl)) {
    return { chatId: null, messages: [] };
  }
  const chat = getChatArchive(chatIdFromUrl);
  if (!chat) return { chatId: null, messages: [] };
  return { chatId: chatIdFromUrl, messages: fromArchivedMessages(chat.messages) };
}

export default function StandaloneChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams?.get('chat') ?? null;
  const mirrorReplyFromUrl = searchParams?.get(MIRROR_GUEST_CHAT_REPLY_PARAM) === '1';

  const initialChat = readChatStateFromUrl(chatIdFromUrl);
  const [chatId, setChatId] = useState<string | null>(initialChat.chatId);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialChat.messages);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [archives, setArchives] = useState<ArchivedChatSummary[]>([]);
  const [conversationGroups, setConversationGroups] = useState<ConversationGroup[]>([]);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [branchSuggestionVisible, setBranchSuggestionVisible] = useState(false);
  const [branchCards, setBranchCards] = useState<string[]>([]);
  const [mirrorBirthVisible, setMirrorBirthVisible] = useState(false);
  const lastUserMessageAtRef = useRef<number | null>(null);
  const lastAssistantDoneAtRef = useRef<number | null>(null);
  const onOpenMirror = useSainaChromeStore((state) => state.onOpenMirror);
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();
  const { entitlements: accountEntitlements, refreshEntitlements } = useAccountEntitlements();
  const { user, isAuthenticated } = useAuth();
  const journeyOwnerId = user?.user_id?.trim() || '';
  const [ezaPrefsTick, setEzaPrefsTick] = useState(0);
  useEffect(() => subscribeEzaUserPreferences(() => setEzaPrefsTick((n) => n + 1)), []);
  const ezaPrefs = useMemo(
    () => getEzaUserPreferences(journeyOwnerId || null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces re-read after settings mutate
    [journeyOwnerId, ezaPrefsTick]
  );
  const ezaVisibilityEnabled = shouldShowEzaInExperience(ezaPrefs);
  const [journeyState, setJourneyState] = useState<JourneyConversationState | null>(null);
  const [journeyReviewOpen, setJourneyReviewOpen] = useState(false);
  const [journeyReviewWindowIndex, setJourneyReviewWindowIndex] = useState<number | null>(
    null
  );
  const messageLimit = accountEntitlements.usage.dailyMessagesLimit;
  const isMessageLimitReached =
    messageLimit != null &&
    accountEntitlements.usage.dailyMessagesUsed >= messageLimit;
  const journeyV1On = isMirrorJourneyV1ClientEnabled();
  const journeyMessages = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        text: m.text,
        isUser: m.isUser,
        incomplete: m.incomplete,
      })),
    [messages]
  );
  const journeyClosed =
    journeyV1On &&
    isAuthenticated &&
    (!canSendMoreJourneyQuestions(journeyState) ||
      !canAcceptAnotherJourneyQuestion(journeyMessages, journeyState));
  const composerDisabled = isMessageLimitReached || journeyClosed;
  const quotaHeaders = useMemo(() => buildSainaQuotaHeaders(), []);
  const { startStream, reset: resetStream } = useStreamResponse();
  const setConversationMirrorEntries = useSetConversationMirrorEntries();
  const currentAssistantMessageRef = useRef<string | null>(null);
  const assistantScoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutosaveRef = useRef(true);
  /** İlk açılış/yenilemede URL’deki eski ?chat= ile yanlış sohbet yüklenmesin */
  const urlSyncEnabledRef = useRef(false);
  const mirrorReplyFiredRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const messagesRef = useRef(messages);
  const chatIdRef = useRef(chatId);
  messagesRef.current = messages;
  chatIdRef.current = chatId;

  const flushSave = useCallback((id: string, msgs: Message[]) => {
    if (isChatDeleted(id)) return;
    saveStandaloneChat(id, toArchivedMessages(msgs));
  }, []);

  const cancelPendingAutosave = useCallback(() => {
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const resetStateAfterActiveDelete = useCallback(() => {
    cancelPendingAutosave();
    skipAutosaveRef.current = true;
    resetStream();
    setChatId(null);
    setMessages([]);
    setIsLoading(false);
    setIsTyping(false);
    setBranchSuggestionVisible(false);
    setMirrorBirthVisible(false);
    setConversationMirrorEntries([], PENDING_CONVERSATION_MIRROR_ID);
  }, [cancelPendingAutosave, resetStream, setConversationMirrorEntries]);

  const loadChatIntoState = useCallback(
    (id: string) => {
      const chat = getChatArchive(id);
      if (!chat) return false;
      skipAutosaveRef.current = true;
      resetStream();
      setChatId(id);
      writeActiveChatId(id);
      setMessages(fromArchivedMessages(chat.messages));
      setIsLoading(false);
      setIsTyping(false);
      window.setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
      return true;
    },
    [resetStream]
  );

  /**
   * Boş bir taslak başlatır: henüz arşive yazılmaz (lazy creation).
   * Gerçek arşiv kaydı ilk mesaj gönderildiğinde `handleSend` içinde oluşur.
   */
  const startDraft = useCallback(() => {
    skipAutosaveRef.current = true;
    resetStream();
    setChatId(null);
    setMessages([]);
    setIsLoading(false);
    setIsTyping(false);
    window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
  }, [resetStream]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSafeOnly = localStorage.getItem(STORAGE_KEY_SAFE_ONLY);
    if (savedSafeOnly !== null) {
      setSafeOnlyMode(savedSafeOnly === 'true');
    }
    setAnalysisModelId(readStoredAnalysisModel());
  }, []);

  // Save safeOnlyMode to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAFE_ONLY, safeOnlyMode.toString());
  }, [safeOnlyMode]);

  useEffect(() => {
    writeStoredAnalysisModel(analysisModelId);
  }, [analysisModelId]);

  // Lazy: sayfa açılışında/yenilemede boş sohbet OLUŞTURULMAZ.
  // Geçerli ?chat= → mevcut sohbet yüklenir (deep-link / F5 korunur).
  // ?new=1 → bilinçli yeni taslak.
  // Aksi halde Keşfet (home) — programa giriş Keşfet’ten başlar.
  useEffect(() => {
    if (ready) return;

    const enableUrlSync = () => {
      window.setTimeout(() => {
        urlSyncEnabledRef.current = true;
      }, 0);
    };

    if (chatIdFromUrl && getChatArchive(chatIdFromUrl)) {
      pruneEmptyChats(chatIdFromUrl);
      loadChatIntoState(chatIdFromUrl);
      setReady(true);
      enableUrlSync();
      return;
    }

    pruneEmptyChats();

    if (chatIdFromUrl) {
      // Stale/missing ?chat= — drop to home rather than inventing a draft.
      router.replace(SAINA_DISCOVER_ROUTE, { scroll: false });
      setReady(true);
      enableUrlSync();
      return;
    }

    if (isSainaNewChatRequest(searchParams?.toString() ?? null)) {
      startDraft();
      setReady(true);
      enableUrlSync();
      return;
    }

    router.replace(SAINA_DISCOVER_ROUTE, { scroll: false });
    setReady(true);
    enableUrlSync();
  }, [ready, chatIdFromUrl, router, loadChatIntoState, startDraft, searchParams]);

  useEffect(() => {
    if (!ready || !urlSyncEnabledRef.current || !chatIdFromUrl) return;
    if (chatIdFromUrl === chatId) return;

    const prevId = chatIdRef.current;
    if (prevId && !skipAutosaveRef.current && !isChatDeleted(prevId)) {
      flushSave(prevId, messagesRef.current);
    }

    if (loadChatIntoState(chatIdFromUrl)) return;

    // Arşivde olmayan (silinmiş/eski) ?chat= → Keşfet home.
    router.replace(SAINA_DISCOVER_ROUTE, { scroll: false });
  }, [chatIdFromUrl, chatId, ready, flushSave, loadChatIntoState, router]);

  useEffect(() => {
    if (skipAutosaveRef.current || !chatId || isChatDeleted(chatId)) return;
    cancelPendingAutosave();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      flushSave(chatId, messages);
    }, 400);
    return () => {
      cancelPendingAutosave();
    };
  }, [messages, chatId, flushSave, cancelPendingAutosave]);

  useEffect(() => {
    return () => {
      const id = chatIdRef.current;
      if (id && !skipAutosaveRef.current && !isChatDeleted(id)) {
        flushSave(id, messagesRef.current);
      }
    };
  }, [flushSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (assistantScoreTimeoutRef.current) {
        clearTimeout(assistantScoreTimeoutRef.current);
      }
      resetStream();
    };
  }, [resetStream]);

  const refreshArchives = useCallback(() => {
    setArchives(listChatArchives());
    setConversationGroups(listConversationGroups());
  }, []);

  useEffect(() => {
    refreshArchives();
    window.addEventListener(CHATS_UPDATED_EVENT, refreshArchives);
    window.addEventListener(GROUPS_UPDATED_EVENT, refreshArchives);
    window.addEventListener('focus', refreshArchives);
    return () => {
      window.removeEventListener(CHATS_UPDATED_EVENT, refreshArchives);
      window.removeEventListener(GROUPS_UPDATED_EVENT, refreshArchives);
      window.removeEventListener('focus', refreshArchives);
    };
  }, [refreshArchives]);

  const openChatInGroup = useCallback(
    (groupId: string) => {
      if (chatId && !skipAutosaveRef.current && toArchivedMessages(messages).length > 0) {
        flushSave(chatId, messages);
      }
      const newId = createStandaloneChat({ groupId });
      rememberActiveGroupExpanded(groupId);
      setGroupPickerOpen(false);
      router.push(`/standalone?chat=${newId}`, { scroll: false });
      loadChatIntoState(newId);
    },
    [chatId, messages, flushSave, router, loadChatIntoState]
  );

  const handleNewChat = useCallback(() => {
    if (chatId && !skipAutosaveRef.current && toArchivedMessages(messages).length > 0) {
      flushSave(chatId, messages);
    }
    setGroupPickerOpen(true);
  }, [chatId, messages, flushSave]);

  const handleCreateGroupAndChat = useCallback(
    (title: string) => {
      const group = createConversationGroup({ title, source: 'manual' });
      trackConversationGroupCreated(group.id);
      openChatInGroup(group.id);
    },
    [openChatInGroup]
  );

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

      const wasActive = chatId === id;
      if (wasActive) {
        cancelPendingAutosave();
        skipAutosaveRef.current = true;
      }

      deleteChatArchive(id);

      if (wasActive) {
        resetStateAfterActiveDelete();
        router.push(resolveChatRouteAfterDelete(), { scroll: false });
      }
    },
    [
      chatId,
      router,
      cancelPendingAutosave,
      resetStateAfterActiveDelete,
    ]
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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DELETED_CHAT_IDS_STORAGE_KEY) return;
      const currentId = chatIdRef.current;
      if (!currentId || !isChatDeleted(currentId)) return;

      cancelPendingAutosave();
      skipAutosaveRef.current = true;
      resetStateAfterActiveDelete();
      router.push(resolveChatRouteAfterDelete(), { scroll: false });
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cancelPendingAutosave, resetStateAfterActiveDelete, router]);

  const planTier = resolveSainaPlanTier({
    isPlus,
    isLoading: isPlanLoading,
    source,
    accountTier: accountEntitlements.tier,
  });
  const mapAccess = getRelationshipMapAccess(accountEntitlements);
  const canViewMapData = canViewRelationshipMapData(mapAccess);
  const {
    openGateModal,
    handleRequestLogin,
    handleOpenUpgrade,
    gateModals,
  } = useSainaGateModals({ planTier, defaultUpgradeFeature: 'saina_sidebar' });
  const planResolved = !isPlanLoading;

  const { systemNotifications } = usePatternDeviceSync({
    hasMapDataAccess: canViewMapData,
    archives,
  });

  const handleOpenPattern = useCallback(() => {
    router.push(MIRROR_PATTERN_ROUTE, { scroll: false });
  }, [router]);

  const handleRequestMirror = useCallback((): boolean => {
    if (planTier === 'session_invalid') {
      openGateModal('conversation_mirror');
      return false;
    }
    return true;
  }, [planTier, openGateModal]);

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  useEffect(() => {
    setConversationMirrorEntries(
      buildConversationMirrorEntries(messages),
      chatId ?? PENDING_CONVERSATION_MIRROR_ID
    );
    if (chatId) {
      setActiveConversationLiveMessages(
        chatId,
        messages.map((m) => ({ id: m.id, text: m.text, isUser: m.isUser }))
      );
    }
    return () => {
      // Keep conversation mirror scope across Keşfet/EZA route remounts.
      // Clearing to null made Ayna fall back to open_first empty state.
      if (chatId) clearActiveConversationLiveMessages(chatId);
    };
  }, [messages, chatId, setConversationMirrorEntries]);

  useEffect(() => {
    if (!journeyV1On || !isAuthenticated || !journeyOwnerId || !chatId) {
      setJourneyState(null);
      return;
    }
    const mapMessages = () =>
      messages.map((m) => ({
        id: m.id,
        text: m.text,
        isUser: m.isUser,
        incomplete: m.incomplete,
      }));
    const archive = getChatArchive(chatId);
    const originatingParentJourneyId =
      archive?.mirrorOrigin?.startedFromMirrorId?.trim() ||
      archive?.treeMetadata?.startedFromMirrorId?.trim() ||
      null;
    const persist = (candidate: JourneyConversationState) => {
      const saved = saveJourneyConversationState(candidate);
      if (saved.ok) {
        setJourneyState(saved.state);
        return;
      }
      // Another tab won — re-sync onto authoritative state, then CAS again.
      const merged = syncJourneyConversationState({
        state: saved.current,
        ownerUserId: journeyOwnerId,
        sourceConversationId: chatId,
        messages: mapMessages(),
        originatingParentJourneyId,
      });
      const again = saveJourneyConversationState(merged);
      setJourneyState(again.ok ? again.state : saved.current);
    };

    const prev = loadJourneyConversationState(journeyOwnerId, chatId);
    const next = syncJourneyConversationState({
      state: prev,
      ownerUserId: journeyOwnerId,
      sourceConversationId: chatId,
      messages: mapMessages(),
      originatingParentJourneyId,
    });
    const changed =
      !prev ||
      prev.conversationClosed !== next.conversationClosed ||
      prev.acceptedEligibleQuestionCount !== next.acceptedEligibleQuestionCount ||
      prev.eligiblePairCount !== next.eligiblePairCount ||
      prev.originatingParentJourneyId !== next.originatingParentJourneyId ||
      JSON.stringify(prev.windows) !== JSON.stringify(next.windows);
    if (changed) {
      persist(next);
    } else {
      setJourneyState(next);
    }
  }, [messages, chatId, journeyOwnerId, journeyV1On, isAuthenticated]);

  const awaitingJourneyWindow = getAwaitingDecisionWindow(journeyState);
  const generatingWindow = journeyState?.windows.find((w) => w.status === 'generating');
  const readyWindow = journeyState?.windows.find((w) => w.status === 'ready');

  const persistJourneyMutation = useCallback(
    (candidate: JourneyConversationState) => {
      const saved = saveJourneyConversationState(candidate);
      if (saved.ok) {
        setJourneyState(saved.state);
        return saved.state;
      }
      setJourneyState(saved.current);
      return saved.current;
    },
    []
  );

  const handleJourneySkip = useCallback(() => {
    if (!journeyState || awaitingJourneyWindow == null) return;
    const next = skipJourneyWindow(journeyState, awaitingJourneyWindow.windowIndex);
    persistJourneyMutation(next);
    setJourneyReviewOpen(false);
    setJourneyReviewWindowIndex(null);
  }, [journeyState, awaitingJourneyWindow, persistJourneyMutation]);

  const handleJourneyCreate = useCallback(() => {
    if (!journeyState || awaitingJourneyWindow == null) return;
    const next = markJourneyWindowReviewing(
      journeyState,
      awaitingJourneyWindow.windowIndex
    );
    persistJourneyMutation(next);
    setJourneyReviewWindowIndex(awaitingJourneyWindow.windowIndex);
    setJourneyReviewOpen(true);
  }, [journeyState, awaitingJourneyWindow, persistJourneyMutation]);

  const handleJourneyReviewConfirmed = useCallback(
    (draft: Review8Draft) => {
      if (!journeyState || journeyReviewWindowIndex == null || !draft.journeyId) {
        setJourneyReviewOpen(false);
        return;
      }
      const windowIndex = journeyReviewWindowIndex;
      const next = confirmJourneyWindow({
        state: journeyState,
        windowIndex,
        journeyId: draft.journeyId,
        draftKey: draft.draftKey,
        selectedCount: draft.selectedSteps?.length,
      });
      persistJourneyMutation(next);
      const parentJourneyId = resolveParentJourneyId(
        next,
        windowIndex
      );
      let parentSlug: string | null = null;
      let parentAuthorDisplayName: string | null = null;
      let parentPublicTitle: string | null = null;
      if (parentJourneyId && journeyOwnerId) {
        const parentArtifact = loadMirrorJourneyArtifact(
          journeyOwnerId,
          parentJourneyId,
          1
        );
        // Navigate only to a published parent identity — never leak private parent metadata.
        if (parentArtifact?.status === 'published') {
          parentSlug =
            parentArtifact.publish.slug?.trim().toLowerCase() ||
            parentJourneyId;
          parentAuthorDisplayName =
            parentArtifact.authorDisplayName?.trim() || null;
          parentPublicTitle = parentArtifact.publicTitle?.trim() || null;
        } else if (
          next.originatingParentJourneyId &&
          parentJourneyId === next.originatingParentJourneyId
        ) {
          // Originating Yansı slug is already a public published identity.
          parentSlug = parentJourneyId;
        }
      }
      markMirrorJourneyArtifactGenerating(journeyOwnerId, {
        journeyId: draft.journeyId,
        journeyVersion: draft.journeyVersion ?? 1,
        sourceConversationId: draft.sourceConversationId || chatId || '',
        blockIndex: draft.windowIndex ?? windowIndex,
        selectedCount: draft.selectedSteps?.length,
        authorUserId: journeyOwnerId || null,
        authorDisplayName: resolveAuthorDisplayName({
          fullName: user?.full_name,
          email: user?.email,
          userId: journeyOwnerId,
        }),
        parentJourneyId,
        parentSlug,
        parentAuthorDisplayName,
        parentPublicTitle,
      });
      setJourneyReviewOpen(false);
      setJourneyReviewWindowIndex(null);
      // Phase 3 will run meaning pipeline; keep chat free — flip to ready async.
      window.setTimeout(() => {
        setJourneyState((prev) => {
          if (!prev) return prev;
          const ready = markJourneyWindowReady(prev, windowIndex);
          const saved = saveJourneyConversationState(ready);
          return saved.ok ? saved.state : saved.current;
        });
      }, 0);
    },
    [journeyState, journeyReviewWindowIndex, persistJourneyMutation, journeyOwnerId, chatId, user]
  );

  const sainaConversations = useMemo(
    () => mapArchivesToSainaConversations(archives, chatId),
    [archives, chatId]
  );

  const sainaConversationGroups = useMemo(
    () => buildConversationTree(archives, conversationGroups, chatId),
    [archives, conversationGroups, chatId]
  );

  const showChatLimitMessage = useCallback(() => {
    const limitMessage: Message = {
      id: `limit-${Date.now()}`,
      text: resolveChatLimitMessage(accountEntitlements.tier),
      isUser: false,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, limitMessage]);
  }, [accountEntitlements.tier]);

  const handleSend = async (text: string) => {
    // Lazy creation: ilk mesajda arşiv kaydını burada oluştur.
    if (!chatId) {
      const newId = createStandaloneChat();
      skipAutosaveRef.current = false;
      setChatId(newId);
      router.replace(`/standalone?chat=${newId}`, { scroll: false });
    }

    if (isMessageLimitReached) {
      showChatLimitMessage();
      return;
    }

    if (journeyClosed) {
      const limitMessage: Message = {
        id: `limit-journey-${Date.now()}`,
        text: MIRROR_JOURNEY_CONVERSATION_CLOSED,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, limitMessage]);
      return;
    }

    const maxChars = accountEntitlements.entitlements.maxMessageChars;
    if (text.length > maxChars) {
      const limitMessage: Message = {
        id: `limit-${Date.now()}`,
        text: 'Mesajın bu hesap için çok uzun. Kısaltıp tekrar deneyebilirsin.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, limitMessage]);
      return;
    }

    const chatHistory = buildChatHistoryPayload(messages);

    const activeChat = chatId ? getChatArchive(chatId) : null;
    const lineageProofTokenForSend =
      activeChat?.mirrorOrigin?.lineageProofToken?.trim() || undefined;
    const isGuestMirrorSession = Boolean(activeChat?.mirrorOrigin?.isGuestSession);
    const priorUserMessages = messages.filter((m) => m.isUser).length;
    if (isGuestMirrorSession && priorUserMessages === 1) {
      trackSecondUserMessageSent(
        chatId ?? chatIdFromUrl ?? 'unknown',
        activeChat?.mirrorOrigin?.startedFromMirrorId ?? activeChat?.mirrorOrigin?.rootMirrorId ?? null
      );
    }

    // Add user message immediately with placeholder score (gray badge)
    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      text,
      isUser: true,
      userScore: undefined, // Will be updated when score arrives
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    lastUserMessageAtRef.current = Date.now();
    setBranchSuggestionVisible(false);

    // Show typing indicator
    setIsTyping(true);

    // Create assistant message placeholder for streaming
    const assistantMessageId = `eza-${Date.now()}`;
    const assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        isUser: false,
        incomplete: true,
        assistantScore: undefined, // Will be shown 0.4s after streaming completes
        safeOnlyMode: safeOnlyMode,
        safety: safeOnlyMode ? 'Safe' : undefined, // Default to Safe in safe-only mode, will be updated from backend
        timestamp: new Date(),
      };
    
    setMessages((prev) => [...prev, assistantMessage]);
    currentAssistantMessageRef.current = assistantMessageId;
    setIsLoading(true);

    try {
      // Try streaming first, fallback to normal endpoint if it fails
      let useNormalEndpoint = false;

      try {
        const streamBody: Record<string, unknown> = {
          query: text,
          safe_only: safeOnlyMode,
          model: analysisModelId,
        };
        const lineageProofToken = lineageProofTokenForSend;
        if (lineageProofToken) {
          streamBody.lineageProofToken = lineageProofToken;
        }
        if (chatHistory.length > 0) {
          streamBody.history = chatHistory;
        }
        const result = await startStream('/api/standalone/stream', streamBody,
          {
            headers: quotaHeaders,
            onToken: (token: string) => {
              // Update assistant message with streaming text
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, text: (msg.text || '') + token }
                    : msg
                )
              );
              // Hide typing indicator once first token arrives
              if (isTyping) {
                setIsTyping(false);
              }
            },
            onDone: (data: any) => {
              setIsTyping(false);
              setIsLoading(false);

              // Mark assistant turn complete for Journey eligible pairing.
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, incomplete: false }
                    : msg
                )
              );

              const governance = parseGovernance(data.governance);
              const feedbackCtx = feedbackContextFromGovernance(governance, {
                safety: data.safety,
                assistantScore: data.assistantScore,
                ezaScore: data.assistantScore,
              });

              const standaloneObservation =
                data.standaloneObservation ??
                parseStandaloneObservation(
                  (data as { standalone_observation?: unknown }).standalone_observation
                ) ??
                null;

              const snapshot = (data.behavioral as BehavioralSnapshot | null) ?? null;
              persistChatTurnFromResponse({
                userText: text,
                interactionId: assistantMessageId,
                behavioral: snapshot,
                standaloneObservation,
                userScore: data.userScore,
                assistantScore: data.assistantScore,
                ownerUserId: journeyOwnerId || null,
              });

              if (
                snapshot ||
                standaloneObservation ||
                data.userScore !== undefined ||
                data.assistantScore !== undefined
              ) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMessageId || msg.id === userMessageId) {
                      return {
                        ...msg,
                        behavioral: snapshot ?? msg.behavioral,
                        standaloneObservation:
                          standaloneObservation ?? msg.standaloneObservation,
                      };
                    }
                    return msg;
                  })
                );
              }

              if (data.userScore !== undefined) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === userMessageId
                      ? { ...msg, userScore: data.userScore }
                      : msg
                  )
                );
              }
              
              // Update assistant message with score after 0.4s delay
              if (data.assistantScore !== undefined) {
                assistantScoreTimeoutRef.current = setTimeout(() => {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            assistantScore: data.assistantScore,
                            behavioral: (data.behavioral as BehavioralSnapshot | undefined) ?? msg.behavioral,
                            standaloneObservation:
                              standaloneObservation ?? msg.standaloneObservation,
                            feedback: feedbackCtx ?? msg.feedback,
                          }
                        : msg
                    )
                  );
                }, 400); // 0.4 seconds delay
              } else if (feedbackCtx) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, feedback: feedbackCtx }
                      : msg
                  )
                );
              }

              // Update assistant message with safety badge (for safe-only mode)
              // Always update safety if in safe-only mode, even if backend doesn't send it (default to Safe)
              if (safeOnlyMode) {
                const safety = (data as any).safety || 'Safe'; // Default to Safe if not provided
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          safety: safety as 'Safe' | 'Warning' | 'Blocked',
                          feedback: feedbackCtx ?? msg.feedback,
                        }
                      : msg
                  )
                );
              }

              void refreshEntitlements();
            }
          }
        );

        if (result.error) {
          throw new Error(result.error);
        }
        // Empty successful stream (e.g. ignored SSE error) → use non-stream fallback.
        if (!result.text?.trim()) {
          throw new Error('empty_stream');
        }
      } catch {
        setIsTyping(false);
        useNormalEndpoint = true;
      }

      // Fallback to normal endpoint if streaming failed
      if (useNormalEndpoint) {
        // Remove placeholder assistant message
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
        
        // Use normal endpoint
        const { apiClient } = await import('@/lib/apiClient');
        const response = await apiClient.post<{
          assistant_answer?: string;
          user_score?: number;
          assistant_score?: number;
          safe_answer?: string;
          mode?: string;
          safety?: string;
        }>('/api/standalone', {
          body: {
            query: text,
            safe_only: safeOnlyMode,
            model: analysisModelId,
            ...(chatHistory.length > 0 ? { history: chatHistory } : {}),
            ...(lineageProofTokenForSend ? { lineageProofToken: lineageProofTokenForSend } : {}),
          },
          auth: hasSainaAuthToken(),
          headers: quotaHeaders,
        });

        if (!response.ok) {
          const detail =
            typeof response.detail === 'object' && response.detail !== null
              ? (response.detail as { reason?: string })
              : null;
          if (detail?.reason && isQuotaLimitReason(detail.reason)) {
            const quotaError = new Error(resolveChatLimitMessage(accountEntitlements.tier));
            (quotaError as Error & { quotaDetail?: unknown }).quotaDetail = detail;
            throw quotaError;
          }

          // Check for demo limit errors
          const errorCode = response.error?.error_code || response.error?.error;
          const errorMessage = response.error?.error_message || response.error?.message || 'Request failed';
          
          const error = new Error(errorMessage);
          if (errorCode) {
            (error as any).code = errorCode;
          }
          throw error;
        }

        const data = response.data;
        if (!data) {
          throw new Error('No data received from server');
        }

        const behavioralFallback =
          (response as { behavioral?: BehavioralSnapshot | null }).behavioral ?? null;
        const standaloneObservationFallback =
          parseStandaloneObservation(
            (response as { standalone_observation?: unknown }).standalone_observation
          ) ?? null;
        const governanceFallback = parseGovernance(
          (response as { governance?: unknown }).governance
        );
        const feedbackFallback = feedbackContextFromGovernance(governanceFallback, {
          safety: data.safety,
          assistantScore: data.assistant_score,
          ezaScore: (response as { eza_score?: number }).eza_score ?? data.assistant_score,
          riskLevel: (response as { risk_level?: string }).risk_level,
        });
        if (
          behavioralFallback ||
          standaloneObservationFallback ||
          data.user_score !== undefined ||
          data.assistant_score !== undefined
        ) {
          persistChatTurnFromResponse({
            userText: text,
            interactionId: assistantMessageId,
            behavioral: behavioralFallback,
            standaloneObservation: standaloneObservationFallback,
            userScore: data.user_score,
            assistantScore: data.assistant_score,
            ownerUserId: journeyOwnerId || null,
          });
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId || msg.id === userMessageId) {
                return {
                  ...msg,
                  behavioral: behavioralFallback ?? msg.behavioral,
                  standaloneObservation:
                    standaloneObservationFallback ?? msg.standaloneObservation,
                };
              }
              return msg;
            })
          );
        }

        void refreshEntitlements();

        // Handle response based on mode
        if (safeOnlyMode && (data as any).mode === 'safe-only') {
          // Determine safety badge from backend response or default to Safe
          const safety = (data as any).safety || 'Safe';
          const ezaMessage: Message = {
            id: assistantMessageId,
            text: (data as any).safe_answer || (data as any).assistant_answer || 'No response available',
            isUser: false,
            safety: safety as 'Safe' | 'Warning' | 'Blocked',
            safeOnlyMode: true,
            timestamp: new Date(),
            behavioral: behavioralFallback ?? undefined,
            standaloneObservation: standaloneObservationFallback ?? undefined,
            feedback: feedbackFallback ?? undefined,
          };
          setMessages((prev) => [...prev, ezaMessage]);
        } else {
          const ezaMessage: Message = {
            id: assistantMessageId,
            text: (data as any).assistant_answer || 'No response available',
            isUser: false,
            assistantScore: (data as any).assistant_score,
            safeOnlyMode: false,
            timestamp: new Date(),
            behavioral: behavioralFallback ?? undefined,
            standaloneObservation: standaloneObservationFallback ?? undefined,
            feedback: feedbackFallback ?? undefined,
          };
          
          // Update user message with score
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId
                ? {
                    ...msg,
                    userScore: (data as any).user_score,
                    behavioral: behavioralFallback ?? msg.behavioral,
                  }
                : msg
            )
          );
          
          // Show assistant score after 0.4s delay
          if ((data as any).assistant_score !== undefined) {
            assistantScoreTimeoutRef.current = setTimeout(() => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        assistantScore: (data as any).assistant_score,
                        behavioral: msg.behavioral ?? behavioralFallback ?? undefined,
                        feedback: msg.feedback ?? feedbackFallback ?? undefined,
                      }
                    : msg
                )
              );
            }, 400);
          }

          setMessages((prev) => [...prev, ezaMessage]);
        }
        
        setIsLoading(false);
      }

    } catch (error: any) {
      // Error already handled in fallback logic above
      setIsTyping(false);
      setIsLoading(false);
      
      // Remove placeholder assistant message
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      
      // Show error message
      let errorText = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
      const quotaDetail = extractQuotaDetail(error);
      if (quotaDetail?.reason && isQuotaLimitReason(quotaDetail.reason)) {
        errorText = resolveChatLimitMessage(
          quotaDetail.currentTier ?? accountEntitlements.tier
        );
        void refreshEntitlements();
      } else {
        const errorCode = error?.code || error?.response?.data?.error;

        if (errorCode === 'DEMO_TOKEN_LIMIT_REACHED') {
          errorText =
            'Günlük Demo Limiti Doldu\n\nBu sayfa, EZA\'nın herkese açık demo ortamıdır. Sistem stabilitesi ve adil kullanım için günlük bir kapasite ile çalışır.\n\nLütfen daha sonra tekrar deneyin.';
        } else if (errorCode === 'DEMO_TEXT_LIMIT_EXCEEDED') {
          errorText =
            'Demo ortamında uzun metin analizi sınırlıdır. Daha kapsamlı analizler kurumsal kullanım için sunulmaktadır.';
        } else if (error.message) {
          if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorText = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
          } else if (error.message.includes('404') || error.message.includes('bulunamadı')) {
            errorText = 'Backend endpoint bulunamadı. Lütfen backend\'in çalıştığından emin olun.';
          } else {
            errorText = error.message;
          }
        }
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: errorText,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  // Mirror guest sohbet: pending first message → normal standalone send/stream
  useEffect(() => {
    if (!ready || !mirrorReplyFromUrl || !chatIdFromUrl || chatId !== chatIdFromUrl) return;
    if (mirrorReplyFiredRef.current === chatIdFromUrl) return;

    const archived = getChatArchive(chatIdFromUrl);
    const pending = archived?.mirrorOrigin?.pendingUserMessage?.trim();
    if (!archived?.mirrorOrigin?.autoReplyPending || !pending) return;

    mirrorReplyFiredRef.current = chatIdFromUrl;
    clearMirrorAutoReplyPending(chatIdFromUrl);
    router.replace(`/standalone?chat=${chatIdFromUrl}`, { scroll: false });
    void handleSend(pending);
  }, [ready, mirrorReplyFromUrl, chatIdFromUrl, chatId, router]);

  const activeArchive = chatId ? getChatArchive(chatId) : null;
  const conversationSceneUrl = useMemo(() => {
    const url = activeArchive?.conversationSceneUrl;
    return url && isPersistableConversationSceneUrl(url) ? url : null;
  }, [activeArchive?.conversationSceneUrl]);
  const sourceType = activeArchive?.treeMetadata?.sourceType ?? (activeArchive?.mirrorOrigin ? 'mirror' : 'direct');
  const assistantIsDone = Boolean(
    chatId &&
      messages.some((m) => m.isUser) &&
      messages.some((m) => !m.isUser && m.text.trim()) &&
      !isLoading &&
      !isTyping
  );

  useEffect(() => {
    if (!chatId || !ready) {
      setBranchSuggestionVisible(false);
      return;
    }

    const tick = () => {
      const show = shouldShowBranchSuggestion({
        sourceType: sourceType === 'mirror' ? 'mirror' : sourceType,
        assistantIsDone,
        isLoading,
        isTyping,
        lastUserMessageAt: lastUserMessageAtRef.current,
        dismissed: isBranchSuggestionDismissed(chatId),
        shownInSession: isBranchSuggestionShown(chatId),
        isActiveConversation: true,
      });

      if (!show) return;

      const cards = resolveBranchCardsForChat(getChatArchive(chatId));
      setBranchCards(cards);
      setBranchSuggestionVisible(true);
      markBranchSuggestionShown(chatId);
      trackBranchSuggestionShown(chatId);
    };

    const interval = window.setInterval(tick, 30_000);
    tick();
    return () => window.clearInterval(interval);
  }, [chatId, ready, sourceType, assistantIsDone, isLoading, isTyping]);

  useEffect(() => {
    if (!chatId) return;
    const lastUser = [...messages].reverse().find((m) => m.isUser && m.text.trim());
    if (lastUser?.timestamp) {
      lastUserMessageAtRef.current = lastUser.timestamp.getTime();
    }
  }, [messages, chatId]);

  useEffect(() => {
    if (!chatId || isLoading || isTyping) return;
    const last = messages[messages.length - 1];
    if (last?.isUser) {
      lastAssistantDoneAtRef.current = null;
      setMirrorBirthVisible(false);
      return;
    }
    if (last && !last.isUser && last.text.trim()) {
      lastAssistantDoneAtRef.current = Date.now();
    }
  }, [messages, isLoading, isTyping, chatId]);

  useEffect(() => {
    if (!chatId || !ready) {
      setMirrorBirthVisible(false);
      return;
    }

    const entries = buildConversationMirrorEntries(messages);
    const baseInput = {
      messages,
      entries,
      assistantIsDone,
      isLoading,
      isTyping,
      dismissed: isMirrorBirthDismissed(chatId),
      shownInSession: isMirrorBirthShown(chatId),
      mirrorAlreadyCreated: hasConversationMirrorArtifact(chatId),
      lastAssistantDoneAt: lastAssistantDoneAtRef.current,
    };

    const tick = () => {
      const evaluation = evaluateMirrorBirth({
        ...baseInput,
        lastAssistantDoneAt: lastAssistantDoneAtRef.current,
      });
      setMirrorBirthDebugState(evaluation);

      if (hasConversationMirrorArtifact(chatId) || isMirrorBirthDismissed(chatId)) {
        setMirrorBirthVisible(false);
        return;
      }

      const show = shouldShowMirrorBirthSuggestion({
        ...baseInput,
        lastAssistantDoneAt: lastAssistantDoneAtRef.current,
      });

      if (!show) return;

      setMirrorBirthVisible(true);
      if (!isMirrorBirthShown(chatId)) {
        markMirrorBirthShown(chatId);
        trackMirrorBirthSuggested(chatId);
      }
    };

    const interval = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(interval);
  }, [chatId, ready, messages, assistantIsDone, isLoading, isTyping]);

  const handleMirrorBirthAccept = useCallback(() => {
    if (!chatId) return;
    trackMirrorBirthAccepted(chatId);
    setMirrorBirthVisible(false);
    if (!handleRequestMirror()) return;
    // Ensure archive includes latest in-memory turns before Mirror build reads it.
    cancelPendingAutosave();
    flushSave(chatId, messagesRef.current);
    setActiveConversationLiveMessages(
      chatId,
      messagesRef.current.map((m) => ({ id: m.id, text: m.text, isUser: m.isUser }))
    );
    onOpenMirror?.();
    requestMirrorBirthGeneration(chatId);
  }, [chatId, handleRequestMirror, onOpenMirror, cancelPendingAutosave, flushSave]);

  const handleMirrorBirthDismiss = useCallback(() => {
    if (!chatId) return;
    markMirrorBirthDismissed(chatId);
    trackMirrorBirthDismissed(chatId);
    setMirrorBirthVisible(false);
  }, [chatId]);

  const handleBranchSelect = useCallback(
    (branchTitle: string) => {
      if (!chatId) return;
      const parent = getChatArchive(chatId);
      if (!parent) return;
      trackBranchCardClicked(chatId, branchTitle);
      const created = startMirrorBranchConversation({ parentChat: parent, branchTitle });
      if (!created) return;
      setBranchSuggestionVisible(false);
      markBranchSuggestionDismissed(chatId);
      router.push(
        `/standalone?chat=${created.chatId}&${MIRROR_GUEST_CHAT_REPLY_PARAM}=1`
      );
    },
    [chatId, router]
  );

  const handleBranchDismiss = useCallback(() => {
    if (!chatId) return;
    markBranchSuggestionDismissed(chatId);
    setBranchSuggestionVisible(false);
  }, [chatId]);

  const isEmpty = messages.length === 0 && !isLoading && !isTyping;

  const heroTitle = useMemo(() => {
    if (!chatId) return SAINA_HERO_DEFAULT_TITLE;
    const archived = getChatArchive(chatId);
    const title = archived?.title?.trim();
    return title || SAINA_HERO_DEFAULT_TITLE;
  }, [chatId, messages]);

  const mirrorMobileContext = useMemo<MirrorMobileContext>(() => {
    const hasAssistantResponse = messages.some((message) => !message.isUser);
    const hasMirrorSignal = messages.some(
      (message) =>
        !message.isUser &&
        (message.behavioral != null || message.standaloneObservation != null)
    );
    return { hasAssistantResponse, hasMirrorSignal };
  }, [messages]);

  const composer = (
    <>
      {journeyV1On && generatingWindow ? (
        <JourneyGenerationStatus status="generating" />
      ) : null}
      {journeyV1On && readyWindow && !generatingWindow ? (
        <JourneyGenerationStatus status="ready" />
      ) : null}
      {journeyV1On && awaitingJourneyWindow && !journeyReviewOpen ? (
        <JourneyWindowDecisionBanner
          onCreate={handleJourneyCreate}
          onSkip={handleJourneySkip}
        />
      ) : null}
      {branchSuggestionVisible && branchCards.length > 0 ? (
        <MirrorBranchSuggestion
          cards={branchCards}
          onSelect={handleBranchSelect}
          onDismiss={handleBranchDismiss}
        />
      ) : null}
      <SainaComposer onSend={handleSend} isLoading={isLoading} disabled={composerDisabled} />
    </>
  );

  const messageList =
    !isEmpty ? (
      <>
        <MessageList
          variant="saina"
          messages={messages}
          isLoading={isLoading}
          isTyping={isTyping}
          ezaVisibilityEnabled={ezaVisibilityEnabled}
        />
        {mirrorBirthVisible ? (
          <MirrorBirthSuggestion
            onAccept={handleMirrorBirthAccept}
            onDismiss={handleMirrorBirthDismiss}
          />
        ) : null}
      </>
    ) : null;

  useSyncSainaChrome({
    activeSection: 'chat',
    conversations: sainaConversations,
    conversationGroups: sainaConversationGroups,
    activeChatId: chatId,
    conversationSceneUrl,
    planTier,
    onNewChat: handleNewChat,
    onSelectChat: handleSelectChat,
    onDeleteChat: handleDeleteChat,
    onOpenPattern: handleOpenPattern,
    onUpgrade: handleOpenUpgrade,
    onRequestLogin: handleRequestLogin,
    safeOnlyMode,
    onSafeOnlyModeChange: setSafeOnlyMode,
    analysisModelId,
    onAnalysisModelChange: setAnalysisModelId,
    settingsDisabled: isLoading,
    notifications: canViewMapData ? systemNotifications : [],
  });

  if (!ready) {
    return <div className="saina-route-fallback min-h-0 flex-1" aria-hidden />;
  }

  return (
    <>
      <NewChatGroupPicker
        open={groupPickerOpen}
        groups={conversationGroups}
        onClose={() => setGroupPickerOpen(false)}
        onSelectExisting={openChatInGroup}
        onCreateNew={handleCreateGroupAndChat}
      />
      <SainaStandaloneShell
        heroTitle={heroTitle}
        isEmpty={isEmpty}
        messages={messageList}
        composer={composer}
        conversations={sainaConversations}
        activeChatId={chatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onOpenPattern={handleOpenPattern}
        planTier={planTier}
        onUpgrade={handleOpenUpgrade}
        onRequestLogin={handleRequestLogin}
        onRequestMirror={handleRequestMirror}
        mirrorMobileContext={mirrorMobileContext}
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={setSafeOnlyMode}
        analysisModelId={analysisModelId}
        onAnalysisModelChange={setAnalysisModelId}
        settingsDisabled={isLoading}
        embedded
      />
      {gateModals}
      {deleteModal}
      {journeyReviewOpen &&
      journeyState &&
      journeyReviewWindowIndex != null &&
      journeyOwnerId &&
      chatId ? (
        <Review8Screen
          ownerUserId={journeyOwnerId}
          sourceConversationId={chatId}
          windowIndex={journeyReviewWindowIndex}
          windowPairs={pairsForWindow(
            extractQaPairs(
              messages.map((m) => ({
                id: m.id,
                text: m.text,
                isUser: m.isUser,
                incomplete: m.incomplete,
              }))
            ),
            journeyReviewWindowIndex
          )}
          draftKey={
            journeyState.windows.find((w) => w.windowIndex === journeyReviewWindowIndex)
              ?.draftKey || `win-${chatId}-${journeyReviewWindowIndex}`
          }
          parentJourneyId={resolveParentJourneyId(
            journeyState,
            journeyReviewWindowIndex
          )}
          onConfirmed={handleJourneyReviewConfirmed}
          onCancel={() => {
            if (journeyState && journeyReviewWindowIndex != null) {
              const next = reopenJourneyWindowDecision(
                journeyState,
                journeyReviewWindowIndex
              );
              const saved = saveJourneyConversationState(next);
              setJourneyState(saved.ok ? saved.state : saved.current);
            }
            setJourneyReviewOpen(false);
            setJourneyReviewWindowIndex(null);
          }}
        />
      ) : null}
    </>
  );
}
