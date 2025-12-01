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
import TopBar from '@/components/standalone/TopBar';
import MessageList from '@/components/standalone/MessageList';
import InputBar from '@/components/standalone/InputBar';
import SettingsModal from '@/components/standalone/SettingsModal';
import { useStreamResponse } from '@/hooks/useStreamResponse';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number; // 0-100 for user message
  assistantScore?: number; // 0-100 for assistant message
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp: Date;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const { startStream, reset: resetStream } = useStreamResponse();
  const currentAssistantMessageRef = useRef<string | null>(null);
  const assistantScoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSafeOnly = localStorage.getItem(STORAGE_KEY_SAFE_ONLY);
    if (savedSafeOnly !== null) {
      setSafeOnlyMode(savedSafeOnly === 'true');
    }

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (assistantScoreTimeoutRef.current) {
        clearTimeout(assistantScoreTimeoutRef.current);
      }
      resetStream();
    };
  }, [resetStream]);

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
    const assistantMessage: Message = {
      id: assistantMessageId,
      text: '',
      isUser: false,
      assistantScore: undefined, // Will be shown 0.4s after streaming completes
      safeOnlyMode: safeOnlyMode,
      safety: safeOnlyMode ? 'Safe' : undefined,
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
          { query: text, safe_only: safeOnlyMode },
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
                        ? { ...msg, assistantScore: data.assistantScore }
                        : msg
                    )
                  );
                }, 400); // 0.4 seconds delay
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
            safe_only: safeOnlyMode 
          },
          auth: false,
        });

        if (!response.ok) {
          throw new Error(response.error?.error_message || response.error?.message || 'Request failed');
        }

        const data = response.data;
        if (!data) {
          throw new Error('No data received from server');
        }

        // Increment daily count
        incrementDailyCount();

        // Handle response based on mode
        if (safeOnlyMode && data.mode === 'safe-only') {
          const ezaMessage: Message = {
            id: assistantMessageId,
            text: data.safe_answer || data.assistant_answer || 'No response available',
            isUser: false,
            safety: 'Safe',
            safeOnlyMode: true,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, ezaMessage]);
        } else {
          const ezaMessage: Message = {
            id: assistantMessageId,
            text: data.assistant_answer || 'No response available',
            isUser: false,
            assistantScore: data.assistant_score,
            safeOnlyMode: false,
            timestamp: new Date(),
          };
          
          // Update user message with score
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === userMessageId 
                ? { ...msg, userScore: data.user_score }
                : msg
            )
          );
          
          // Show assistant score after 0.4s delay
          if (data.assistant_score !== undefined) {
            assistantScoreTimeoutRef.current = setTimeout(() => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, assistantScore: data.assistant_score }
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
      
      if (error.message) {
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorText = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
        } else if (error.message.includes('404') || error.message.includes('bulunamadı')) {
          errorText = 'Backend endpoint bulunamadı. Lütfen backend\'in çalıştığından ve /api/standalone/stream endpoint\'inin mevcut olduğundan emin olun.';
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

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden safe-area-inset">
      <TopBar onSettingsClick={() => setIsSettingsOpen(true)} />
      <MessageList messages={messages} isLoading={isLoading} isTyping={isTyping} />
      <InputBar 
        onSend={handleSend} 
        isLoading={isLoading}
        disabled={isLimitReached}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        safeOnlyMode={safeOnlyMode}
        onSafeOnlyModeChange={setSafeOnlyMode}
      />
    </div>
  );
}
