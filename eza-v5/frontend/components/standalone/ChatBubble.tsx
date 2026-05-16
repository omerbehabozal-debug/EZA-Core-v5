/**
 * ChatBubble — layout-system bubbles + meta rhythm
 */

import SafetyBadge from './SafetyBadge';
import BehavioralSummary from './BehavioralSummary';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import StandaloneFeedbackChips from './StandaloneFeedbackChips';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

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
}: ChatBubbleProps) {
  if (isUser) {
    return (
      <article className={`flex justify-end ${standaloneSkin.turnBlock}`}>
        <div className={`${standaloneSkin.userTurn} ${standaloneSkin.turnMeta}`}>
          <div className={standaloneSkin.userBubble}>
            <p className={standaloneSkin.messageText}>{message}</p>
          </div>

          {!safeOnlyMode ? (
            <div className={standaloneSkin.insightWrap}>
              <BehavioralSummary ezaScore={userScore} context="user" align="end" />
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

