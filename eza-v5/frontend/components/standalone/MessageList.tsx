/**
 * MessageList Component - Scrollable Message Container with EmptyState
 */

import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import LoadingDots from './LoadingDots';
import TypingIndicator from './TypingIndicator';
import EmptyState from './EmptyState';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  // Score mode (Standalone default)
  userScore?: number; // 0-100 for user message
  assistantScore?: number; // 0-100 for assistant message
  // Safe-only mode
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isTyping?: boolean;
}

export default function MessageList({ messages, isLoading, isTyping = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive or typing indicator appears
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 overscroll-contain min-h-0">
      <div className="max-w-4xl mx-auto py-3 sm:py-4 md:py-6 pb-20 sm:pb-24 w-full px-1 sm:px-2">
        {/* Empty State */}
        {messages.length === 0 && !isLoading && <EmptyState />}

        {/* Messages */}
        <div className="w-full">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message.text}
              isUser={message.isUser}
              userScore={message.userScore}
              assistantScore={message.assistantScore}
              safety={message.safety}
              safeOnlyMode={message.safeOnlyMode}
              timestamp={message.timestamp}
            />
          ))}
        </div>

        {/* Typing Indicator - Shows before streaming starts */}
        {isTyping && <TypingIndicator />}

        {/* Loading Indicator - Legacy fallback (not used with streaming) */}
        {isLoading && !isTyping && (
          <div className="flex justify-start mb-3 sm:mb-4 md:mb-5 px-2 sm:px-4">
            <div className="bg-white border border-gray-200 rounded-[16px] sm:rounded-[18px] md:rounded-[20px] rounded-tl-[4px] shadow-sm">
              <LoadingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
