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
      <div className="flex justify-end mb-3 sm:mb-4 md:mb-5 px-1.5 sm:px-2 md:px-4">
        <div className="max-w-[88%] xs:max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[65%] flex flex-col items-end">
          <div className="bg-[#EEF2FF] border border-indigo-100 rounded-[16px] sm:rounded-[18px] md:rounded-[20px] rounded-tr-[4px] px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 shadow-sm relative inline-block pr-8 sm:pr-10 md:pr-12">
            {/* Score Badge - Show placeholder (gray) if score is undefined, actual score when available */}
            {!safeOnlyMode && (
              <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 md:-top-2 md:-right-2 z-10 pointer-events-none">
                {userScore !== undefined && userScore !== null ? (
                  <ScoreBadge score={userScore} />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm animate-pulse">
                    <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-gray-400">--</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-gray-900 text-xs sm:text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
          {timestamp && (
            <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 sm:mt-1 md:mt-1.5 text-right pr-0.5 sm:pr-1">
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
        <div className="bg-white border border-gray-200 rounded-[16px] sm:rounded-[18px] md:rounded-[20px] rounded-tl-[4px] px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 shadow-sm relative inline-block pr-8 sm:pr-10 md:pr-12">
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
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm opacity-50">
                  <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-gray-400">--</span>
                </div>
              )}
            </div>
          )}
          <p className="text-gray-900 text-xs sm:text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>
        </div>
        {timestamp && (
          <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 sm:mt-1 md:mt-1.5 text-left pl-0.5 sm:pl-1">
            {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
