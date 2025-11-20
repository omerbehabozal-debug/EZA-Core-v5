/**
 * ChatBubble Component - Apple iMessage Style Message Bubbles
 */

import SafetyBadge from './SafetyBadge';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  safety?: 'Safe' | 'Warning' | 'Blocked';
  confidence?: number;
  timestamp?: Date;
}

export default function ChatBubble({ message, isUser, safety, confidence, timestamp }: ChatBubbleProps) {
  if (isUser) {
    // User message (right aligned) - Apple iMessage style
    return (
      <div className="flex justify-end mb-5 px-4">
        <div className="max-w-[75%] sm:max-w-[65%]">
          <div className="bg-[#EEF2FF] border border-indigo-100 rounded-[20px] rounded-tr-[4px] px-4 py-3 shadow-sm">
            <p className="text-gray-900 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
          {timestamp && (
            <p className="text-xs text-gray-400 mt-1.5 text-right px-1">
              {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  // EZA message (left aligned) - Apple iMessage style
  return (
    <div className="flex justify-start mb-5 px-4">
      <div className="max-w-[75%] sm:max-w-[65%]">
        <div className="bg-white border border-gray-200 rounded-[20px] rounded-tl-[4px] px-4 py-3 shadow-sm relative">
          {/* Safety Badge - Floating top right */}
          {safety && (
            <div className="absolute -top-2 -right-2 z-10">
              <SafetyBadge safety={safety} confidence={confidence} />
            </div>
          )}
          <p className="text-gray-900 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>
        </div>
        {timestamp && (
          <p className="text-xs text-gray-400 mt-1.5 text-left px-1">
            {timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}
