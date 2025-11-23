/**
 * Internal Proxy Layout - Top bar + main content
 */

'use client';

import { ReactNode } from 'react';

interface InternalProxyLayoutProps {
  children: ReactNode;
  currentRiskLevel?: string;
}

export default function InternalProxyLayout({
  children,
  currentRiskLevel = 'low',
}: InternalProxyLayoutProps) {
  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">EZA – Internal Proxy</h1>
            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              EZA Internal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
              DEV
            </span>
            {currentRiskLevel && (
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${getRiskBadgeColor(
                  currentRiskLevel
                )}`}
              >
                {currentRiskLevel}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

