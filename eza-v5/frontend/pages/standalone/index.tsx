/**
 * Standalone Chat Page - Public Access
 * No authentication required
 */

'use client';

import { useState } from 'react';
import TopBar from '@/components/standalone/TopBar';
import MessageList from '@/components/standalone/MessageList';
import InputBar from '@/components/standalone/InputBar';
import SettingsModal from '@/components/standalone/SettingsModal';
import { apiClient } from '@/lib/apiClient';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  confidence?: number;
  timestamp: Date;
  ezaScore?: number;
  riskLevel?: string;
  policyViolations?: string[];
}

export default function StandalonePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSend = async (text: string) => {
    // Add user message instantly
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call backend API
      const response = await apiClient.post<{
        ok: boolean;
        data?: {
          answer?: string;
          safe_answer?: string;
          eza_score?: number;
          risk_level?: string;
          policy_violations?: string[];
        };
        error?: {
          error_message?: string;
        };
      }>('/api/standalone', {
        body: { text },
        auth: false,
      });

      if (!response.ok || !response.data) {
        throw new Error(response.error?.error_message || 'Request failed');
      }

      const data = response.data;

      const safeAnswer =
        data.answer ||
        data.safe_answer || // backward compatibility
        'No response available';

      const ezaMessage: Message = {
        id: `eza-${Date.now()}`,
        text: safeAnswer,
        isUser: false,
        safety:
          data.risk_level === 'high'
            ? 'Blocked'
            : data.risk_level === 'medium'
            ? 'Warning'
            : 'Safe',
        ezaScore: data.eza_score,
        riskLevel: data.risk_level,
        policyViolations: data.policy_violations,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, ezaMessage]);
    } catch (error: any) {
      console.error('Standalone Error:', error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text:
          error?.message ||
          error?.error?.error_message ||
          'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        isUser: false,
        safety: 'Warning',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <TopBar onSettingsClick={() => setIsSettingsOpen(true)} />
      <MessageList messages={messages} isLoading={isLoading} />
      <InputBar onSend={handleSend} isLoading={isLoading} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
