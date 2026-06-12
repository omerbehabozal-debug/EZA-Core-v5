/**
 * MessageList — sohbet akışı
 */

import { useEffect, useRef } from 'react';
import ChatBubble, { type ChatBubbleVariant } from './ChatBubble';
import LoadingDots from './LoadingDots';
import TypingIndicator from './TypingIndicator';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import SainaGeometricMark from '@/components/saina/SainaGeometricMark';

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
  variant?: ChatBubbleVariant;
  userInitial?: string;
}

function SainaTypingRow() {
  return (
    <div className="saina-msg-row saina-msg-row--ai" data-testid="saina-typing-row">
      <div className="saina-msg-avatar saina-msg-avatar--saina">
        <SainaGeometricMark size={18} variant="gold" />
      </div>
      <div className="saina-msg-content">
        <div className="saina-msg-ai saina-msg-ai--typing">
          <LoadingDots />
        </div>
      </div>
    </div>
  );
}

export default function MessageList({
  messages,
  isLoading,
  isTyping = false,
  variant = 'legacy',
  userInitial = 'E',
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isEmpty = messages.length === 0 && !isLoading && !isTyping;
  const isSaina = variant === 'saina';

  useEffect(() => {
    if (!isEmpty) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isTyping, isEmpty]);

  const content = (
    <>
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
          variant={variant}
          userInitial={userInitial}
        />
      ))}

      {isTyping ? (
        isSaina ? (
          <SainaTypingRow />
        ) : (
          <TypingIndicator />
        )
      ) : null}

      {isLoading && !isTyping ? (
        isSaina ? (
          <SainaTypingRow />
        ) : (
          <div className={`flex justify-start ${standaloneSkin.turnBlock}`}>
            <div className={standaloneSkin.assistantTurn}>
              <div className={standaloneSkin.typingIndicator}>
                <LoadingDots />
              </div>
            </div>
          </div>
        )
      ) : null}

      {!isEmpty ? <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden /> : null}
    </>
  );

  if (isSaina) {
    return (
      <section className="saina-message-list" aria-label="Sohbet" data-variant="saina">
        <div className="saina-chat-messages saina-chat-messages--thread">{content}</div>
      </section>
    );
  }

  return (
    <section className={standaloneSkin.list} aria-label="Sohbet">
      <div className={standaloneSkin.listInnerActive}>{content}</div>
    </section>
  );
}
