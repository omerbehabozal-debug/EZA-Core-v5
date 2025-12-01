/**
 * ChatBubble Component - Apple iMessage Style Message Bubbles
 * Updated for Standalone: Score badges instead of safety badges
 */

import ScoreBadge from './ScoreBadge';
import SafetyBadge from './SafetyBadge';

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
}

export default function ChatBubble({ 
  message, 
  isUser, 
  userScore, 
  assistantScore, 
  safety, 
  safeOnlyMode = false,
  timestamp 
}: ChatBubbleProps) {
  if (isUser) {
    // User message (right aligned) - Apple iMessage style
    return (
      <div className="flex justify-end mb-4 sm:mb-5 px-2 sm:px-4">
        <div className="max-w-[85%] xs:max-w-[80%] sm:max-w-[75%] md:max-w-[65%] flex flex-col items-end">
          <div className="bg-[#EEF2FF] border border-indigo-100 rounded-[18px] sm:rounded-[20px] rounded-tr-[4px] px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm relative inline-block">
            {/* Score Badge - Only show if safeOnlyMode is false and score exists */}
            {!safeOnlyMode && userScore !== undefined && (
              <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 z-10">
                <ScoreBadge score={userScore} />
              </div>
            )}
            <p className="text-gray-900 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
          {timestamp && (
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5 text-right pr-1">
              {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // EZA message (left aligned) - Apple iMessage style
  return (
    <div className="flex justify-start mb-4 sm:mb-5 px-2 sm:px-4">
      <div className="max-w-[85%] xs:max-w-[80%] sm:max-w-[75%] md:max-w-[65%] flex flex-col items-start">
        <div className="bg-white border border-gray-200 rounded-[18px] sm:rounded-[20px] rounded-tl-[4px] px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm relative inline-block">
          {/* Badge - SAFE-only mode shows SAFE badge, otherwise shows score */}
          {safeOnlyMode && safety ? (
            <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 z-10">
              <SafetyBadge safety={safety} />
            </div>
          ) : !safeOnlyMode && assistantScore !== undefined ? (
            <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 z-10">
              <ScoreBadge score={assistantScore} />
            </div>
          ) : null}
          <p className="text-gray-900 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>
        </div>
        {timestamp && (
          <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-1.5 text-left pl-1">
            {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
