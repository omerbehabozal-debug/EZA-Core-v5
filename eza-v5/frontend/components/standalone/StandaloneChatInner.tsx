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
import InputBar from '@/components/standalone/InputBar';
import SainaStandaloneShell from '@/components/saina/SainaStandaloneShell';
import { SAINA_HERO_DEFAULT_TITLE } from '@/lib/eza/sainaCopy';
import { useStreamResponse } from '@/hooks/useStreamResponse';
import type {
  BehavioralSnapshot,
  StandaloneFeedbackContext,
  StandaloneObservation,
} from '@/lib/types';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import { appendBehavioralTurn } from '@/lib/behavioralHistory';
import { extractStoryCueTokens } from '@/lib/eza/mirror/storyTopicResolver';
import {
  createStandaloneChat,
  getChatArchive,
  pruneEmptyChats,
  saveStandaloneChat,
  writeActiveChatId,
} from '@/lib/standaloneChatArchive';
import {
  fromArchivedMessages,
  toArchivedMessages,
} from '@/lib/standaloneChatSession';
import { feedbackContextFromGovernance, parseGovernance } from '@/lib/standaloneFeedback';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';
import { buildChatHistoryPayload } from '@/lib/standaloneChatHistory';

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

  const [chatId, setChatId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const { startStream, reset: resetStream } = useStreamResponse();
  const currentAssistantMessageRef = useRef<string | null>(null);
  const assistantScoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipAutosaveRef = useRef(true);
  /** İlk açılış/yenilemede URL’deki eski ?chat= ile yanlış sohbet yüklenmesin */
  const urlSyncEnabledRef = useRef(false);
  const messagesRef = useRef(messages);
  const chatIdRef = useRef(chatId);
  messagesRef.current = messages;
  chatIdRef.current = chatId;

  const flushSave = useCallback((id: string, msgs: Message[]) => {
    saveStandaloneChat(id, toArchivedMessages(msgs));
  }, []);

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
    if (prevId && !skipAutosaveRef.current) {
      flushSave(prevId, messagesRef.current);
    }

    if (loadChatIntoState(chatIdFromUrl)) return;

    // Arşivde olmayan (silinmiş/eski) ?chat= → boş kayıt açma, taslağa düş.
    router.replace('/standalone', { scroll: false });
    startDraft();
  }, [chatIdFromUrl, chatId, ready, flushSave, loadChatIntoState, router, startDraft]);

  useEffect(() => {
    if (skipAutosaveRef.current || !chatId) return;
    const timer = window.setTimeout(() => {
      flushSave(chatId, messages);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [messages, chatId, flushSave]);

  useEffect(() => {
    return () => {
      const id = chatIdRef.current;
      if (id && !skipAutosaveRef.current) {
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

  const handleNewChat = useCallback(() => {
    // Mevcut sohbette içerik varsa kaydet, sonra boş taslağa dön (yeni boş kayıt açma).
    if (chatId && !skipAutosaveRef.current && toArchivedMessages(messages).length > 0) {
      flushSave(chatId, messages);
    }
    router.replace('/standalone', { scroll: false });
    startDraft();
  }, [chatId, messages, flushSave, router, startDraft]);

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

              if (data.behavioral || standaloneObservation) {
                const snapshot = (data.behavioral as BehavioralSnapshot | null) ?? null;
                const mirrorCueHints = extractStoryCueTokens(text);
                appendBehavioralTurn(snapshot, standaloneObservation, {
                  mirrorCueHints: mirrorCueHints.length ? mirrorCueHints : undefined,
                });
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
          ok: boolean;
          data?: {
            assistant_answer?: string;
            user_score?: number;
            assistant_score?: number;
            safe_answer?: string;
            mode?: string;
          };
          error?: {
            error_message?: string;
          };
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
          safety: (data as { safety?: string }).safety,
          assistantScore: (data as { assistant_score?: number }).assistant_score,
          ezaScore: (response as { eza_score?: number }).eza_score ?? (data as { assistant_score?: number }).assistant_score,
          riskLevel: (response as { risk_level?: string }).risk_level,
        });
        if (behavioralFallback || standaloneObservationFallback) {
          const mirrorCueHints = extractStoryCueTokens(text);
          appendBehavioralTurn(behavioralFallback, standaloneObservationFallback, {
            mirrorCueHints: mirrorCueHints.length ? mirrorCueHints : undefined,
          });
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

  const isEmpty = messages.length === 0 && !isLoading && !isTyping;

  const heroTitle = useMemo(() => {
    if (!chatId) return SAINA_HERO_DEFAULT_TITLE;
    const archived = getChatArchive(chatId);
    const title = archived?.title?.trim();
    return title || SAINA_HERO_DEFAULT_TITLE;
  }, [chatId, messages]);

  const composer = (
    <InputBar
      onSend={handleSend}
      isLoading={isLoading}
      disabled={isLimitReached}
      isEmpty={isEmpty}
      analysisModelId={analysisModelId}
      onAnalysisModelChange={setAnalysisModelId}
    />
  );

  const messageList =
    !isEmpty ? (
      <MessageList messages={messages} isLoading={isLoading} isTyping={isTyping} />
    ) : null;

  if (!ready) {
    return (
      <div className={`${standaloneSkin.page} flex items-center justify-center`}>
        <p className="text-sm text-standalone-text-muted">Sohbet yükleniyor…</p>
      </div>
    );
  }

  return (
    <SainaStandaloneShell
      heroTitle={heroTitle}
      isEmpty={isEmpty}
      messages={messageList}
      composer={composer}
      safeOnlyMode={safeOnlyMode}
      onSafeOnlyModeChange={setSafeOnlyMode}
      hasActiveChat
      onNewChat={handleNewChat}
    />
  );
}
