/**
 * ChatBubble — layout-system bubbles + meta rhythm
 */

import SafetyBadge from './SafetyBadge';
import BehavioralSummary from './BehavioralSummary';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import StandaloneFeedbackChips from './StandaloneFeedbackChips';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { SAINA_BRAND } from '@/lib/eza/sainaCopy';
import SainaGeometricMark from '@/components/saina/SainaGeometricMark';
import SainaMessageBody from './SainaMessageBody';

export type ChatBubbleVariant = 'legacy' | 'saina';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  userScore?: number;
  assistantScore?: number;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean;
  timestamp?: Date;
  behavioral?: BehavioralSnapshot | null;
  feedback?: StandaloneFeedbackContext | null;
  variant?: ChatBubbleVariant;
  userInitial?: string;
  /** First assistant turn in thread — shows SAINA brand header. */
  isFirstAssistantMessage?: boolean;
}

export default function ChatBubble({
  message,
  isUser,
  userScore,
  assistantScore,
  safety,
  safeOnlyMode = false,
  timestamp,
  behavioral,
  feedback,
  variant = 'legacy',
  userInitial = 'E',
  isFirstAssistantMessage = true,
}: ChatBubbleProps) {
  if (variant === 'saina') {
    const rowClass = isUser ? 'saina-msg-row--user' : 'saina-msg-row--ai';

    return (
      <article
        className={`saina-msg-row ${rowClass}`}
        data-testid={isUser ? 'saina-msg-user' : 'saina-msg-ai'}
      >
        <div className="saina-msg-content">
          {!isUser && isFirstAssistantMessage ? (
            <div className="saina-msg-ai-header" data-testid="saina-msg-ai-header">
              <SainaGeometricMark size={18} variant="gold" className="saina-msg-ai-mark" />
              <span className="saina-msg-ai-title">{SAINA_BRAND}</span>
            </div>
          ) : null}
          <div className={isUser ? 'saina-msg-user saina-msg-user--standalone' : 'saina-msg-ai'}>
            <SainaMessageBody message={message} role={isUser ? 'user' : 'ai'} />
          </div>
          <div className="saina-msg-meta">
            {isUser ? (
              !safeOnlyMode ? (
                <div className="saina-msg-meta-chip">
                  <BehavioralSummary
                    data={behavioral}
                    ezaScore={userScore}
                    context="user"
                    align="end"
                    variant="saina"
                  />
                </div>
              ) : null
            ) : safeOnlyMode ? (
              <div className="saina-msg-meta-chip">
                <SafetyBadge safety={safety || 'Safe'} />
              </div>
            ) : (
              <div className="saina-msg-meta-chip">
                <BehavioralSummary
                  data={behavioral}
                  ezaScore={assistantScore}
                  context="assistant"
                  align="start"
                  variant="saina"
                />
              </div>
            )}
            {feedback?.eventId ? (
              <div className="saina-msg-meta-feedback">
                <StandaloneFeedbackChips context={feedback} className="saina-feedback-chips" />
              </div>
            ) : null}
            {timestamp ? (
              <time className="saina-msg-time" dateTime={timestamp.toISOString()}>
                {timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </time>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  if (isUser) {
    return (
      <article className={`flex justify-end ${standaloneSkin.turnBlock}`}>
        <div className={`${standaloneSkin.userTurn} ${standaloneSkin.turnMeta}`}>
          <div className={standaloneSkin.userBubble}>
            <p className={standaloneSkin.messageText}>{message}</p>
          </div>

          {!safeOnlyMode ? (
            <div className={standaloneSkin.insightWrap}>
              <BehavioralSummary data={behavioral} ezaScore={userScore} context="user" align="end" />
            </div>
          ) : null}

          {timestamp ? (
            <time
              className={`${standaloneSkin.timestamp} text-right`}
              dateTime={timestamp.toISOString()}
            >
              {timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </time>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className={`flex justify-start ${standaloneSkin.turnBlock}`}>
      <div className={`${standaloneSkin.assistantTurn} ${standaloneSkin.turnMeta}`}>
        <div className={standaloneSkin.assistantBody}>
          <p className={standaloneSkin.messageText}>{message}</p>
        </div>

        {safeOnlyMode ? (
          <div className={standaloneSkin.insightWrap}>
            <SafetyBadge safety={safety || 'Safe'} />
          </div>
        ) : (
          <div className={standaloneSkin.insightWrap}>
            <BehavioralSummary data={behavioral} ezaScore={assistantScore} context="assistant" />
          </div>
        )}

        {feedback?.eventId ? <StandaloneFeedbackChips context={feedback} /> : null}

        {timestamp ? (
          <time className={standaloneSkin.timestamp} dateTime={timestamp.toISOString()}>
            {timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </time>
        ) : null}
      </div>
    </article>
  );
}
