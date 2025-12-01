/**
 * TypingIndicator Component - ChatGPT-style typing dots animation
 * Minimal 3 dots with opacity animation
 */

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4 sm:mb-5 px-2 sm:px-4">
      <div className="max-w-[85%] xs:max-w-[80%] sm:max-w-[75%] md:max-w-[65%]">
        <div className="bg-white border border-gray-200 rounded-[18px] sm:rounded-[20px] rounded-tl-[4px] px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm">
          <div className="flex items-center space-x-1.5">
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
                style={{
                  animationDelay: '0ms',
                }}
              />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
                style={{
                  animationDelay: '150ms',
                }}
              />
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
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

