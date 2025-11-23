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
  safety?: 'Safe' | 'Warning' | 'Blocked';
  confidence?: number;
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
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto py-6">
        {/* Empty State */}
        {messages.length === 0 && !isLoading && <EmptyState />}

        {/* Messages */}
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message.text}
            isUser={message.isUser}
            safety={message.safety}
            confidence={message.confidence}
            timestamp={message.timestamp}
          />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start mb-5 px-4">
            <div className="bg-white border border-gray-200 rounded-[20px] rounded-tl-[4px] shadow-sm">
              <LoadingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
