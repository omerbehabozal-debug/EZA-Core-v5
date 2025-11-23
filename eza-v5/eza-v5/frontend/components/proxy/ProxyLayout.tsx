/**
 * ProxyLayout Component - EZA AR-GE Lab Panel Layout
 */

import { ReactNode } from 'react';

interface ProxyLayoutProps {
  children: ReactNode;
  mode: 'fast' | 'deep';
  onModeChange: (mode: 'fast' | 'deep') => void;
}

export default function ProxyLayout({ children, mode, onModeChange }: ProxyLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* TopBar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">EZA Proxy Lab</h1>
              <p className="text-sm text-gray-500 mt-1">AR-GE Laboratuvar Paneli</p>
            </div>
            
            {/* Mode Selector */}
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onModeChange('fast')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'fast'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Fast
              </button>
              <button
                onClick={() => onModeChange('deep')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'deep'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Deep
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}

