/**
 * TopBar Component - Apple Style Navigation
 */

import { Settings } from 'lucide-react';

interface TopBarProps {
  onSettingsClick: () => void;
}

export default function TopBar({ onSettingsClick }: TopBarProps) {
  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/60 border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Minimal EZA Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-semibold">EZA</span>
          </div>
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          <h1 className="text-base font-semibold text-gray-900">EZA Standalone</h1>
        </div>

        {/* Right: Settings Icon */}
        <div className="w-8 h-8 flex items-center justify-center">
          <button
            onClick={onSettingsClick}
            className="p-1.5 rounded-lg hover:bg-gray-100/80 transition-colors active:scale-95"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
