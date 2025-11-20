/**
 * Standalone Chat Page - Apple Premium UI
 */

import { useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import TopBar from '@/components/standalone/TopBar';
import MessageList from '@/components/standalone/MessageList';
import InputBar from '@/components/standalone/InputBar';
import SettingsModal from '@/components/standalone/SettingsModal';
import apiClient from '@/lib/api';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  confidence?: number;
  timestamp: Date;
}

export default function StandalonePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSend = async (text: string) => {
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
      const response = await apiClient.post('/api/standalone/standalone_chat', {
        text,
      });

      const ezaMessage: Message = {
        id: `eza-${Date.now()}`,
        text: response.data.answer,
        isUser: false,
        safety: response.data.safety,
        confidence: response.data.confidence,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, ezaMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      
      // Show error message to user
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
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
    <AuthGuard allowedRoles={['public_user', 'corporate_client', 'admin']}>
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
        <TopBar onSettingsClick={() => setIsSettingsOpen(true)} />
        <MessageList messages={messages} isLoading={isLoading} />
        <InputBar onSend={handleSend} isLoading={isLoading} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </AuthGuard>
  );
}
