/**
 * ProxyLiteLayout Component - Audit Panel Layout
 */

import { ReactNode } from 'react';

interface ProxyLiteLayoutProps {
  children: ReactNode;
}

export default function ProxyLiteLayout({ children }: ProxyLiteLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">EZA Proxy-Lite</h1>
          <p className="text-sm text-gray-600">
            Denetim Paneli
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Bu panel, içeriklerin risk seviyesini ve önerilen aksiyonları özetler. Ham veri gösterilmez.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}

