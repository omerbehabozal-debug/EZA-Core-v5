/**
 * LoadingDots Component - Apple iMessage Style Custom Animation
 */

export default function LoadingDots() {
  return (
    <div className="flex items-center space-x-1.5 px-4 py-3">
      <div className="flex space-x-1.5">
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
          style={{
            animationDelay: '0ms',
          }}
        />
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
          style={{
            animationDelay: '200ms',
          }}
        />
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse-dot"
          style={{
            animationDelay: '400ms',
          }}
        />
      </div>
    </div>
  );
}
