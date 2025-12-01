/**
 * MessageList Component - Scrollable Message Container with EmptyState
 */

import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import LoadingDots from './LoadingDots';
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
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 overscroll-contain">
      <div className="max-w-4xl mx-auto py-4 sm:py-6 w-full">
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

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4 sm:mb-5 px-2 sm:px-4">
            <div className="bg-white border border-gray-200 rounded-[18px] sm:rounded-[20px] rounded-tl-[4px] shadow-sm">
              <LoadingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
