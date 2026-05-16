/**
 * ChatBubble Component - Apple iMessage Style Message Bubbles
 * Updated for Standalone: Score badges instead of safety badges
 */

import ScoreBadge from './ScoreBadge';
import SafetyBadge from './SafetyBadge';
import BehavioralSummary from './BehavioralSummary';
import type { BehavioralSnapshot, StandaloneFeedbackContext } from '@/lib/types';
import StandaloneFeedbackChips from './StandaloneFeedbackChips';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  // Score mode (Standalone default)
  userScore?: number; // 0-100 for user message
  assistantScore?: number; // 0-100 for assistant message
  // Safe-only mode (when safeOnlyMode is true)
  safety?: 'Safe' | 'Warning' | 'Blocked';
  safeOnlyMode?: boolean; // If true, show SAFE badge instead of score
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
    // User message (right aligned) - Apple iMessage style
    return (
      <div className="flex justify-end mb-3 sm:mb-4 md:mb-5 px-1.5 sm:px-2 md:px-4">
        <div className="max-w-[88%] xs:max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[65%] flex flex-col items-end">
          <div className={standaloneSkin.userBubble}>
            {/* Score Badge - Show placeholder (gray) if score is undefined, actual score when available */}
            {!safeOnlyMode && (
              <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 md:-top-2 md:-right-2 z-10 pointer-events-none">
                {userScore !== undefined && userScore !== null ? (
                  <ScoreBadge score={userScore} />
                ) : (
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 ${standaloneSkin.scorePlaceholder} animate-pulse`}>
                    <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-eza-text-muted">--</span>
                  </div>
                )}
              </div>
            )}
            <p className={standaloneSkin.messageText}>
              {message}
            </p>
          </div>
          {timestamp && (
            <p className={`${standaloneSkin.timestamp} mt-0.5 sm:mt-1 md:mt-1.5 text-right pr-0.5 sm:pr-1`}>
              {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // EZA message (left aligned) - Apple iMessage style
  return (
    <div className="flex justify-start mb-3 sm:mb-4 md:mb-5 px-1.5 sm:px-2 md:px-4">
      <div className="max-w-[88%] xs:max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[65%] flex flex-col items-start">
        <div className={standaloneSkin.assistantBubble}>
          {/* Badge - SAFE-only mode shows SAFE badge, otherwise shows score (with placeholder) */}
          {safeOnlyMode ? (
            <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 md:-top-2 md:-right-2 z-10 pointer-events-none">
              <SafetyBadge safety={safety || 'Safe'} />
            </div>
          ) : (
            <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 md:-top-2 md:-right-2 z-10 pointer-events-none">
              {assistantScore !== undefined && assistantScore !== null ? (
                <ScoreBadge score={assistantScore} />
              ) : (
                // Placeholder badge - will be replaced when score arrives
                <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 ${standaloneSkin.scorePlaceholder} opacity-50`}>
                  <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-eza-text-muted">--</span>
                </div>
              )}
            </div>
          )}
          <p className={standaloneSkin.messageText}>
            {message}
          </p>
        </div>
        {behavioral ? <BehavioralSummary data={behavioral} /> : null}
        {feedback?.eventId ? <StandaloneFeedbackChips context={feedback} /> : null}
        {timestamp && (
          <p className={`${standaloneSkin.timestamp} mt-0.5 sm:mt-1 md:mt-1.5 text-left pl-0.5 sm:pl-1`}>
            {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
