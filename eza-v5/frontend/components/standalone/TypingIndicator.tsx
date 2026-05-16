/**
 * TypingIndicator Component - streaming wait state
 */

import { standaloneSkin } from '@/lib/eza/standaloneSkin';

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 sm:mb-5 px-2 sm:px-4">
      <div className="max-w-[85%] xs:max-w-[80%] sm:max-w-[75%] md:max-w-[65%]">
        <div className={standaloneSkin.typingBubble}>
          <div className="flex items-center space-x-1.5">
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 bg-eza-text-muted rounded-full animate-pulse-dot"
                style={{
                  animationDelay: '0ms',
                }}
              />
              <div
                className="w-2 h-2 bg-eza-text-muted rounded-full animate-pulse-dot"
                style={{
                  animationDelay: '150ms',
                }}
              />
              <div
                className="w-2 h-2 bg-eza-text-muted rounded-full animate-pulse-dot"
                style={{
                  animationDelay: '300ms',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

