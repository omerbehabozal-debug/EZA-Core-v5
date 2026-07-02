/**
 * Standalone Chat Page - Pure Score Analyzer Mode
 * Public Access (App Router Version)
 * No authentication required
 * 
 * Features:
 * - Score-only mode (0-100 badges)
 * - SAFE-only mode (rewrite enabled)
 * - Daily limit (30-50 messages/day)
 * - Çoklu sohbet sekmeleri; otomatik kayıt; sekmeye dönünce kaldığın yerden devam
 * - Minimal UI (no tooltips, no extra info)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MessageList from '@/components/standalone/MessageList';
import SainaComposer from '@/components/saina/SainaComposer';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import { useSyncSainaChrome } from '@/hooks/useSyncSainaChrome';
import { usePatternDeviceSync } from '@/hooks/usePatternDeviceSync';
import UpgradeModal, { type UpgradeModalVariant } from '@/components/plan/UpgradeModal';
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
import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';
import { gatePremiumFeature } from '@/lib/eza/plan/sainaFeatureGate';
import { usePlan } from '@/lib/eza/plan/usePlan';
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
import { useSetConversationMirrorEntries, PENDING_CONVERSATION_MIRROR_ID } from '@/components/standalone/MirrorEntriesContext';
import {
  CHATS_UPDATED_EVENT,
  clearMirrorAutoReplyPending,
  confirmDeleteChatArchive,
  createStandaloneChat,
  getChatArchive,
  listChatArchives,
  pruneEmptyChats,
  resolveChatRouteAfterDelete,
  saveStandaloneChat,
  writeActiveChatId,
  type ArchivedChatSummary,
} from '@/lib/standaloneChatArchive';
import { MIRROR_GUEST_CHAT_REPLY_PARAM } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { isChatDeleted } from '@/lib/standaloneChatDelete';
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
}

// Daily limit constants
const DAILY_LIMIT_SOFT = 40; // Soft limit (start throttling)
const DAILY_LIMIT_HARD = 50; // Hard limit (block completely)
const THROTTLE_DELAY_MIN = 0; // Min throttle delay (ms)
const THROTTLE_DELAY_MAX = 300; // Max throttle delay (ms) - typing indicator süresinde

// localStorage keys
const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';
const STORAGE_KEY_DAILY_COUNT = 'eza_standalone_daily_count';
const STORAGE_KEY_LAST_DATE = 'eza_standalone_last_date';
export default function StandaloneChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams?.get('chat') ?? null;
  const mirrorReplyFromUrl = searchParams?.get(MIRROR_GUEST_CHAT_REPLY_PARAM) === '1';

  const [chatId, setChatId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeVariant, setUpgradeVariant] = useState<UpgradeModalVariant>('upgrade');
  const [upgradeFeature, setUpgradeFeature] = useState<string>('saina_sidebar');
  const { isPlus, isLoading: isPlanLoading, source, refreshPlan } = usePlan();
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

    // Check daily count
    const lastDate = localStorage.getItem(STORAGE_KEY_LAST_DATE);
    const today = new Date().toDateString();
    
    if (lastDate === today) {
      // Same day - load count
      const savedCount = localStorage.getItem(STORAGE_KEY_DAILY_COUNT);
      const count = savedCount ? parseInt(savedCount, 10) : 0;
      setDailyCount(count);
      setIsLimitReached(count >= DAILY_LIMIT_HARD);
    } else {
      // New day - reset count
      localStorage.setItem(STORAGE_KEY_LAST_DATE, today);
      localStorage.setItem(STORAGE_KEY_DAILY_COUNT, '0');
      setDailyCount(0);
      setIsLimitReached(false);
    }
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
  // Aksi halde → boş taslak (arşive yazılmaz). Birikmiş boşlar prune edilir.
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
      router.replace('/standalone', { scroll: false });
    }
    startDraft();
    setReady(true);
    enableUrlSync();
  }, [ready, chatIdFromUrl, router, loadChatIntoState, startDraft]);

  useEffect(() => {
    if (!ready || !urlSyncEnabledRef.current || !chatIdFromUrl) return;
    if (chatIdFromUrl === chatId) return;

    const prevId = chatIdRef.current;
    if (prevId && !skipAutosaveRef.current && !isChatDeleted(prevId)) {
      flushSave(prevId, messagesRef.current);
    }

    if (loadChatIntoState(chatIdFromUrl)) return;

    // Arşivde olmayan (silinmiş/eski) ?chat= → boş kayıt açma, taslağa düş.
    router.replace('/standalone', { scroll: false });
    startDraft();
  }, [chatIdFromUrl, chatId, ready, flushSave, loadChatIntoState, router, startDraft]);

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

  const handleDeleteChat = useCallback(
    (id: string) => {
      const archive = getChatArchive(id);
      if (!archive) return;

      const wasActive = chatId === id;
      if (wasActive) {
        cancelPendingAutosave();
        skipAutosaveRef.current = true;
      }

      if (!confirmDeleteChatArchive(id, archive.title)) {
        if (wasActive) {
          window.setTimeout(() => {
            skipAutosaveRef.current = false;
          }, 0);
        }
        return;
      }

      if (wasActive) {
        resetStateAfterActiveDelete();
        router.push(resolveChatRouteAfterDelete(), { scroll: false });
        const remaining = listChatArchives();
        if (remaining.length === 0) {
          startDraft();
        }
      }
    },
    [
      chatId,
      router,
      cancelPendingAutosave,
      resetStateAfterActiveDelete,
      startDraft,
    ]
  );

  const planTier = resolveSainaPlanTier({ isPlus, isLoading: isPlanLoading, source });
  const planResolved = !isPlanLoading;
  const isPremium = planResolved && gatePremiumFeature(planTier) === 'allow';

  const { systemNotifications } = usePatternDeviceSync({
    isPremium,
    archives,
  });

  const openGateModal = useCallback((feature: string) => {
    const outcome = gatePremiumFeature(planTier);
    setUpgradeFeature(feature);
    setUpgradeVariant(outcome === 'upgrade_required' ? 'upgrade' : 'auth_required');
    setUpgradeOpen(true);
  }, [planTier]);

  const handleOpenPattern = useCallback(() => {
    if (gatePremiumFeature(planTier) !== 'allow') {
      openGateModal('relationship_pattern');
      return;
    }
    router.push(MIRROR_PATTERN_ROUTE, { scroll: false });
  }, [planTier, openGateModal, router]);

  const handleRequestMirror = useCallback((): boolean => {
    if (planTier === 'session_invalid') {
      openGateModal('conversation_mirror');
      return false;
    }
    return true;
  }, [planTier, openGateModal]);

  const handleOpenUpgrade = useCallback(() => {
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

  useEffect(() => {
    void refreshPlan();
  }, [refreshPlan]);

  useEffect(() => {
    setConversationMirrorEntries(
      buildConversationMirrorEntries(messages),
      chatId ?? PENDING_CONVERSATION_MIRROR_ID
    );
    return () => setConversationMirrorEntries([], null);
  }, [messages, chatId, setConversationMirrorEntries]);

  const sainaConversations = useMemo(
    () => mapArchivesToSainaConversations(archives),
    [archives]
  );

  const sainaConversationGroups = useMemo(
    () => buildConversationTree(archives, conversationGroups),
    [archives, conversationGroups]
  );

  const incrementDailyCount = useCallback(() => {
    const newCount = dailyCount + 1;
    setDailyCount(newCount);
    localStorage.setItem(STORAGE_KEY_DAILY_COUNT, newCount.toString());
    
    if (newCount >= DAILY_LIMIT_HARD) {
      setIsLimitReached(true);
      // Show limit message
      const limitMessage: Message = {
        id: `limit-${Date.now()}`,
        text: 'Bugünkü skor analizlerin tamamlandı.\nYarın tekrar görüşebiliriz.\n\nDaha detaylı analiz istiyorsanız Proxy-Lite\'ı inceleyebilirsiniz.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, limitMessage]);
    }
  }, [dailyCount]);

  const handleSend = async (text: string) => {
    // Lazy creation: ilk mesajda arşiv kaydını burada oluştur.
    if (!chatId) {
      const newId = createStandaloneChat();
      skipAutosaveRef.current = false;
      setChatId(newId);
      router.replace(`/standalone?chat=${newId}`, { scroll: false });
    }

    if (isLimitReached || dailyCount >= DAILY_LIMIT_HARD) {
      const limitMessage: Message = {
        id: `limit-${Date.now()}`,
        text: 'Bugünkü skor analizlerin tamamlandı. Yarın tekrar görüşebiliriz.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, limitMessage]);
      return;
    }

    const chatHistory = buildChatHistoryPayload(messages);

    const activeChat = chatId ? getChatArchive(chatId) : null;
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

    // Soft limit: Apply random throttle delay (0-300ms) during typing indicator
    const throttleDelay = dailyCount >= DAILY_LIMIT_SOFT && dailyCount < DAILY_LIMIT_HARD
      ? Math.floor(Math.random() * (THROTTLE_DELAY_MAX - THROTTLE_DELAY_MIN + 1)) + THROTTLE_DELAY_MIN
      : 0;

    // Show typing indicator
    setIsTyping(true);
    
    // Apply throttle delay during typing indicator (user won't notice)
    if (throttleDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, throttleDelay));
    }

    // Create assistant message placeholder for streaming
    const assistantMessageId = `eza-${Date.now()}`;
    const       assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        isUser: false,
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
        if (chatHistory.length > 0) {
          streamBody.history = chatHistory;
        }
        const result = await startStream('/api/standalone/stream', streamBody,
          {
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

              // Increment daily count
              incrementDailyCount();
            }
          }
        );

        if (result.error) {
          throw new Error(result.error);
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
          },
          auth: false,
        });

        if (!response.ok) {
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

        // Increment daily count
        incrementDailyCount();

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
      const errorCode = error?.code || error?.response?.data?.error;
      
      // Handle demo limit errors
      if (errorCode === 'DEMO_TOKEN_LIMIT_REACHED') {
        errorText = 'Günlük Demo Limiti Doldu\n\nBu sayfa, EZA\'nın herkese açık demo ortamıdır. Sistem stabilitesi ve adil kullanım için günlük bir kapasite ile çalışır.\n\nLütfen daha sonra tekrar deneyin.';
      } else if (errorCode === 'DEMO_TEXT_LIMIT_EXCEEDED') {
        errorText = 'Demo ortamında uzun metin analizi sınırlıdır. Daha kapsamlı analizler kurumsal kullanım için sunulmaktadır.';
      } else if (error.message) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorText = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
        } else if (error.message.includes('404') || error.message.includes('bulunamadı')) {
          errorText = 'Backend endpoint bulunamadı. Lütfen backend\'in çalıştığından emin olun.';
        } else {
          errorText = error.message;
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
    onOpenMirror?.();
    requestMirrorBirthGeneration(chatId);
  }, [chatId, handleRequestMirror, onOpenMirror]);

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
      {branchSuggestionVisible && branchCards.length > 0 ? (
        <MirrorBranchSuggestion
          cards={branchCards}
          onSelect={handleBranchSelect}
          onDismiss={handleBranchDismiss}
        />
      ) : null}
      <SainaComposer onSend={handleSend} isLoading={isLoading} disabled={isLimitReached} />
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
    notifications: isPremium ? systemNotifications : [],
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
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        variant={upgradeVariant}
        feature={upgradeFeature}
      />
    </>
  );
}
