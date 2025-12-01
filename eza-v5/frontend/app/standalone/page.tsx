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

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/standalone/TopBar';
import MessageList from '@/components/standalone/MessageList';
import InputBar from '@/components/standalone/InputBar';
import SettingsModal from '@/components/standalone/SettingsModal';
import { apiClient } from '@/lib/apiClient';

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
const THROTTLE_DELAY_MS = 2000; // 2 seconds delay when throttling

// localStorage keys
const STORAGE_KEY_SAFE_ONLY = 'eza_standalone_safe_only';
const STORAGE_KEY_DAILY_COUNT = 'eza_standalone_daily_count';
const STORAGE_KEY_LAST_DATE = 'eza_standalone_last_date';

export default function StandalonePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [safeOnlyMode, setSafeOnlyMode] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [throttleDelay, setThrottleDelay] = useState(0);

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

  // Update throttle delay based on daily count
  useEffect(() => {
    if (dailyCount >= DAILY_LIMIT_SOFT && dailyCount < DAILY_LIMIT_HARD) {
      // Soft limit - apply throttle
      const excess = dailyCount - DAILY_LIMIT_SOFT;
      const delay = Math.min(THROTTLE_DELAY_MS * (1 + excess / 10), 10000); // Max 10s
      setThrottleDelay(delay);
    } else {
      setThrottleDelay(0);
    }
  }, [dailyCount]);

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
    // Check hard limit
    if (isLimitReached || dailyCount >= DAILY_LIMIT_HARD) {
      return;
    }

    // Apply throttle delay if in soft limit range
    if (throttleDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, throttleDelay));
    }

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call backend API with safeOnlyMode parameter
      const response = await apiClient.post<{
        ok: boolean;
        data?: {
          assistant_answer?: string;
          user_score?: number;
          assistant_score?: number;
          safe_answer?: string; // For safe-only mode
          mode?: string;
        };
        error?: {
          error_message?: string;
        };
      }>('/api/standalone', {
        body: { 
          text,
          safe_only: safeOnlyMode 
        },
        auth: false, // Public endpoint
      });

      if (!response.ok) {
        throw new Error(response.error?.error_message || response.error?.message || 'Request failed');
      }

      // API client returns: { ok: true, data: {...}, mode: "...", eza_score: ... }
      // response.data contains: { assistant_answer, user_score, assistant_score } or { safe_answer, mode: "safe-only" }
      console.log('Full API Response:', JSON.stringify(response, null, 2));
      const data = response.data;
      console.log('Extracted data object:', JSON.stringify(data, null, 2));
      
      if (!data) {
        console.error('No data in response!');
        throw new Error('No data received from server');
      }
      
      // Debug: Check if scores are present
      console.log('User score:', data.user_score);
      console.log('Assistant score:', data.assistant_score);
      console.log('Assistant answer:', data.assistant_answer);

      // Increment daily count
      incrementDailyCount();

      // Handle response based on mode
      if (safeOnlyMode && data.mode === 'safe-only') {
        // SAFE-only mode: show rewritten answer with SAFE badge
        const ezaMessage: Message = {
          id: `eza-${Date.now()}`,
          text: data.safe_answer || data.assistant_answer || 'No response available',
          isUser: false,
          safety: 'Safe',
          safeOnlyMode: true,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, ezaMessage]);
      } else {
        // Score mode: show scores for both user and assistant
        const ezaMessage: Message = {
          id: `eza-${Date.now()}`,
          text: data.assistant_answer || 'No response available',
          isUser: false,
          assistantScore: data.assistant_score,
          safeOnlyMode: false,
          timestamp: new Date(),
        };
        
        // Update user message with score
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === userMessage.id 
              ? { ...msg, userScore: data.user_score }
              : msg
          )
        );
        
        setMessages((prev) => [...prev, ezaMessage]);
      }
    } catch (error: any) {
      console.error('Standalone API Error:', error);
      console.error('Error details:', {
        message: error.message,
        error: error.error,
        stack: error.stack
      });
      
      // Show error message to user with more details
      let errorText = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
      
      if (error.message) {
        if (error.message.includes('fetch')) {
          errorText = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
        } else {
          errorText = error.message;
        }
      } else if (error.error?.error_message) {
        errorText = error.error.error_message;
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: errorText,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden safe-area-inset">
      <TopBar onSettingsClick={() => setIsSettingsOpen(true)} />
      <MessageList messages={messages} isLoading={isLoading} />
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
