/**
 * MessageList — sohbet akışı
 */

import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import LoadingDots from './LoadingDots';
import TypingIndicator from './TypingIndicator';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp?: Date;
  behavioral?: BehavioralSnapshot | null;
  feedback?: StandaloneFeedbackContext | null;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isTyping?: boolean;
}

export default function MessageList({ messages, isLoading, isTyping = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0 && !isLoading && !isTyping;

  useEffect(() => {
    if (!isEmpty) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isTyping, isEmpty]);

  return (
    <section className={standaloneSkin.list} aria-label="Sohbet">
      <div
        className={standaloneSkin.listInnerActive}
      >
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
            behavioral={message.behavioral}
            feedback={message.feedback}
          />
        ))}

        {isTyping ? <TypingIndicator /> : null}

        {isLoading && !isTyping ? (
          <div className={`flex justify-start ${standaloneSkin.turnBlock}`}>
            <div className={standaloneSkin.assistantTurn}>
              <div className={standaloneSkin.typingIndicator}>
                <LoadingDots />
              </div>
            </div>
          </div>
        ) : null}

        {!isEmpty ? <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden /> : null}
      </div>
    </section>
  );
}
