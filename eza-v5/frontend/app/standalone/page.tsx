/**
 * Standalone Chat Page - Pure Score Analyzer Mode
 * Public Access (App Router Version)
 * No authentication required
 * 
 * Features:
 * - Score-only mode (0-100 badges)
 * - SAFE-only mode (rewrite enabled)
 * - Daily limit (30-50 messages/day)
 * - No chat history (localStorage only)
 * - Minimal UI (no tooltips, no extra info)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import MessageList from '@/components/standalone/MessageList';
import InputBar from '@/components/standalone/InputBar';
import StandaloneChatLayout from '@/components/standalone/StandaloneChatLayout';
import StandaloneSessionEndDialog from '@/components/standalone/StandaloneSessionEndDialog';
import { useStreamResponse } from '@/hooks/useStreamResponse';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import { appendBehavioralSnapshot } from '@/lib/behavioralHistory';
import {
  ACTIVE_SESSION_ARCHIVE_ID,
  clearActiveSessionArchive,
  finalizeActiveSession,
  getChatArchive,
  upsertActiveChatArchive,
} from '@/lib/standaloneChatArchive';
import { clearChatDraft, loadChatDraft, saveChatDraft } from '@/lib/standaloneChatDraft';
import {
  fromArchivedMessages,
  hasMeaningfulChat,
  isArchivableMessage,
  toArchivedMessages,
} from '@/lib/standaloneChatSession';
import { feedbackContextFromGovernance, parseGovernance } from '@/lib/standaloneFeedback';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  readStoredAnalysisModel,
  writeStoredAnalysisModel,
} from '@/lib/standaloneModels';

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

export default function StandalonePage() {
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
  const [sessionEndOpen, setSessionEndOpen] = useState(false);
  const skipAutosaveRef = useRef(true);
  const sessionRestoredRef = useRef(false);

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

  useEffect(() => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    const draft = loadChatDraft();
    if (draft?.messages?.length) {
      setMessages(fromArchivedMessages(draft.messages) as Message[]);
    } else {
      const active = getChatArchive(ACTIVE_SESSION_ARCHIVE_ID);
      if (active?.messages?.length) {
        setMessages(fromArchivedMessages(active.messages) as Message[]);
      }
    }

    const t = window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const persistSession = useCallback((msgs: Message[]) => {
    const archived = toArchivedMessages(msgs);
    if (archived.length === 0) return;
    saveChatDraft({
      sessionArchiveId: ACTIVE_SESSION_ARCHIVE_ID,
      messages: archived,
      updatedAt: new Date().toISOString(),
    });
    upsertActiveChatArchive(archived);
  }, []);

  useEffect(() => {
    if (skipAutosaveRef.current) return;

    const archived = toArchivedMessages(messages);
    if (archived.length === 0) return;

    const timer = window.setTimeout(() => persistSession(messages), 400);
    return () => window.clearTimeout(timer);
  }, [messages, persistSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (assistantScoreTimeoutRef.current) {
        clearTimeout(assistantScoreTimeoutRef.current);
      }
      resetStream();
    };
  }, [resetStream]);

  const startFreshChat = useCallback(() => {
    resetStream();
    setMessages([]);
    setIsLoading(false);
    setIsTyping(false);
    clearChatDraft();
    setSessionEndOpen(false);
  }, [resetStream]);

  const handleNewChatRequest = useCallback(() => {
    if (!hasMeaningfulChat(messages)) {
      clearActiveSessionArchive();
      startFreshChat();
      return;
    }
    setSessionEndOpen(true);
  }, [messages, startFreshChat]);

  const handleSessionKeep = useCallback(() => {
    finalizeActiveSession();
    startFreshChat();
  }, [startFreshChat]);

  const handleSessionDelete = useCallback(() => {
    clearActiveSessionArchive();
    startFreshChat();
  }, [startFreshChat]);

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
    // Check hard limit - show message immediately without typing indicator
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

    // Add user message immediately with placeholder score (gray badge)
    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      text,
      isUser: true,
      userScore: undefined, // Will be updated when score arrives
      timestamp: new Date(),
    };

    setMessages((prev) => {
      const next = [...prev, userMessage];
      if (!skipAutosaveRef.current) {
        window.setTimeout(() => persistSession(next), 0);
      }
      return next;
    });

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
        const result = await startStream(
          '/api/standalone/stream',
          { query: text, safe_only: safeOnlyMode, model: analysisModelId },
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

              if (data.behavioral) {
                appendBehavioralSnapshot(data.behavioral as BehavioralSnapshot);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, behavioral: data.behavioral as BehavioralSnapshot }
                      : msg
                  )
                );
              }
              
              // Update user message with score immediately
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
      } catch (streamError: any) {
        // If streaming fails (404 or other error), fallback to normal endpoint
        // Silently fallback - no console warning needed
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
        const governanceFallback = parseGovernance(
          (response as { governance?: unknown }).governance
        );
        const feedbackFallback = feedbackContextFromGovernance(governanceFallback, {
          safety: (data as { safety?: string }).safety,
          assistantScore: (data as { assistant_score?: number }).assistant_score,
          ezaScore: (response as { eza_score?: number }).eza_score ?? (data as { assistant_score?: number }).assistant_score,
          riskLevel: (response as { risk_level?: string }).risk_level,
        });
        if (behavioralFallback) {
          appendBehavioralSnapshot(behavioralFallback);
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
            feedback: feedbackFallback ?? undefined,
          };
          
          // Update user message with score
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === userMessageId 
                ? { ...msg, userScore: (data as any).user_score }
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
    }
  };

  const isEmpty = messages.length === 0 && !isLoading && !isTyping;
  const hasActiveChat = messages.some(isArchivableMessage);

  return (
    <div className={standaloneSkin.page}>
      <StandaloneSessionEndDialog
        open={sessionEndOpen}
        onKeep={handleSessionKeep}
        onDelete={handleSessionDelete}
        onCancel={() => setSessionEndOpen(false)}
      />
      <StandaloneChatLayout
        isEmpty={isEmpty}
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={setSafeOnlyMode}
        hasActiveChat={hasActiveChat}
        onNewChat={handleNewChatRequest}
      >
        {!isEmpty ? (
          <MessageList messages={messages} isLoading={isLoading} isTyping={isTyping} />
        ) : null}
        <InputBar
          onSend={handleSend}
          isLoading={isLoading}
          disabled={isLimitReached}
          isEmpty={isEmpty}
          analysisModelId={analysisModelId}
          onAnalysisModelChange={setAnalysisModelId}
        />
      </StandaloneChatLayout>
    </div>
  );
}
