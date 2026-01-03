/**
 * TopBar Component - Apple Style Navigation
 */

import { Settings } from 'lucide-react';

interface TopBarProps {
  onSettingsClick: () => void;
}

export default function TopBar({ onSettingsClick }: TopBarProps) {
  return (
    <div className="sticky top-0 z-[100] backdrop-blur-xl bg-white border-b border-gray-200 safe-area-top shadow-sm">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        {/* Left: Minimal EZA Logo */}
        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px] sm:text-xs font-semibold leading-none">EZA</span>
          </div>
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center px-2">
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 truncate">EZA Standalone</h1>
        </div>

        {/* Right: Settings Icon */}
        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
          <button
            onClick={onSettingsClick}
            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors active:scale-95 touch-manipulation"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
